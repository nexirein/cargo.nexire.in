import "server-only";
import { NextResponse } from "next/server";
import { pollAndIngest } from "@/lib/email/poll-and-ingest";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cronKey = searchParams.get("cron_key");
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (authHeader !== expected && cronKey !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
