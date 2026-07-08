import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { acquireLock, releaseLock } from "@/lib/redis/locks";
import { sendMailViaGraph } from "@/lib/graph/send-mail";
import { triggerPowerAutomateSend } from "@/lib/power-automate/send-mail";
import { renderPrealertEmail } from "@/lib/email/templates/prealert-v1";
import { finalizeSendSuccess, finalizeSendFailure } from "./finalize-send";

export interface ProcessSendResult {
  status: "sent" | "already_sent" | "failed" | "retrying" | "processing";
  reason?: string;
}

/**
 * Which transport actually sends the email. `power_automate` is the
 * default because FedEx's tenant does not grant admin consent for a
 * custom Graph app registration — see docs/POWER_AUTOMATE.md. `graph` is
 * kept fully working as a fallback (local testing, or if tenant policy
 * ever changes) via MAIL_DRIVER=graph.
 */
function mailDriver(): "power_automate" | "graph" {
  return process.env.MAIL_DRIVER === "graph" ? "graph" : "power_automate";
}

/**
 * The single implementation of "send one AWB's pre-alert," shared by the
 * local `inline` queue driver and the QStash-invoked webhook route — so
 * there is exactly one code path for the actual send logic regardless of
 * which queue driver dispatched it.
 *
 * With MAIL_DRIVER=power_automate this function's job ends at "handed the
 * job to the flow" (status: "processing"), not "email sent" — the flow
 * reports the real outcome asynchronously via
 * POST /api/power-automate/callback, which calls finalizeSendSuccess /
 * finalizeSendFailure directly. With MAIL_DRIVER=graph, this function
 * still finalizes synchronously, since the Graph call itself confirms
 * the send before returning.
 */
export async function processSendJob(
  batchItemId: string,
): Promise<ProcessSendResult> {
  const admin = createAdminClient();

  const { data: item } = await admin
    .from("batch_items")
    .select(
      "id, batch_run_id, sub_batch_id, awb, consignee_name, consignee_email, shipment_data, send_status, attempt_count, max_attempts",
    )
    .eq("id", batchItemId)
    .single();

  if (!item) {
    return { status: "failed", reason: "Batch item not found." };
  }

  // Postgres is the idempotency source of truth (spec 14): a job that has
  // already succeeded — possibly via a duplicate/retried QStash delivery —
  // is a harmless no-op here, regardless of the Redis lock below.
  if (item.send_status === "sent") {
    return { status: "already_sent" };
  }

  const lockKey = `lock:send:${batchItemId}`;
  const gotLock = await acquireLock(lockKey, 30_000);
  if (!gotLock) {
    return {
      status: "retrying",
      reason: "Another worker is currently processing this item.",
    };
  }

  try {
    const { data: batchRun } = await admin
      .from("batch_runs")
      .select(
        "id, mailbox_configs(operational_mailbox, tagged_mailbox, signature_html)",
      )
      .eq("id", item.batch_run_id)
      .single();

    const mailbox = Array.isArray(batchRun?.mailbox_configs)
      ? batchRun.mailbox_configs[0]
      : batchRun?.mailbox_configs;

    if (!mailbox) {
      const reason = "No mailbox is configured for this batch.";
      await finalizeSendFailure(admin, item, reason);
      return { status: "failed", reason };
    }

    const { data: assets } = await admin
      .from("file_assets")
      .select("original_name, storage_path, derived_format, source_format")
      .eq("batch_item_id", item.id);

    const attachments = [];
    for (const asset of assets ?? []) {
      if (!asset.storage_path) continue;
      const { data: fileBlob, error: downloadError } = await admin.storage
        .from("invoices")
        .download(asset.storage_path);
      if (downloadError || !fileBlob) continue;

      const bytes = new Uint8Array(await fileBlob.arrayBuffer());
      const isPdf = (asset.derived_format ?? asset.source_format) === "pdf";
      attachments.push({
        name: asset.original_name.replace(/\.(tif|tiff)$/i, ".pdf"),
        contentType: isPdf ? "application/pdf" : "application/octet-stream",
        contentBytes: Buffer.from(bytes).toString("base64"),
      });
    }

    const { subject, html } = renderPrealertEmail({
      consigneeName: item.consignee_name,
      awb: item.awb,
      shipmentData: (item.shipment_data ?? {}) as Record<string, string>,
      signatureHtml: mailbox.signature_html,
    });

    await admin
      .from("batch_items")
      .update({
        send_status: "processing",
        send_started_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    const driver = mailDriver();

    if (driver === "power_automate") {
      await triggerPowerAutomateSend({
        batchItemId: item.id,
        fromMailbox: mailbox.operational_mailbox,
        to: [item.consignee_email],
        cc: [mailbox.tagged_mailbox],
        subject,
        htmlBody: html,
        attachments,
      });

      // The flow accepted the job (202) and will report the real outcome
      // asynchronously to /api/power-automate/callback. This job's own
      // work — triggering the send — is done; `batch_items` correctly
      // stays "processing" until that callback finalizes it.
      return { status: "processing" };
    }

    const result = await sendMailViaGraph({
      fromMailbox: mailbox.operational_mailbox,
      to: [item.consignee_email],
      cc: [mailbox.tagged_mailbox],
      subject,
      htmlBody: html,
      attachments,
    });

    await finalizeSendSuccess(admin, item, {
      subject,
      html,
      senderMailbox: mailbox.operational_mailbox,
      recipientEmails: [item.consignee_email, mailbox.tagged_mailbox],
      messageId: result.messageId,
      internetMessageId: result.internetMessageId,
      conversationId: result.conversationId,
    });

    return { status: "sent" };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown send error.";
    const attemptCount = (item.attempt_count ?? 0) + 1;
    const maxAttempts = item.max_attempts ?? 5;

    if (attemptCount >= maxAttempts) {
      await finalizeSendFailure(admin, item, message, attemptCount);
      return { status: "failed", reason: message };
    }

    await admin
      .from("batch_items")
      .update({
        send_status: "retrying",
        attempt_count: attemptCount,
        failure_reason: message,
      })
      .eq("id", item.id);

    return { status: "retrying", reason: message };
  } finally {
    await releaseLock(lockKey);
  }
}
