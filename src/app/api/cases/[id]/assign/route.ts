import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { handleRouteError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateCaseWithVersion } from "@/lib/cases/optimistic-update";
import { getCaseWithOwnerName } from "@/lib/cases/case-with-owner";
import { assertOwnerOrOverride } from "@/lib/cases/authorize-case-action";
import { logAudit } from "@/lib/audit/log";

const schema = z.object({
  version: z.number().int(),
  toUserId: z.string().uuid(),
  reason: z.string().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = requireRole(
      await getCurrentAppUser(),
      "admin",
      "lead",
      "operator",
    );
    const { id } = await params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const current = await getCaseWithOwnerName(admin, id);
    if (!current) {
      return NextResponse.json({ error: "Case not found." }, { status: 404 });
    }

    assertOwnerOrOverride(current, user);

    const updated = await updateCaseWithVersion(admin, id, parsed.data.version, {
      owner_user_id: parsed.data.toUserId,
      ownership_status: "assigned",
      assigned_by_user_id: user.id,
      last_human_action_at: new Date().toISOString(),
    });

    if (!updated) {
      const fresh = await getCaseWithOwnerName(admin, id);
      return NextResponse.json(
        {
          error: `This case was updated by ${
            fresh?.ownerName ?? "someone else"
          }; refresh to continue.`,
          current: fresh,
        },
        { status: 409 },
      );
    }

    await admin.from("case_assignments").insert({
      case_id: id,
      from_user_id: user.id,
      to_user_id: parsed.data.toUserId,
      assignment_type: "assign",
      reason: parsed.data.reason ?? null,
    });
    await admin.from("case_updates").insert({
      case_id: id,
      updated_by: user.id,
      update_type: "assign",
      old_values: { owner_user_id: current.owner_user_id },
      new_values: { owner_user_id: parsed.data.toUserId },
      remarks: parsed.data.reason ?? null,
    });
    await logAudit({
      actorUserId: user.id,
      entityType: "awb_cases",
      entityId: id,
      action: "assign",
      metadata: { toUserId: parsed.data.toUserId },
    });

    return NextResponse.json({ case: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}
