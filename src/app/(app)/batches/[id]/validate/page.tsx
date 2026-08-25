import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WizardSteps } from "@/components/batches/wizard-steps";
import { assertStep } from "@/lib/batches/guard-step";
import { DownloadErrorsButton } from "./download-errors-button";
import { BrokerResolutionPanel } from "./broker-resolution-panel";
import { UnresolvedCompaniesPanel } from "./unresolved-companies-panel";
import { EmailIssuesPanel } from "./email-issues-panel";
import { AutofillSummaryPanel } from "./autofill-summary-panel";
import { CLEARANCE_DISPLAY } from "@/lib/cases/clearance-type";
import type { RowValidationIssue, EmailStatus } from "@/lib/validation/batch-schemas";
import type { AutofillSummaryRow } from "./autofill-summary-panel";

interface IssueGroup {
  field: string;
  errors: number;
  warnings: number;
  samples: string[];
}

function groupIssues(issues: RowValidationIssue[]): IssueGroup[] {
  const map = new Map<string, IssueGroup>();
  for (const issue of issues) {
    const key = issue.field || "(general)";
    let group = map.get(key);
    if (!group) {
      group = { field: key, errors: 0, warnings: 0, samples: [] };
      map.set(key, group);
    }
    if (issue.severity === "error") group.errors++;
    else group.warnings++;
    if (group.samples.length < 3) {
      group.samples.push(`Row ${issue.rowNumber}: ${issue.message}`);
    }
  }
  return Array.from(map.values()).sort(
    (a, b) => b.errors + b.warnings - (a.errors + a.warnings),
  );
}

function uniqueErrorRows(issues: RowValidationIssue[]): number {
  return new Set(
    issues.filter((i) => i.severity === "error").map((i) => i.rowNumber),
  ).size;
}

export default async function BatchValidatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: batch } = await supabase
    .from("batch_runs")
    .select("id, run_name, status, total_rows, total_sub_batches, metadata, phase, pre_alert_type")
    .eq("id", id)
    .maybeSingle();

  if (!batch) {
    notFound();
  }

  assertStep(id, "validate", batch.status, batch.phase ?? "pre_alert");

  const issues = (batch.metadata?.validation_issues ??
    []) as RowValidationIssue[];
  const errorRowCount = uniqueErrorRows(issues);
  const warningCount = issues.filter((i) => i.severity === "warning").length;
  const validCount = batch.total_rows - errorRowCount;
  const failed = batch.status === "failed";
  const phase: string = (batch as any).phase ?? "pre_alert";
  const groups = groupIssues(issues);
  const ready = issues.length === 0;

  const clearanceTypeCounts = (batch.metadata?.clearance_type_counts ??
    {}) as Record<string, number>;
  const unresolvedCompanies = (batch.metadata?.unresolved_companies ??
    []) as { rowNumber: number; awb: string; companyName: string }[];
  const masterDataResolved = (batch.metadata?.master_data_resolved ??
    []) as { rowNumber: number; awb: string; companyName: string; clearanceType: string; source: string }[];
  const masterEmailsResolved = (batch.metadata?.master_emails_resolved ??
    []) as { rowNumber: number; awb: string; companyName: string; email: string }[];
  const brokerNeedsResolution = (batch.metadata?.broker_needs_resolution ??
    []) as { rowNumber: number; awb: string; companyName: string }[];
  const autofillSummary = (batch.metadata?.autofill_summary ??
    []) as AutofillSummaryRow[];
  const courierMoveCandidates = (batch.metadata?.courier_move_candidates ??
    []) as { rowNumber: number; awb: string; pieces: number; weightPerPiece: number }[];
  const emailStatuses = (batch.metadata?.email_statuses ??
    []) as EmailStatus[];
  const clearanceCounts = Object.entries(clearanceTypeCounts).filter(
    ([, count]) => count > 0,
  );
  const preAlertType: string = (batch as any).pre_alert_type ?? "u_bond";
  const isConsol = phase === "pre_alert" && preAlertType === "consol";

  return (
    <div>
      <WizardSteps current="validate" phase={batch.phase ?? "pre_alert"} preAlertType={batch.pre_alert_type} />
      <h1 className="mt-4 text-2xl font-semibold text-slate-900">
        {batch.run_name}
      </h1>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        <SummaryCard label="Total rows" value={batch.total_rows} color="slate" />
        <SummaryCard
          label="Valid rows"
          value={Math.max(validCount, 0)}
          color={validCount > 0 ? "emerald" : "slate"}
        />
        <SummaryCard
          label="Rows with errors"
          value={errorRowCount}
          color={errorRowCount > 0 ? "red" : "emerald"}
        />
        <SummaryCard
          label="Sub-batches"
          value={batch.total_sub_batches}
          hint={warningCount > 0 ? `${warningCount} warning(s)` : undefined}
          color="slate"
        />
      </div>

      {clearanceCounts.length > 0 ? (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-400">
            Clearance type breakdown
          </p>
          <div className="flex flex-wrap gap-2">
            {clearanceCounts.map(([type, count]) => {
              const style = CLEARANCE_DISPLAY[type];
              return (
                <span
                  key={type}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${
                    style?.bg ?? "bg-slate-100"
                  } ${style?.text ?? "text-slate-600"}`}
                >
                  {style?.dot ? (
                    <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                  ) : null}
                  {style?.label ?? type}
                  <span className="ml-0.5 font-semibold">{count}</span>
                </span>
              );
            })}
          </div>
        </div>
      ) : null}

      <BrokerResolutionPanel
        items={brokerNeedsResolution}
        batchId={id}
      />

      <AutofillSummaryPanel rows={autofillSummary} />

      <UnresolvedCompaniesPanel
        companies={unresolvedCompanies}
        masterResolved={masterDataResolved}
        masterEmails={masterEmailsResolved}
        batchId={id}
      />

      {isConsol && courierMoveCandidates.length > 0 && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-white p-5">
          <p className="mb-2 text-sm font-semibold text-amber-800">
            Cargo → Courier candidates ({courierMoveCandidates.length})
          </p>
          <p className="mb-3 text-xs text-amber-600">
            These items exceed the weight/piece threshold (&ge;10 pieces, &gt;70kg/piece).
            They can be moved to courier in the Review step.
          </p>
          <div className="flex flex-wrap gap-2">
            {courierMoveCandidates.map((c) => (
              <span
                key={c.rowNumber}
                className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-700"
              >
                Row {c.rowNumber}: {c.awb} — {c.pieces} pcs, ~{c.weightPerPiece.toFixed(1)} kg/pc
              </span>
            ))}
          </div>
        </div>
      )}

      <EmailIssuesPanel statuses={emailStatuses} batchName={batch.run_name} />

      {failed ? (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3">
          <p className="text-sm font-medium text-red-800">
            Validation failed — no valid rows found.
          </p>
          <p className="mt-1 text-sm text-red-600">
            {batch.total_rows > 0
              ? `All ${batch.total_rows} row(s) have errors. `
              : "The sheet appears to be empty or unreadable. "}
            Fix the issues below and upload the corrected sheet.
          </p>
        </div>
      ) : null}

      {issues.length > 0 ? (
        <>
          <div className="mt-6 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">
              Validation issues ({issues.length} total)
            </h2>
            <DownloadErrorsButton issues={issues} fileName={batch.run_name} />
          </div>

          <div className="mt-3 space-y-3">
            {groups.map((group) => (
              <div
                key={group.field}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white"
              >
                <div className="flex items-center justify-between bg-slate-50 px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-slate-900">
                      {group.field}
                    </span>
                    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                      {group.errors} error{group.errors !== 1 ? "s" : ""}
                    </span>
                    {group.warnings > 0 ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        {group.warnings} warning{group.warnings !== 1 ? "s" : ""}
                      </span>
                    ) : null}
                  </div>
                  <span className="text-xs text-slate-400">
                    {group.errors + group.warnings} issue
                    {group.errors + group.warnings !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="px-4 pb-2">
                  {group.samples.map((sample, i) => (
                    <p key={i} className="py-1 text-xs text-slate-600">
                      {sample}
                    </p>
                  ))}
                  {group.errors + group.warnings > 3 ? (
                    <p className="py-1 text-xs text-slate-400">
                      +{group.errors + group.warnings - 3} more
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {!failed ? (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs font-medium text-slate-400 hover:text-slate-600">
                Show all {issues.length} issues
              </summary>
              <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
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
                        <td className="px-4 py-3 text-slate-500">
                          {issue.field}
                        </td>
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
            </details>
          ) : null}
        </>
      ) : (
        <div className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p className="text-sm font-medium text-emerald-800">
            All rows passed validation
          </p>
          <p className="mt-1 text-sm text-emerald-600">
            {batch.total_rows} row{batch.total_rows !== 1 ? "s" : ""} ready to send.
          </p>
        </div>
      )}

      <div className="mt-8 flex gap-3">
        {failed ? (
          <Link
            href={`/batches/${id}/mapping`}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Re-upload sheet
          </Link>
        ) : !ready ? (
          <Link
            href={`/batches/${id}/mapping`}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Upload corrected sheet
          </Link>
        ) : null}
        {!failed ? (
          phase === "tp_hold" ? (
            <Link
              href={`/batches/${id}/summary`}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Go to summary
            </Link>
          ) : phase === "post_arrival" ? (
            <Link
              href={`/batches/${id}/preview`}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Continue to preview
            </Link>
          ) : (
            <Link
            href={`/batches/${id}/review`}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
              Continue to review
            </Link>
          )
        ) : null}
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color = "slate",
  hint,
}: {
  label: string;
  value: number;
  color?: "slate" | "emerald" | "red";
  hint?: string;
}) {
  const colorClasses = {
    slate: "text-slate-900",
    emerald: "text-emerald-700",
    red: "text-red-700",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${colorClasses[color]}`}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-xs text-amber-600">{hint}</p> : null}
    </div>
  );
}
