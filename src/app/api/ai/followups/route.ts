import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scheduleFollowUp, processDueFollowUps } from "@/lib/ai/followup";
import type { ClearanceType, TriggerRule } from "@/lib/ai/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const action = body.action ?? "schedule";

    if (action === "schedule") {
      const input = {
        caseId: body.case_id,
        awb: body.awb,
        clearanceType: body.clearance_type as ClearanceType,
        triggerRule: body.trigger_rule as TriggerRule,
        attemptNumber: body.attempt_number ?? 1,
        maxAttempts: body.max_attempts ?? 3,
      };

      if (!input.caseId || !input.awb || !input.triggerRule) {
        return NextResponse.json(
          { error: "case_id, awb, and trigger_rule are required" },
          { status: 400 },
        );
      }

      await scheduleFollowUp(input);
      return NextResponse.json({ success: true });
    }

    if (action === "process_due") {
      await processDueFollowUps();
      return NextResponse.json({ success: true });
    }

    if (action === "list") {
      const supabase = createAdminClient();
      const status = body.status ?? "draft_ready";
      const limit = body.limit ?? 20;

      const { data, error } = await supabase
        .from("followup_schedules")
        .select("*")
        .eq("status", status)
        .order("scheduled_at", { ascending: true })
        .limit(limit);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json(data ?? []);
    }

    if (action === "update") {
      const supabase = createAdminClient();
      const { id, status } = body;

      if (!id || !status) {
        return NextResponse.json({ error: "id and status are required" }, { status: 400 });
      }

      const { error } = await supabase
        .from("followup_schedules")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", id);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err) {
    console.error("[api/ai/followups] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Follow-up operation failed" },
      { status: 500 },
    );
  }
}
