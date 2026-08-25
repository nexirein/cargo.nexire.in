import "server-only";
import { NextResponse } from "next/server";
import { classify } from "@/lib/ai/classify";
import type { ClassificationInput } from "@/lib/ai/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input: ClassificationInput = {
      subject: body.subject ?? "",
      body: body.body ?? "",
      sender: body.sender ?? "",
      awb: body.awb,
    };

    if (!input.subject && !input.body) {
      return NextResponse.json({ error: "subject or body is required" }, { status: 400 });
    }

    const result = await classify(input);

    return NextResponse.json(result);
  } catch (err) {
    console.error("[api/ai/classify] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Classification failed" },
      { status: 500 },
    );
  }
}
