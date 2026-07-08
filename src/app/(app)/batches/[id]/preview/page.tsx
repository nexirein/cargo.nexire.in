import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WizardSteps } from "@/components/batches/wizard-steps";
import { LaunchButton } from "./launch-button";

export default async function BatchPreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: batch } = await supabase
    .from("batch_runs")
    .select("id, run_name, status, total_rows, total_sub_batches")
    .eq("id", id)
    .maybeSingle();

  if (!batch) {
    notFound();
  }

  const { data: items } = await supabase
    .from("batch_items")
    .select("id, awb, consignee_name, consignee_email, attachment_status")
    .eq("batch_run_id", id)
    .order("awb");

  const rows = items ?? [];
  const attached = rows.filter(
    (r) =>
      r.attachment_status === "matched" || r.attachment_status === "converted",
  ).length;
  const missing = rows.length - attached;

  return (
    <div>
      <WizardSteps current="preview" />
      <h1 className="mt-4 text-2xl font-semibold text-slate-900">
        {batch.run_name}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Review everything before launching the send.
      </p>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <SummaryCard label="Recipients" value={rows.length} />
        <SummaryCard label="Sub-batches" value={batch.total_sub_batches} />
        <SummaryCard label="With attachment" value={attached} />
        <SummaryCard
          label="Missing attachment"
          value={missing}
          warn={missing > 0}
        />
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">AWB</th>
              <th className="px-4 py-3">Consignee</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Attachment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.slice(0, 25).map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 font-medium text-slate-900">
                  {row.awb}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {row.consignee_name ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {row.consignee_email}
                </td>
                <td className="px-4 py-3">
                  {row.attachment_status === "matched" ||
                  row.attachment_status === "converted" ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      attached
                    </span>
                  ) : (
                    <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                      missing
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > 25 ? (
          <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
            Showing 25 of {rows.length} recipients.
          </p>
        ) : null}
      </div>

      <div className="mt-6">
        <LaunchButton batchRunId={id} status={batch.status} />
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
