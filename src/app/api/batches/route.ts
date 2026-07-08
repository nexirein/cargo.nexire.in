import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { handleRouteError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/log";
import { createBatchSchema } from "@/lib/validation/batch-schemas";
import { todayIsoDate } from "@/lib/batches/naming";

export async function POST(request: Request) {
  try {
    const user = requireRole(
      await getCurrentAppUser(),
      "admin",
      "lead",
      "operator",
    );
    const body = await request.json();
    const parsed = createBatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("batch_runs")
      .insert({
        run_name: parsed.data.runName,
        run_date: todayIsoDate(),
        mailbox_config_id: parsed.data.mailboxConfigId,
        created_by: user.id,
        sub_batch_size: parsed.data.subBatchSize,
        status: "draft",
      })
      .select("id")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Could not create batch." },
        { status: 500 },
      );
    }

    await logAudit({
      actorUserId: user.id,
      entityType: "batch_runs",
      entityId: data.id,
      action: "create",
      metadata: { runName: parsed.data.runName },
    });

    return NextResponse.json({ id: data.id });
  } catch (error) {
    return handleRouteError(error);
  }
}
