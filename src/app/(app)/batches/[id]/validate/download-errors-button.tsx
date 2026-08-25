"use client";

import type { RowValidationIssue } from "@/lib/validation/batch-schemas";

export function DownloadErrorsButton({
  issues,
  fileName,
}: {
  issues: RowValidationIssue[];
  fileName: string;
}) {
  function handleDownload() {
    const header = "Row,Field,Severity,Message";
    const rows = issues.map(
      (i) =>
        `${i.rowNumber},"${(i.field ?? "").replace(/"/g, '""')}","${i.severity}","${i.message.replace(/"/g, '""')}"`,
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${fileName.replace(/\s+/g, "_")}_validation_errors.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
    >
      Download errors as CSV
    </button>
  );
}
