import "server-only";
import { NextResponse } from "next/server";
import { generateDraft } from "@/lib/ai/draft";
import type { DraftInput } from "@/lib/ai/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input: DraftInput = {
      subject: body.subject ?? "",
      body: body.body ?? "",
      sender: body.sender ?? "",
      awb: body.awb,
      consigneeName: body.consignee_name,
      broker: body.broker,
      doNumber: body.do_number,
      clearanceType: body.clearance_type,
      intent: body.intent ?? "inquiry",
      urgency: body.urgency ?? "normal",
    };

    if (!input.subject && !input.body) {
      return NextResponse.json({ error: "subject or body is required" }, { status: 400 });
    }

    const draft = await generateDraft(input);

    return NextResponse.json(draft);
  } catch (err) {
    console.error("[api/ai/draft-reply] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Draft generation failed" },
      { status: 500 },
    );
  }
}
