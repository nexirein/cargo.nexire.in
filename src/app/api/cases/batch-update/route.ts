import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { handleRouteError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateCaseWithVersion } from "@/lib/cases/optimistic-update";
import { logAudit } from "@/lib/audit/log";

const schema = z.object({
  caseIds: z.array(z.string().uuid()).min(1, "Select at least one case."),
  currentStatus: z.string().min(1, "Select a status."),
});

export async function POST(request: Request) {
  try {
    const user = requireRole(
      await getCurrentAppUser(),
      "admin",
      "lead",
      "operator",
    );
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const now = new Date().toISOString();

    const { data: cases } = await admin
      .from("awb_cases")
      .select("id, version, current_status")
      .in("id", parsed.data.caseIds);

    let succeeded = 0;
    let failed = 0;
    const errors: { id: string; error: string }[] = [];

    for (const c of cases ?? []) {
      const patch = {
        current_status: parsed.data.currentStatus,
        last_human_action_at: now,
        human_ever_opened: true,
      };
      const updated = await updateCaseWithVersion(admin, c.id, c.version, patch);
      if (updated) {
        succeeded++;
        await admin.rpc("increment_case_counter", {
          p_case_id: c.id,
          p_column: "human_actions_count",
        });
        await admin.from("case_updates").insert({
          case_id: c.id,
          updated_by: user.id,
          actor_type: "human",
          update_type: "status_change",
          old_values: { current_status: c.current_status },
          new_values: { current_status: parsed.data.currentStatus },
        });
      } else {
        failed++;
        errors.push({ id: c.id, error: "Version conflict — refresh and retry." });
      }
    }

    await logAudit({
      actorUserId: user.id,
      entityType: "awb_cases",
      entityId: null,
      action: "batch_update_status",
      metadata: {
        requested: parsed.data.caseIds.length,
        succeeded,
        failed,
        newStatus: parsed.data.currentStatus,
      },
    });

    return NextResponse.json({ succeeded, failed, errors });
  } catch (error) {
    return handleRouteError(error);
  }
}
