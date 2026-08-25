import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateFollowUpDraft } from "@/lib/ai/followup";
import type { ClearanceType, TriggerRule } from "@/lib/ai/types";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { followupId, awb, clearanceType, triggerRule, attemptNumber, maxAttempts, caseId } = body;

    if (!followupId || !awb || !triggerRule) {
      return NextResponse.json({ error: "followupId, awb, and triggerRule are required" }, { status: 400 });
    }

    const admin = createAdminClient();

    const draft = await generateFollowUpDraft({
      caseId,
      awb,
      clearanceType: clearanceType as ClearanceType,
      triggerRule: triggerRule as TriggerRule,
      attemptNumber: attemptNumber ?? 1,
      maxAttempts: maxAttempts ?? 3,
    });

    const { data: aiDraft } = await admin
      .from("ai_drafts")
      .insert({
        case_id: caseId ?? null,
        batch_id: null,
        trigger_type: "follow_up",
        trigger_reason: `Follow-up: ${triggerRule} (attempt ${attemptNumber ?? 1})`,
        subject: draft.subject,
        body_html: draft.bodyHtml,
        body_text: draft.bodyText,
        confidence: draft.confidence,
        flags: ["follow_up"],
        status: "pending",
      })
      .select("id")
      .single();

    if (aiDraft) {
      await admin
        .from("followup_schedules")
        .update({ draft_id: aiDraft.id, status: "draft_ready" })
        .eq("id", followupId);
    }

    return NextResponse.json({
      draft: {
        subject: draft.subject,
        body_text: draft.bodyText,
        body_html: draft.bodyHtml,
        confidence: draft.confidence,
      },
      draftId: aiDraft?.id,
    });
  } catch (error) {
    console.error("[ai/followups/generate-draft] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Generation failed" },
      { status: 500 },
    );
  }
}
