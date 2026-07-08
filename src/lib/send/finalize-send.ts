import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/log";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface BatchItemRef {
  id: string;
  batch_run_id: string;
  sub_batch_id: string | null;
  awb: string;
}

export interface SendSuccessInfo {
  subject: string;
  html: string;
  senderMailbox: string;
  recipientEmails: string[];
  /** Transport-specific identifiers, all optional — Power Automate has no
   * Graph-equivalent conversation/internet-message id, so these stay
   * nullable in `email_events` regardless of which driver sent the mail. */
  messageId?: string | null;
  internetMessageId?: string | null;
  conversationId?: string | null;
}

/**
 * Shared success finalization, used by both the synchronous Graph path
 * (process-send-job.ts) and the async Power Automate callback route —
 * one place that updates `batch_items`, writes `email_events`, upserts
 * the M5 `awb_cases` seam, bumps counters, and logs the audit trail.
 */
export async function finalizeSendSuccess(
  admin: AdminClient,
  item: BatchItemRef,
  info: SendSuccessInfo,
): Promise<void> {
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
    message_id: info.messageId ?? null,
    internet_message_id: info.internetMessageId ?? null,
    conversation_id: info.conversationId ?? null,
    subject: info.subject,
    body_clean: info.html,
    sender_email: info.senderMailbox,
    recipient_emails: info.recipientEmails,
    sent_at: now,
  });

  // M5 seam: a case exists for every AWB the moment it's actually sent,
  // rather than waiting for the reply-ingestion phase to create one — the
  // same upsert path that phase will reuse on reply.
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
}

export interface FailItem {
  id: string;
  batch_run_id: string;
  sub_batch_id: string | null;
  awb: string;
}

/**
 * Shared terminal-failure finalization (attempts exhausted, or a
 * transport reported a non-retryable failure). Does not touch
 * `attempt_count` unless a value is passed — the caller decides whether
 * this failure counts toward the retry budget.
 */
export async function finalizeSendFailure(
  admin: AdminClient,
  item: FailItem,
  reason: string,
  attemptCount?: number,
): Promise<void> {
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

  await logAudit({
    actorUserId: null,
    entityType: "batch_items",
    entityId: item.id,
    action: "send_failed",
    metadata: { awb: item.awb, reason },
  });
}
