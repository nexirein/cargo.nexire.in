import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { handleRouteError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/log";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = requireRole(
      await getCurrentAppUser(),
      "admin",
      "lead",
    );
    const { id } = await params;
    const admin = createAdminClient();

    const { data: batch } = await admin
      .from("batch_runs")
      .select("id")
      .eq("id", id)
      .single();

    if (!batch) {
      return NextResponse.json({ error: "Batch not found." }, { status: 404 });
    }

    const { data: itemIds } = await admin
      .from("batch_items")
      .select("id")
      .eq("batch_run_id", id);

    const ids = (itemIds ?? []).map((i: { id: string }) => i.id);

    if (ids.length > 0) {
      await admin.from("call_tasks").delete().in("batch_item_id", ids);
    }

    await admin.from("batch_items").delete().eq("batch_run_id", id);
    await admin.from("batch_runs").delete().eq("id", id);

    await logAudit({
      actorUserId: user.id,
      entityType: "batch_runs",
      entityId: id,
      action: "clearance_fill_delete",
      metadata: { deletedAt: new Date().toISOString() },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
