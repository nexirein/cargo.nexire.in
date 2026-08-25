"use client";

import { useState } from "react";
import Link from "next/link";

interface CaseInfo {
  id: string;
  current_status: string;
}

interface ItemRow {
  id: string;
  awb: string;
  consignee_name: string | null;
  consignee_email: string;
  send_status: string;
  attachment_status: string;
  failure_reason: string | null;
  caseInfo?: CaseInfo | null;
}

const PAGE_SIZE = 50;

export function PaginatedItemsTable({ items, batchId }: { items: ItemRow[]; batchId: string }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(items.length / PAGE_SIZE);
  const pageItems = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (items.length === 0) {
    return <p className="mt-4 text-sm text-slate-400">No items match the current filter.</p>;
  }

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">AWB</th>
              <th className="px-4 py-3">Consignee</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Send</th>
              <th className="px-4 py-3">Attachment</th>
              <th className="px-4 py-3">Reply</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pageItems.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 font-medium text-slate-900">{item.awb}</td>
                <td className="px-4 py-3 text-slate-500">{item.consignee_name ?? "—"}</td>
                <td className="px-4 py-3 text-slate-500">{item.consignee_email}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[item.send_status] ?? "bg-slate-100 text-slate-500"}`}
                    title={item.failure_reason ?? ""}>
                    {item.send_status === "sent" ? "Sent" : item.send_status === "failed" ? `Failed: ${item.failure_reason?.slice(0, 40) ?? ""}` : item.send_status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ATTACHMENT_COLORS[item.attachment_status] ?? "bg-slate-100 text-slate-500"}`}>
                    {item.attachment_status.replace(/_/g, " ")}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {item.caseInfo ? (
                    <Link href={`/cases/${item.caseInfo.id}`} className="text-xs font-medium text-emerald-600 hover:text-emerald-800">
                      {item.caseInfo.current_status === "reply_received" ? "Replied" : item.caseInfo.current_status === "awaiting_reply" ? "Awaiting" : item.caseInfo.current_status}
                    </Link>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  {item.caseInfo ? (
                    <Link href={`/cases/${item.caseInfo.id}`} className="text-xs font-medium text-slate-600 hover:text-slate-900">View</Link>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, items.length)} of {items.length}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  sent: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
  pending: "bg-slate-100 text-slate-500",
  queued: "bg-blue-50 text-blue-700",
  retrying: "bg-amber-50 text-amber-700",
};

const ATTACHMENT_COLORS: Record<string, string> = {
  matched: "bg-emerald-50 text-emerald-700",
  converted: "bg-emerald-50 text-emerald-700",
  pending: "bg-slate-100 text-slate-500",
  missing: "bg-red-50 text-red-700",
  manual_needed: "bg-amber-50 text-amber-700",
};
