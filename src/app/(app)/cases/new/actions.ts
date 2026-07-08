"use server";

import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/log";

export async function createTestCase(formData: FormData) {
  const user = requireRole(await getCurrentAppUser(), "admin");
  const awb = String(formData.get("awb") ?? "").trim();

  if (!awb) {
    redirect(`/cases/new?error=${encodeURIComponent("AWB is required.")}`);
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("awb_cases")
    .upsert(
      { awb, current_status: "awaiting_reply" },
      { onConflict: "awb" },
    )
    .select("id")
    .single();

  if (error || !data) {
    redirect(
      `/cases/new?error=${encodeURIComponent(
        error?.message ?? "Could not create case.",
      )}`,
    );
  }

  await logAudit({
    actorUserId: user.id,
    entityType: "awb_cases",
    entityId: data!.id,
    action: "create_test_case",
    metadata: { awb },
  });

  redirect(`/cases/${data!.id}`);
}
