import "server-only";
import { NextResponse } from "next/server";
import { retrieveContext } from "@/lib/ai/rag";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const subject = body.subject ?? "";
    const bodyText = body.body ?? "";
    const clearanceType = body.clearance_type ?? null;
    const intent = body.intent ?? null;

    if (!subject && !bodyText) {
      return NextResponse.json({ error: "subject or body is required" }, { status: 400 });
    }

    const context = await retrieveContext(subject, bodyText, clearanceType, intent);

    return NextResponse.json(context);
  } catch (err) {
    console.error("[api/ai/similar] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Retrieval failed" },
      { status: 500 },
    );
  }
}
