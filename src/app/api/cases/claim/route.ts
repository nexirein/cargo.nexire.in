import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAppUser } from "@/lib/auth/session";
import { logAudit } from "@/lib/audit/log";

export async function POST(request: NextRequest) {
  const user = await getCurrentAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { caseIds } = await request.json();

  if (!Array.isArray(caseIds) || caseIds.length === 0) {
    return NextResponse.json(
      { error: "caseIds must be a non-empty array" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();
  const results = [];

  for (const caseId of caseIds) {
    const { data: existing } = await admin
      .from("awb_cases")
      .select("id, awb, owner_user_id, ownership_status")
      .eq("id", caseId)
      .maybeSingle();

    if (!existing) {
      results.push({ caseId, status: "skipped", reason: "Not found" });
      continue;
    }

    if (existing.owner_user_id) {
      results.push({
        caseId,
        status: "skipped",
        reason: "Already assigned",
        owner: existing.owner_user_id,
      });
      continue;
    }

    const { error: updateErr } = await admin
      .from("awb_cases")
      .update({
        owner_user_id: user.id,
        ownership_status: "claimed",
        claimed_at: now,
        last_human_action_at: now,
        human_ever_opened: true,
      })
      .eq("id", caseId);

    if (updateErr) {
      results.push({ caseId, status: "error", reason: updateErr.message });
      continue;
    }

    await admin.rpc("increment_case_counter", {
      p_case_id: caseId,
      p_column: "human_actions_count",
    });

    await admin.from("case_updates").insert({
      case_id: caseId,
      updated_by: user.id,
      actor_type: "human",
      update_type: "claim",
      remarks: "Case claimed",
    }).maybeSingle();

    await logAudit({
      actorUserId: user.id,
      entityType: "awb_cases",
      entityId: caseId,
      action: "claimed",
      metadata: { awb: existing.awb },
    });

    results.push({ caseId, status: "claimed" });
  }

  return NextResponse.json({
    claimed: results.filter((r) => r.status === "claimed").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    errors: results.filter((r) => r.status === "error").length,
    results,
  });
}
