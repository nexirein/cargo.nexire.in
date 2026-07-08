import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WizardSteps } from "@/components/batches/wizard-steps";
import type { RowValidationIssue } from "@/lib/validation/batch-schemas";

export default async function BatchValidatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: batch } = await supabase
    .from("batch_runs")
    .select("id, run_name, status, total_rows, total_sub_batches, metadata")
    .eq("id", id)
    .maybeSingle();

  if (!batch) {
    notFound();
  }

  const issues = (batch.metadata?.validation_issues ??
    []) as RowValidationIssue[];
  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const validCount = batch.total_rows - errorCount;
  const failed = batch.status === "failed";

  return (
    <div>
      <WizardSteps current="validate" />
      <h1 className="mt-4 text-2xl font-semibold text-slate-900">
        {batch.run_name}
      </h1>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <SummaryCard label="Total rows" value={batch.total_rows} />
        <SummaryCard label="Valid rows" value={Math.max(validCount, 0)} />
        <SummaryCard
          label="Sub-batches"
          value={batch.total_sub_batches}
          hint={warningCount > 0 ? `${warningCount} warning(s)` : undefined}
        />
      </div>

      {failed ? (
        <p className="mt-6 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          No valid rows were found. Fix the sheet and upload it again.
        </p>
      ) : null}

      {issues.length > 0 ? (
        <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Row</th>
                <th className="px-4 py-3">Field</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Message</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {issues.map((issue, i) => (
                <tr key={i}>
                  <td className="px-4 py-3 text-slate-500">
                    {issue.rowNumber}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{issue.field}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        issue.severity === "error"
                          ? "bg-red-50 text-red-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {issue.severity}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">
                    {issue.message}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mt-6 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          No issues found — every row is ready to send.
        </p>
      )}

      <div className="mt-6 flex gap-3">
        {failed ? (
          <Link
            href={`/batches/${id}/mapping`}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Re-upload sheet
          </Link>
        ) : (
          <Link
            href={`/batches/${id}/attachments`}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Continue to attachments
          </Link>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
      {hint ? <p className="mt-1 text-xs text-amber-600">{hint}</p> : null}
    </div>
  );
}
