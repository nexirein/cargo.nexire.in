import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { ingestEmail, type IngestInput } from "@/lib/email/ingest-email";

export async function POST(request: NextRequest) {
  let body: IngestInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  if (!body.messageId || !body.from) {
    return NextResponse.json(
      { error: "messageId and from are required." },
      { status: 400 },
    );
  }

  const result = await ingestEmail(body);
  const status = result.status === "duplicate" ? 200 : 201;

  return NextResponse.json(result, { status });
}
