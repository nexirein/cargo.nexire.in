"use client";

import type { EmailStatus } from "@/lib/validation/batch-schemas";

export function EmailIssuesPanel({
  statuses,
  batchName,
}: {
  statuses: EmailStatus[];
  batchName: string;
}) {
  const withIssues = statuses.filter((s) => s.hasIssue);
  if (withIssues.length === 0) return null;

  function handleExport() {
    const header = "Row,AWB,Raw Value,Valid Emails";
    const rows = withIssues.map(
      (s) =>
        `${s.rowNumber},"${s.awb}","${(s.rawValue || "").replace(/"/g, '""')}","${s.validCount}"`,
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${batchName.replace(/\s+/g, "_")}_missing_emails.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="mt-6 rounded-xl border border-red-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-red-800">
            Missing / invalid emails ({withIssues.length} rows)
          </p>
          <p className="mt-1 text-xs text-red-600">
            These rows have no valid email addresses and will fail to send.
          </p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-600 transition hover:bg-red-50"
        >
          Export as CSV
        </button>
      </div>

      <div className="mt-3 max-h-80 overflow-y-auto rounded-lg border border-red-100">
        <table className="min-w-full divide-y divide-red-100 text-xs">
          <thead className="bg-red-50 text-left font-medium uppercase tracking-wide text-red-700">
            <tr>
              <th className="px-3 py-2">Row</th>
              <th className="px-3 py-2">AWB</th>
              <th className="px-3 py-2">Raw email value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-red-50">
            {withIssues.map((s) => (
              <tr key={s.rowNumber} className="hover:bg-red-50/50">
                <td className="whitespace-nowrap px-3 py-2 text-slate-500">
                  {s.rowNumber}
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-medium text-slate-900">
                  {s.awb}
                </td>
                <td className="max-w-xs truncate px-3 py-2 text-slate-600" title={s.rawValue}>
                  {s.rawValue || (
                    <span className="italic text-slate-400">(empty)</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
