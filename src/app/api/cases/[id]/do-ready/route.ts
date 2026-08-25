import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { handleRouteError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateCaseWithVersion } from "@/lib/cases/optimistic-update";
import { getCaseWithOwnerName } from "@/lib/cases/case-with-owner";
import { assertOwnerOrOverride } from "@/lib/cases/authorize-case-action";
import { logAudit } from "@/lib/audit/log";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = requireRole(await getCurrentAppUser(), "admin", "lead", "operator");
    const { id } = await params;

    const admin = createAdminClient();
    const current = await getCaseWithOwnerName(admin, id);
    if (!current) {
      return NextResponse.json({ error: "Case not found." }, { status: 404 });
    }

    assertOwnerOrOverride(current, user);

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      current_status: "do_ready",
      do_ready_at: now,
      last_human_action_at: now,
    };

    const updated = await updateCaseWithVersion(admin, id, current.version, patch);
    if (!updated) {
      const fresh = await getCaseWithOwnerName(admin, id);
      return NextResponse.json(
        {
          error: `This case was updated by ${fresh?.ownerName ?? "someone else"}; refresh to continue.`,
          current: fresh,
        },
        { status: 409 },
      );
    }

    await admin.from("case_updates").insert({
      case_id: id,
      updated_by: user.id,
      update_type: "do_ready",
      old_values: { current_status: current.current_status },
      new_values: patch,
    });

    await logAudit({
      actorUserId: user.id,
      entityType: "awb_cases",
      entityId: id,
      action: "do_ready",
      metadata: {},
    });

    return NextResponse.json({ case: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}
