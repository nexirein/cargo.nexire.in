import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WizardSteps } from "@/components/batches/wizard-steps";
import { assertStep } from "@/lib/batches/guard-step";
import { AttachmentsUploader } from "./attachments-uploader";

export default async function BatchAttachmentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: batch } = await supabase
    .from("batch_runs")
    .select("id, run_name, status, phase, pre_alert_type")
    .eq("id", id)
    .maybeSingle();

  if (!batch) {
    notFound();
  }

  assertStep(id, "attachments", batch.status, batch.phase ?? "pre_alert");

  const phase: string = (batch as any).phase ?? "pre_alert";
  const preAlertType: string = (batch as any).pre_alert_type ?? "u_bond";
  if (phase === "post_arrival") redirect(`/batches/${id}/preview`);
  if (phase === "tp_hold") redirect(`/batches/${id}/summary`);
  if (phase === "pre_alert" && preAlertType === "consol") redirect(`/batches/${id}/preview`);

  const { data: items } = await supabase
    .from("batch_items")
    .select("id, awb, consignee_name, attachment_status")
    .eq("batch_run_id", id)
    .order("awb");

  return (
    <div>
      <WizardSteps current="attachments" phase={phase} preAlertType={batch.pre_alert_type} />
      <h1 className="mt-4 text-2xl font-semibold text-slate-900">
        {batch.run_name}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Upload invoice files and match them to each AWB.
      </p>
      <AttachmentsUploader batchRunId={id} initialItems={items ?? []} />
      <div className="mt-6">
        <Link
          href={`/batches/${id}/review`}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← Back to review
        </Link>
      </div>
    </div>
  );
}
