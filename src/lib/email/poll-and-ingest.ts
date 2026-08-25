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
 * On Vercel Hobby plan, serverless functions have a 10s timeout. To stay
 * within this budget:
 * - IMAP fetch is bounded (imap.ts has connectionTimeout/greetingTimeout/socketTimeout)
 * - Emails are processed in parallel via Promise.allSettled
 * - A time budget stops ingestion before the function is killed
 */
export async function pollAndIngest(): Promise<PollIngestResult> {
  const emails = await pollInbox();

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

  const START = Date.now();
  const MAX_MS = 7_000; // stay under Vercel Hobby 10s limit with buffer

  const results: Array<Record<string, unknown>> = [];
  const seenUids: number[] = [];

  // Process emails in parallel for speed, but respect time budget
  const ingestions = emails
    .filter(() => Date.now() - START < MAX_MS)
    .map(async (email) => {
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

        if (result.status === "ingested" || result.status === "ignored") {
          seenUids.push(email.uid);
        }

        return { messageId: email.messageId, ...result };
      } catch (err) {
        return {
          messageId: email.messageId,
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    });

  const settled = await Promise.allSettled(ingestions);
  for (const s of settled) {
    if (s.status === "fulfilled") results.push(s.value);
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
