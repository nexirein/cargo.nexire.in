import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { acquireLock, releaseLock } from "@/lib/redis/locks";
import { sendMailViaGraph } from "@/lib/graph/send-mail";
import { renderPrealertEmail } from "@/lib/email/templates/prealert-v1";
import { logAudit } from "@/lib/audit/log";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface ProcessSendResult {
  status: "sent" | "already_sent" | "failed" | "retrying";
  reason?: string;
}

/**
 * The single implementation of "send one AWB's pre-alert," shared by the
 * local `inline` queue driver and the QStash-invoked webhook route — so
 * there is exactly one code path for the actual send logic regardless of
 * which queue driver dispatched it.
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
      return await failItem(admin, item, "No mailbox is configured for this batch.");
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

    const result = await sendMailViaGraph({
      fromMailbox: mailbox.operational_mailbox,
      to: [item.consignee_email],
      cc: [mailbox.tagged_mailbox],
      subject,
      htmlBody: html,
      attachments,
    });

    const now = new Date().toISOString();

    await admin
      .from("batch_items")
      .update({ send_status: "sent", send_completed_at: now })
      .eq("id", item.id);

    await admin.from("email_events").insert({
      batch_run_id: item.batch_run_id,
      batch_item_id: item.id,
      sub_batch_id: item.sub_batch_id,
      awb: item.awb,
      direction: "outbound",
      message_id: result.messageId,
      internet_message_id: result.internetMessageId,
      conversation_id: result.conversationId,
      subject,
      body_clean: html,
      sender_email: mailbox.operational_mailbox,
      recipient_emails: [item.consignee_email, mailbox.tagged_mailbox],
      sent_at: now,
    });

    // M5 seam: a case exists for every AWB the moment it's actually sent,
    // rather than waiting for the reply-ingestion phase to create one —
    // the same upsert path that phase will reuse on reply.
    await admin.from("awb_cases").upsert(
      {
        awb: item.awb,
        latest_batch_run_id: item.batch_run_id,
        current_status: "awaiting_reply",
      },
      { onConflict: "awb" },
    );

    await Promise.all([
      item.sub_batch_id
        ? admin.rpc("increment_sub_batch_counter", {
            p_sub_batch_id: item.sub_batch_id,
            p_column: "sent_count",
          })
        : Promise.resolve(),
      admin.rpc("increment_batch_run_counter", {
        p_batch_run_id: item.batch_run_id,
        p_column: "sent_count",
      }),
    ]);

    await logAudit({
      actorUserId: null,
      entityType: "batch_items",
      entityId: item.id,
      action: "sent",
      metadata: { awb: item.awb },
    });

    return { status: "sent" };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown send error.";
    const attemptCount = (item.attempt_count ?? 0) + 1;
    const maxAttempts = item.max_attempts ?? 5;

    if (attemptCount >= maxAttempts) {
      return await failItem(admin, item, message, attemptCount);
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

async function failItem(
  admin: AdminClient,
  item: { id: string; batch_run_id: string; sub_batch_id: string | null },
  reason: string,
  attemptCount?: number,
): Promise<ProcessSendResult> {
  await admin
    .from("batch_items")
    .update({
      send_status: "failed",
      failure_reason: reason,
      ...(attemptCount !== undefined ? { attempt_count: attemptCount } : {}),
    })
    .eq("id", item.id);

  await Promise.all([
    item.sub_batch_id
      ? admin.rpc("increment_sub_batch_counter", {
          p_sub_batch_id: item.sub_batch_id,
          p_column: "failed_count",
        })
      : Promise.resolve(),
    admin.rpc("increment_batch_run_counter", {
      p_batch_run_id: item.batch_run_id,
      p_column: "failed_count",
    }),
  ]);

  return { status: "failed", reason };
}
