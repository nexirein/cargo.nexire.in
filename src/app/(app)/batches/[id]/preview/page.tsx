import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WizardSteps } from "@/components/batches/wizard-steps";
import { assertStep } from "@/lib/batches/guard-step";
import { AutoLaunch } from "./auto-launch";
import { PreviewTable } from "./preview-table";

export default async function BatchPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: batch } = await supabase
    .from("batch_runs")
    .select("id, run_name, status, total_rows, total_sub_batches, phase, pre_alert_type")
    .eq("id", id)
    .maybeSingle();

  if (!batch) {
    notFound();
  }

  assertStep(id, "preview", batch.status, batch.phase ?? "pre_alert");

  const { data: items } = await supabase
    .from("batch_items")
    .select("id, awb, consignee_name, consignee_email, attachment_status")
    .eq("batch_run_id", id)
    .order("awb");

  const rows = items ?? [];
  const phase = batch.phase ?? "pre_alert";
  const preAlertType = batch.pre_alert_type ?? "u_bond";
  const isConsol = phase === "pre_alert" && preAlertType === "consol";
  const attached = rows.filter(
    (r) =>
      r.attachment_status === "matched" || r.attachment_status === "converted",
  ).length;
  const missing = rows.length - attached;

  return (
    <div>
      <WizardSteps current="preview" phase={phase} preAlertType={batch.pre_alert_type} />
      <h1 className="mt-4 text-2xl font-semibold text-slate-900">
        {batch.run_name}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Review everything before launching the send.
      </p>

      {!isConsol && phase === "pre_alert" ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
          <SummaryCard label="Recipients" value={rows.length} />
          <SummaryCard label="Sub-batches" value={batch.total_sub_batches} />
          <SummaryCard label="With attachment" value={attached} />
          <SummaryCard label="Missing attachment" value={missing} warn={missing > 0} />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SummaryCard label="Recipients" value={rows.length} />
          <SummaryCard label="Sub-batches" value={batch.total_sub_batches} />
        </div>
      )}

      <div className="mt-6">
        <PreviewTable rows={rows} phase={phase} isConsol={isConsol} />
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Link
          href={`/batches/${id}/${isConsol ? "review" : phase === "post_arrival" ? "validate" : "attachments"}`}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← Back to {isConsol ? "review" : phase === "post_arrival" ? "validate" : "attachments"}
        </Link>
        <AutoLaunch batchRunId={id} status={batch.status} itemCount={rows.length} missingAttachmentCount={missing} />
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  warn,
}: {
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p
        className={`mt-2 text-3xl font-semibold ${
          warn && value > 0 ? "text-amber-600" : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
