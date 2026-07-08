import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { handleRouteError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateCaseWithVersion } from "@/lib/cases/optimistic-update";
import { getCaseWithOwnerName } from "@/lib/cases/case-with-owner";
import { acquireLock, releaseLock } from "@/lib/redis/locks";
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

    // Fast-fail UX nicety for the highest-contention action — correctness
    // is still guaranteed below by the versioned UPDATE regardless of
    // whether this lock is held.
    const lockKey = `lock:case:${id}`;
    const gotLock = await acquireLock(lockKey, 5_000);
    if (!gotLock) {
      return NextResponse.json(
        { error: "Someone else is claiming this case right now — try again in a moment." },
        { status: 409 },
      );
    }

    try {
      const current = await getCaseWithOwnerName(admin, id);
      if (!current) {
        return NextResponse.json({ error: "Case not found." }, { status: 404 });
      }
      if (current.ownership_status !== "unassigned") {
        return NextResponse.json(
          {
            error: `This case is already ${current.ownership_status}${
              current.ownerName ? ` (${current.ownerName})` : ""
            }.`,
            current,
          },
          { status: 409 },
        );
      }

      const now = new Date().toISOString();
      const updated = await updateCaseWithVersion(admin, id, parsed.data.version, {
        owner_user_id: user.id,
        ownership_status: "claimed",
        claimed_at: now,
        released_at: null,
        last_human_action_at: now,
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
        from_user_id: null,
        to_user_id: user.id,
        assignment_type: "claim",
      });
      await admin.from("case_updates").insert({
        case_id: id,
        updated_by: user.id,
        update_type: "claim",
        old_values: { ownership_status: "unassigned" },
        new_values: { ownership_status: "claimed", owner_user_id: user.id },
      });
      await logAudit({
        actorUserId: user.id,
        entityType: "awb_cases",
        entityId: id,
        action: "claim",
        metadata: {},
      });

      return NextResponse.json({ case: updated });
    } finally {
      await releaseLock(lockKey);
    }
  } catch (error) {
    return handleRouteError(error);
  }
}
