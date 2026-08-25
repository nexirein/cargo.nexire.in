import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export async function getCasesDueForFollowUp() {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: jobs } = await admin
    .from("reminder_jobs")
    .select(`
      id,
      reminder_level,
      due_at,
      case_id,
      awb_cases!inner(
        awb,
        current_status,
        owner_user_id,
        latest_batch_run_id,
        batch_runs!latest_batch_run_id(
          mailbox_configs(
            operational_mailbox,
            tagged_mailbox,
            signature_html
          )
        )
      )
    `)
    .eq("status", "pending")
    .lte("due_at", now)
    .order("due_at", { ascending: true })
    .limit(50);

  return jobs ?? [];
}

export async function markJobAsSent(jobId: string) {
  const admin = createAdminClient();
  await admin
    .from("reminder_jobs")
    .update({ status: "sent", executed_at: new Date().toISOString() })
    .eq("id", jobId);
}

export async function markJobAsSkipped(jobId: string) {
  const admin = createAdminClient();
  await admin
    .from("reminder_jobs")
    .update({ status: "skipped", executed_at: new Date().toISOString() })
    .eq("id", jobId);
}

export async function markJobAsFailed(jobId: string, reason: string) {
  const admin = createAdminClient();
  await admin
    .from("reminder_jobs")
    .update({
      status: "failed",
      executed_at: new Date().toISOString(),
    })
    .eq("id", jobId);
}
