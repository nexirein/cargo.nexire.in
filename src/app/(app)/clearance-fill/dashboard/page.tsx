"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart3, CheckCircle2, Phone, Smartphone, Download,
  Eye, Search, TrendingUp, TrendingDown, Clock, RefreshCw,
  AlertCircle, X, FileSpreadsheet, Trash2,
} from "lucide-react";
import Link from "next/link";

interface BatchHistory {
  id: string;
  name: string;
  date: string;
  createdAt: string;
  totalItems: number;
  resolvedItems: number;
  needingCall: number;
  noPhone: number;
  totalCalls: number;
  callsDone: number;
  callsInProgress: number;
  callsPending: number;
  callsSkipped: number;
  callsFailed: number;
  answerRate: number;
}

interface HistoryResult {
  batches: BatchHistory[];
  overall: {
    totalBatches: number;
    totalItems: number;
    totalCalls: number;
    totalCallsDone: number;
    totalCallsFailed: number;
    overallAnswerRate: number;
  };
}

function formatDate(d: string) {
  try { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit" }); }
  catch { return d; }
}

export default function ClearanceDashboardPage() {
  const [history, setHistory] = useState<HistoryResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/clearance-fill/history");
      if (res.ok) setHistory(await res.json());
    } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  const filtered = history?.batches.filter((b) =>
    !search || b.name.toLowerCase().includes(search.toLowerCase()) || b.date.includes(search)
  ) ?? [];

  const autoFillRate = history && history.overall.totalItems > 0
    ? Math.round(
        filtered.reduce((s, b) => s + b.resolvedItems - b.callsDone, 0) /
        filtered.reduce((s, b) => s + b.totalItems, 0) * 100
      )
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <RefreshCw className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Clearance Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">
            Overview of all clearance fill batches, call results, and exports.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/clearance-fill"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <FileSpreadsheet className="h-4 w-4" />
            New Batch
          </Link>
          <button
            onClick={loadHistory}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {/* Overall Stats */}
      {history && (
        <div className="mb-6 grid grid-cols-5 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Batches</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{history.overall.totalBatches}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Items Processed</p>
            <p className="mt-1 text-2xl font-semibold text-slate-900">{history.overall.totalItems.toLocaleString()}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-white p-5">
            <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-amber-600">
              <Phone className="h-3 w-3" /> AI Calls Made
            </p>
            <p className="mt-1 text-2xl font-semibold text-amber-700">{history.overall.totalCalls}</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-white p-5">
            <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-emerald-600">
              <CheckCircle2 className="h-3 w-3" /> Answered
            </p>
            <p className="mt-1 text-2xl font-semibold text-emerald-700">{history.overall.totalCallsDone}</p>
            <p className="text-xs text-emerald-500">{history.overall.overallAnswerRate}% answer rate</p>
          </div>
          <div className="rounded-xl border border-sky-200 bg-white p-5">
            <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-sky-600">
              <TrendingUp className="h-3 w-3" /> Auto-Fill Rate
            </p>
            <p className="mt-1 text-2xl font-semibold text-sky-700">{autoFillRate}%</p>
            <p className="text-xs text-sky-500">resolved without AI calls</p>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by batch name or date..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-slate-300 py-2 pl-10 pr-4 text-sm focus:border-sky-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Batch List */}
      {filtered.length > 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Batch</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Auto-Resolved</th>
                  <th className="px-4 py-3">Needed Call</th>
                  <th className="px-4 py-3">Calls</th>
                  <th className="px-4 py-3">Answered</th>
                  <th className="px-4 py-3">Missed / No Phone</th>
                  <th className="px-4 py-3">Rate</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">{formatDate(b.date)}</td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-sm text-slate-700" title={b.name}>{b.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-900">{b.totalItems}</td>
                    <td className="px-4 py-3 text-sm text-emerald-600">{b.resolvedItems}</td>
                    <td className="px-4 py-3 text-sm text-amber-600">{b.needingCall}</td>
                    <td className="px-4 py-3 text-sm text-slate-900">{b.totalCalls}</td>
                    <td className="px-4 py-3 text-sm text-emerald-600">{b.callsDone}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className="text-red-500">{b.callsFailed + b.callsSkipped}</span>
                      {b.noPhone > 0 && <span className="ml-1 text-slate-400">({b.noPhone} no ph)</span>}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        b.answerRate >= 60 ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                      }`}>
                        {b.answerRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <Link
                          href={`/clearance-fill/dashboard/${b.id}`}
                          className="rounded p-1.5 text-slate-400 hover:bg-sky-50 hover:text-sky-600"
                          title="View details"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <a
                          href={`/api/clearance-fill/${b.id}/export`}
                          target="_blank"
                          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                          title="Export CSV"
                        >
                          <Download className="h-4 w-4" />
                        </a>
                        <button
                          onClick={async () => {
                            if (!confirm(`Delete batch "${b.name}"?`)) return;
                            try {
                              const res = await fetch(`/api/clearance-fill/${b.id}`, { method: "DELETE" });
                              if (res.ok) loadHistory();
                            } catch {}
                          }}
                          className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                          title="Delete batch"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white py-16">
          <BarChart3 className="mb-3 h-10 w-10 text-slate-200" />
          <p className="text-sm text-slate-500">
            {search ? "No batches match your search." : "No clearance fill batches yet."}
          </p>
          {!search && (
            <Link href="/clearance-fill" className="mt-3 text-sm text-sky-600 hover:text-sky-700">
              Upload your first batch →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
