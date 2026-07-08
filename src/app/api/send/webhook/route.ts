import { NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { processSendJob } from "@/lib/send/process-send-job";

async function handler(request: Request) {
  const body = await request.json();
  const batchItemId = body.batchItemId as string | undefined;

  if (!batchItemId) {
    return NextResponse.json({ error: "Missing batchItemId." }, { status: 400 });
  }

  const result = await processSendJob(batchItemId);

  if (result.status === "retrying") {
    // Non-2xx tells QStash to retry this delivery with its own backoff.
    return NextResponse.json(
      { status: result.status, reason: result.reason },
      { status: 503 },
    );
  }

  // "sent", "already_sent", and "failed" (attempts exhausted) are all
  // terminal from QStash's point of view — no further redelivery needed.
  return NextResponse.json({ status: result.status, reason: result.reason });
}

export const POST = verifySignatureAppRouter(handler);
