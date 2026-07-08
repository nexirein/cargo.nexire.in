import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WizardSteps } from "@/components/batches/wizard-steps";
import { StatusBadge } from "@/components/ui/status-badge";

export default async function BatchSummaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: batch } = await supabase
    .from("batch_runs")
    .select(
      "id, run_name, status, total_rows, sent_count, failed_count, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!batch) {
    notFound();
  }

  const { data: failedItems } = await supabase
    .from("batch_items")
    .select("id, awb, consignee_email, failure_reason")
    .eq("batch_run_id", id)
    .eq("send_status", "failed");

  return (
    <div>
      <WizardSteps current="summary" />
      <div className="mt-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">
          {batch.run_name}
        </h1>
        <StatusBadge status={batch.status} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Recipients" value={batch.total_rows} />
        <SummaryCard
          label="Sent successfully"
          value={batch.sent_count}
          tone="success"
        />
        <SummaryCard
          label="Failed"
          value={batch.failed_count}
          tone={batch.failed_count > 0 ? "danger" : undefined}
        />
      </div>

      {(failedItems ?? []).length > 0 ? (
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <p className="text-sm font-medium text-slate-900">
              Failed recipients
            </p>
          </div>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">AWB</th>
                <th className="px-4 py-3">Recipient</th>
                <th className="px-4 py-3">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(failedItems ?? []).map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {item.awb}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {item.consignee_email}
                  </td>
                  <td className="px-4 py-3 text-red-600">
                    {item.failure_reason ?? "Unknown error"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="mt-6 flex gap-3">
        <Link
          href="/batches"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Back to batches
        </Link>
        <Link
          href="/cases"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          View cases from this run
        </Link>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "success" | "danger";
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p
        className={`mt-2 text-3xl font-semibold ${
          tone === "success"
            ? "text-emerald-600"
            : tone === "danger"
              ? "text-red-600"
              : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
