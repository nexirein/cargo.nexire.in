import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { handleRouteError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/log";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = requireRole(await getCurrentAppUser(), "admin", "lead", "operator");
    const { id } = await params;
    const admin = createAdminClient();

    // Delete existing batch_items and sub_batches
    await admin.from("batch_items").delete().eq("batch_run_id", id);
    await admin.from("sub_batches").delete().eq("batch_run_id", id);

    // Reset batch_run status to draft
    await admin
      .from("batch_runs")
      .update({
        status: "draft",
        metadata: {},
        total_rows: 0,
        total_sub_batches: 0,
      })
      .eq("id", id);

    await logAudit({
      actorUserId: user.id,
      entityType: "batch_runs",
      entityId: id,
      action: "reset",
      metadata: { reason: "user re-upload" },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
