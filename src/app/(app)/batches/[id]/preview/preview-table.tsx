"use client";

import { useState } from "react";

interface ItemRow {
  id: string;
  awb: string;
  consignee_name: string | null;
  consignee_email: string;
  attachment_status: string | null;
}

const PAGE_SIZE = 50;

export function PreviewTable({ rows, phase, isConsol }: { rows: ItemRow[]; phase: string; isConsol?: boolean }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(rows.length / PAGE_SIZE);
  const pageItems = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (rows.length === 0) return null;

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">AWB</th>
              <th className="px-4 py-3">Consignee</th>
              <th className="px-4 py-3">Email</th>
              {phase === "pre_alert" && !isConsol && <th className="px-4 py-3">Attachment</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageItems.map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{row.awb}</td>
                <td className="px-4 py-3 text-slate-500">{row.consignee_name ?? "—"}</td>
                <td className="px-4 py-3 text-slate-500">{row.consignee_email}</td>
                {phase === "pre_alert" && !isConsol && (
                  <td className="px-4 py-3">
                    {row.attachment_status === "matched" || row.attachment_status === "converted" ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">attached</span>
                    ) : (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">missing</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, rows.length)} of {rows.length}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
