import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderPrealertEmail } from "@/lib/email/templates/prealert-v1";
import {
  finalizeSendSuccess,
  finalizeSendFailure,
} from "@/lib/send/finalize-send";
import { enqueueSend } from "@/lib/queue/enqueue-send";

/**
 * Reports the real outcome of a send that `processSendJob` only handed
 * off to Power Automate (see docs/POWER_AUTOMATE.md and
 * src/lib/power-automate/send-mail.ts). The flow calls this once per
 * item, after it has actually attempted to send via Outlook.
 */
export async function POST(request: Request) {
  const secret = request.headers.get("x-pa-callback-secret");
  if (!secret || secret !== process.env.POWER_AUTOMATE_CALLBACK_SECRET) {
    return NextResponse.json(
      { error: "Invalid callback secret." },
      { status: 401 },
    );
  }

  const body = await request.json().catch(() => null);
  const batchItemId = body?.batchItemId as string | undefined;
  const status = body?.status as "sent" | "failed" | undefined;
  const errorMessage = body?.error as string | undefined;
  const runId = body?.runId as string | undefined;

  if (!batchItemId || (status !== "sent" && status !== "failed")) {
    return NextResponse.json(
      { error: "batchItemId and status ('sent' | 'failed') are required." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: item } = await admin
    .from("batch_items")
    .select(
      "id, batch_run_id, sub_batch_id, awb, consignee_name, consignee_email, shipment_data, send_status, attempt_count, max_attempts",
    )
    .eq("id", batchItemId)
    .single();

  if (!item) {
    return NextResponse.json({ error: "Batch item not found." }, { status: 404 });
  }

  // Idempotency: a duplicate/retried callback for an already-finalized
  // item is a harmless no-op — mirrors the same guard in processSendJob.
  if (item.send_status === "sent" || item.send_status === "failed") {
    return NextResponse.json({ status: "already_finalized" });
  }

  if (status === "failed") {
    const attemptCount = (item.attempt_count ?? 0) + 1;
    const maxAttempts = item.max_attempts ?? 5;
    const reason = errorMessage ?? "Power Automate flow reported a failure.";

    if (attemptCount >= maxAttempts) {
      await finalizeSendFailure(admin, item, reason, attemptCount);
      return NextResponse.json({ status: "failed" });
    }

    // Retry budget not exhausted: requeue automatically, the same way the
    // stalled-item cron does — QStash's own redelivery gives the Graph
    // path this behavior for free, but a flow-reported failure never
    // touches QStash's retry logic (QStash's job — triggering the flow —
    // already succeeded), so this path has to requeue itself explicitly.
    await admin
      .from("batch_items")
      .update({
        send_status: "pending",
        attempt_count: attemptCount,
        failure_reason: reason,
      })
      .eq("id", item.id);

    const { data: batchRun } = await admin
      .from("batch_runs")
      .select("mailbox_config_id")
      .eq("id", item.batch_run_id)
      .single();

    const { qstashMessageId } = await enqueueSend(
      item.id,
      batchRun?.mailbox_config_id ?? item.batch_run_id,
    );
    if (qstashMessageId) {
      await admin
        .from("batch_items")
        .update({ send_status: "queued", qstash_message_id: qstashMessageId })
        .eq("id", item.id);
    }

    return NextResponse.json({ status: "requeued" });
  }

  // status === "sent": recompute the same deterministic subject/body the
  // flow was sent to mail out (renderPrealertEmail is a pure function of
  // item + mailbox data) so email_events gets an accurate record, without
  // needing the flow to echo the full rendered email back to us.
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

  const { subject, html } = renderPrealertEmail({
    consigneeName: item.consignee_name,
    awb: item.awb,
    shipmentData: (item.shipment_data ?? {}) as Record<string, string>,
    signatureHtml: mailbox?.signature_html ?? null,
  });

  await finalizeSendSuccess(admin, item, {
    subject,
    html,
    senderMailbox: mailbox?.operational_mailbox ?? "unknown",
    recipientEmails: [item.consignee_email, mailbox?.tagged_mailbox].filter(
      (v): v is string => Boolean(v),
    ),
    messageId: runId ?? null,
  });

  return NextResponse.json({ status: "sent" });
}
