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

  const results: Array<Record<string, unknown>> = [];
  const seenUids: number[] = [];

  for (const email of emails) {
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
