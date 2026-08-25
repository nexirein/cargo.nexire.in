import "server-only";
import { NextResponse } from "next/server";
import { ImapFlow } from "imapflow";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET() {
  const host = process.env.IMAP_HOST;
  const port = Number(process.env.IMAP_PORT) || 993;
  const user = process.env.IMAP_USER;
  const pass = process.env.IMAP_PASS;

  if (!host || !user || !pass) {
    return NextResponse.json(
      { ok: false, error: "IMAP_HOST, IMAP_USER, IMAP_PASS not set" },
      { status: 400 },
    );
  }

  const client = new ImapFlow({
    host,
    port,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  try {
    await client.connect();
    const lock = await client.getMailboxLock("INBOX");

    let status;
    try {
      status = await client.mailboxOpen("INBOX");
    } finally {
      lock.release();
    }

    await client.logout();

    return NextResponse.json({
      ok: true,
      host,
      user,
      port,
      connected: true,
      exists: status?.exists ?? 0,
    });
  } catch (error) {
    return NextResponse.json({
      ok: false,
      host,
      user,
      port,
      connected: false,
      error: error instanceof Error ? error.message : "Connection failed",
    });
  }
}
