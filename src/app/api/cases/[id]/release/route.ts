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

const schema = z.object({ version: z.number().int() });

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
        { error: "A version is required." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const current = await getCaseWithOwnerName(admin, id);
    if (!current) {
      return NextResponse.json({ error: "Case not found." }, { status: 404 });
    }
    if (current.ownership_status === "unassigned") {
      return NextResponse.json(
        { error: "This case is not currently claimed." },
        { status: 400 },
      );
    }

    const isOwner = assertOwnerOrOverride(current, user);

    const updated = await updateCaseWithVersion(admin, id, parsed.data.version, {
      owner_user_id: null,
      ownership_status: "unassigned",
      released_at: new Date().toISOString(),
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
      from_user_id: current.owner_user_id,
      to_user_id: null,
      assignment_type: isOwner ? "release" : "override",
    });
    await admin.from("case_updates").insert({
      case_id: id,
      updated_by: user.id,
      update_type: "release",
      old_values: {
        ownership_status: current.ownership_status,
        owner_user_id: current.owner_user_id,
      },
      new_values: { ownership_status: "unassigned" },
    });
    await logAudit({
      actorUserId: user.id,
      entityType: "awb_cases",
      entityId: id,
      action: "release",
      metadata: {},
    });

    return NextResponse.json({ case: updated });
  } catch (error) {
    return handleRouteError(error);
  }
}
