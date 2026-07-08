import "server-only";
import type { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * Applies `patch` to an awb_cases row only if its version still matches
 * `expectedVersion`. A DB trigger bumps `version` on every update to this
 * table, so a stale-version WHERE clause alone is enough to catch every
 * conflict — including "someone else already claimed/assigned/updated
 * this since you last read it" — without a separate business-rule
 * precondition in the same statement. Returns `null` on conflict (zero
 * rows matched); the caller re-fetches the current row to report why.
 */
export async function updateCaseWithVersion(
  admin: AdminClient,
  caseId: string,
  expectedVersion: number,
  patch: Record<string, unknown>,
) {
  const { data, error } = await admin
    .from("awb_cases")
    .update(patch)
    .eq("id", caseId)
    .eq("version", expectedVersion)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}
