"use server";

import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/log";
import { createBatchSchema } from "@/lib/validation/batch-schemas";
import { todayIsoDate } from "@/lib/batches/naming";

export async function createBatch(formData: FormData) {
  const user = requireRole(
    await getCurrentAppUser(),
    "admin",
    "lead",
    "operator",
  );

  const parsed = createBatchSchema.safeParse({
    runName: formData.get("runName"),
    mailboxConfigId: formData.get("mailboxConfigId"),
    subBatchSize: Number(formData.get("subBatchSize") ?? 25),
  });

  if (!parsed.success) {
    redirect(
      `/batches/new?error=${encodeURIComponent(
        parsed.error.issues[0]?.message ?? "Invalid input.",
      )}`,
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
    redirect(
      `/batches/new?error=${encodeURIComponent(
        error?.message ?? "Could not create batch.",
      )}`,
    );
  }

  await logAudit({
    actorUserId: user.id,
    entityType: "batch_runs",
    entityId: data!.id,
    action: "create",
    metadata: { runName: parsed.data.runName },
  });

  redirect(`/batches/${data!.id}/mapping`);
}
