import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { WizardSteps } from "@/components/batches/wizard-steps";
import { SendProgress } from "./send-progress";

export default async function BatchSendPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getCurrentAppUser();

  const [{ data: batchRun }, { data: items }, { data: subBatches }] =
    await Promise.all([
      supabase
        .from("batch_runs")
        .select(
          "id, run_name, status, total_rows, total_sub_batches, sent_count, failed_count",
        )
        .eq("id", id)
        .maybeSingle(),
      supabase
        .from("batch_items")
        .select(
          "id, awb, consignee_name, consignee_email, attachment_status, send_status, failure_reason",
        )
        .eq("batch_run_id", id)
        .order("awb"),
      supabase
        .from("sub_batches")
        .select("id, sub_batch_index, status, total_items, sent_count, failed_count")
        .eq("batch_run_id", id)
        .order("sub_batch_index"),
    ]);

  if (!batchRun) {
    notFound();
  }

  return (
    <div>
      <WizardSteps current="send" />
      <h1 className="mt-4 text-2xl font-semibold text-slate-900">
        {batchRun.run_name}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Sending updates live as each recipient is processed.
      </p>
      <SendProgress
        batchRunId={id}
        canRequeue={user?.role === "admin" || user?.role === "lead"}
        initial={{
          batchRun,
          items: items ?? [],
          subBatches: subBatches ?? [],
        }}
      />
    </div>
  );
}
