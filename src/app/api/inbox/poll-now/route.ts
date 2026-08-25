import "server-only";
import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { pollAndIngest } from "@/lib/email/poll-and-ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * On-demand mailbox poll — lets an operator trigger ingestion immediately
 * instead of waiting for the 5-minute cron window (critical for live demos).
 */
export async function POST() {
  requireRole(
    await getCurrentAppUser(),
    "admin",
    "lead",
    "operator",
    "reviewer",
  );

  try {
    const result = await pollAndIngest();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Poll failed",
      },
      { status: 500 },
    );
  }
}
