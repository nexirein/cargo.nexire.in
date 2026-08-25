import "server-only";
import { NextResponse } from "next/server";
import { processDueFollowUps } from "@/lib/ai/followup";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

async function verifyCronAuth(request: Request): Promise<boolean> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return false;

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    const qstashSignature = request.headers.get("upstash-signature");
    if (qstashSignature) return true;
    return false;
  }

  return authHeader === `Bearer ${cronSecret}`;
}

export async function POST(request: Request) {
  try {
    if (!(await verifyCronAuth(request))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await processDueFollowUps();

    return NextResponse.json({ success: true, processed: true });
  } catch (error) {
    console.error("[cron/process-followups] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cron failed" },
      { status: 500 },
    );
  }
}

export async function GET(request: Request) {
  return POST(request);
}
