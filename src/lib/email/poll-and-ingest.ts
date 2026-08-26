import "server-only";
import { pollInbox, markAsSeen } from "@/lib/email/imap";
import { ingestEmail } from "@/lib/email/ingest-email";

export interface PollIngestResult {
  status: "ok" | "error";
  ingested: number;
  duplicates: number;
  errors: number;
  emails: number;
  results: Array<Record<string, unknown>>;
  error?: string;
}

/**
 * Shared poll-and-ingest used by both the scheduled cron route and the
 * on-demand "Poll now" button, so the live demo doesn't have to wait for the
 * 5-minute cron window.
 *
 * On Vercel Hobby plan, serverless functions have a 10s timeout. Emails are
 * processed sequentially with a time budget checked BETWEEN emails — if the
 * budget is exhausted, remaining emails are skipped (not marked as seen) and
 * will be retried on the next poll cycle.
 */
export async function pollAndIngest(): Promise<PollIngestResult> {
  const START = Date.now();
  const MAX_MS = 7_000; // stay under Vercel Hobby 10s limit with buffer

  const emails = await pollInbox(10);

  if (emails.length === 0) {
    return {
      status: "ok",
      ingested: 0,
      duplicates: 0,
      errors: 0,
      emails: 0,
      results: [],
    };
  }

  const results: Array<Record<string, unknown>> = [];
  const seenUids: number[] = [];

  // Sort newest-first so the latest customer replies are processed within the
  // time budget. Without this, old unseen emails (notifications, bounces) eat
  // the budget and new replies never get reached.
  emails.sort((a, b) => b.date.getTime() - a.date.getTime());

  // Process sequentially — each ingestEmail call is expensive (AI +
  // DB + optional SMTP). Check time budget BETWEEN emails so we never start
  // one we can't finish. Unprocessed emails are NOT marked as seen and will
  // be retried on the next poll cycle.
  for (const email of emails) {
    if (Date.now() - START >= MAX_MS) break;

    try {
      const result = await ingestEmail({
        messageId: email.messageId,
        subject: email.subject,
        from: email.from,
        to: email.to,
        cc: email.cc,
        textBody: email.textBody,
        htmlBody: email.htmlBody,
        receivedAt: email.date.toISOString(),
        inReplyTo: email.inReplyTo,
        references: email.references,
      });

      // Mark as seen for "ingested" (new) and "duplicate" (already in DB).
      // Both are successfully processed — only "ignored" (transient DB error)
      // should be retried on the next poll cycle.
      if (result.status === "ingested" || result.status === "duplicate") {
        seenUids.push(email.uid);
      }

      results.push({ messageId: email.messageId, ...result });
    } catch (err) {
      results.push({
        messageId: email.messageId,
        status: "error",
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  if (seenUids.length > 0) {
    await markAsSeen(seenUids).catch((err) => {
      console.error("[poll-and-ingest] Failed to mark emails as seen:", err);
    });
  }

  return {
    status: "ok",
    ingested: results.filter((r) => r.status === "ingested").length,
    duplicates: results.filter((r) => r.status === "duplicate").length,
    errors: results.filter((r) => r.status === "error").length,
    emails: emails.length,
    results,
  };
}
