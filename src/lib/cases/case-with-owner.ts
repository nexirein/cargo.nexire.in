import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

export async function getCaseWithOwnerName(admin: AdminClient, caseId: string) {
  const { data: caseRow } = await admin
    .from("awb_cases")
    .select("*")
    .eq("id", caseId)
    .maybeSingle();

  if (!caseRow) return null;

  let ownerName: string | null = null;
  if (caseRow.owner_user_id) {
    const { data: owner } = await admin
      .from("app_users")
      .select("full_name, email")
      .eq("id", caseRow.owner_user_id)
      .maybeSingle();
    ownerName = owner?.full_name ?? owner?.email ?? null;
  }

  return { ...caseRow, ownerName };
}
