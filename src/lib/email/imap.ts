import "server-only";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";

export interface FetchedEmail {
  uid: number;
  messageId: string;
  subject: string;
  from: string;
  to: string[];
  cc: string[];
  date: Date;
  textBody: string;
  htmlBody: string | null;
  inReplyTo: string | null;
  references: string[];
}

export interface ImapConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  mailbox?: string;
}

function getConfig(): ImapConfig {
  const host = process.env.IMAP_HOST;
  const port = Number(process.env.IMAP_PORT) || 993;
  const user = process.env.IMAP_USER;
  const pass = process.env.IMAP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      "IMAP_HOST, IMAP_USER, and IMAP_PASS must be set for inbox polling.",
    );
  }

  return { host, port, user, pass, mailbox: "INBOX" };
}

function connect() {
  const config = getConfig();
  return new ImapFlow({
    host: config.host,
    port: config.port,
    secure: true,
    auth: { user: config.user, pass: config.pass },
    logger: false,
  });
}

/**
 * Poll the configured IMAP inbox for unseen messages.
 * Does NOT mark messages as \Seen — the caller must call markAsSeen() after
 * successfully ingesting each message, so a crash or error doesn't lose it.
 */
export async function pollInbox(): Promise<FetchedEmail[]> {
  const client = connect();

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      const emails: FetchedEmail[] = [];

      for await (const message of client.fetch(
        { seen: false },
        {
          uid: true,
          envelope: true,
          source: true,
          flags: true,
          internalDate: true,
        },
      )) {
        const envelope = message.envelope;
        if (!envelope) continue;

        const source = message.source;
        if (!source) continue;

        const parsed = await simpleParser(source);

        const to = Array.isArray(parsed.to)
          ? parsed.to.map((a) => a.text)
          : parsed.to
            ? [parsed.to.text]
            : [];

        const cc = Array.isArray(parsed.cc)
          ? parsed.cc.map((a) => a.text)
          : parsed.cc
            ? [parsed.cc.text]
            : [];

        const inReplyTo = Array.isArray(parsed.inReplyTo)
          ? parsed.inReplyTo[0] ?? null
          : parsed.inReplyTo ?? null;

        const references = Array.isArray(parsed.references)
          ? parsed.references
          : parsed.references
            ? [parsed.references]
            : [];

        emails.push({
          uid: message.uid,
          messageId: parsed.messageId ?? `msg-${message.uid}`,
          subject: parsed.subject ?? "",
          from: typeof parsed.from === "object" ? parsed.from.text : "",
          to,
          cc,
          date: new Date(parsed.date ?? message.internalDate ?? new Date()),
          textBody: parsed.text ?? "",
          htmlBody: typeof parsed.html === "string" ? parsed.html : null,
          inReplyTo,
          references,
        });
      }

      return emails;
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}

/**
 * Mark specific UIDs as \Seen so they aren't polled again.
 * Call this AFTER successfully ingesting each email.
 */
export async function markAsSeen(uids: number[]): Promise<void> {
  if (uids.length === 0) return;

  const client = connect();

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    try {
      for (const uid of uids) {
        await client.messageFlagsAdd({ uid }, ["\\Seen"]);
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout();
  }
}
