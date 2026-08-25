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
  action: z.enum([
    "assessment_pending",
    "duty_assessed",
    "out_of_charge",
  ]),
  dutyAmount: z.number().positive().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = requireRole(await getCurrentAppUser(), "admin", "lead", "operator");
    const { id } = await params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const current = await getCaseWithOwnerName(admin, id);
    if (!current) {
      return NextResponse.json({ error: "Case not found." }, { status: 404 });
    }

    assertOwnerOrOverride(current, user);

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      current_status: parsed.data.action,
      last_human_action_at: now,
    };

    if (parsed.data.action === "assessment_pending") {
      patch.assessment_pending_at = now;
    } else if (parsed.data.action === "duty_assessed") {
      patch.duty_assessed_at = now;
      if (parsed.data.dutyAmount !== undefined) {
        patch.duty_amount = parsed.data.dutyAmount;
      }
    } else if (parsed.data.action === "out_of_charge") {
      patch.out_of_charge_at = now;
    }

    const updated = await updateCaseWithVersion(admin, id, parsed.data.version, patch);
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
      update_type: parsed.data.action,
      old_values: { current_status: current.current_status },
      new_values: patch,
    });

    await logAudit({
      actorUserId: user.id,
      entityType: "awb_cases",
      entityId: id,
      action: parsed.data.action,
      metadata: { patch },
    });

    return NextResponse.json({ case: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}
