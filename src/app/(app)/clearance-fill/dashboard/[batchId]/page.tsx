"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft, CheckCircle2, AlertCircle, Phone, Smartphone,
  Download, RefreshCw, BarChart3, FileSpreadsheet, ExternalLink,
  ChevronDown, ChevronUp, Play, X,
} from "lucide-react";
import Link from "next/link";

interface DetailItem {
  id: string; awb: string; companyName: string; email: string;
  clearanceType: string | null; fedexBroker: string | null;
  contactPhone: string | null; callReasons: string[];
  source: string;
  callStatus: string | null; callType: string | null;
  vapiCallId: string | null; completedAt: string | null;
  vapiTranscript: string | null; vapiSummary: string | null;
  vapiRecordingUrl: string | null; resultData: any;
  callSummary: any; actionItems: any; callReason: string | null;
  missingFields: any;
}

interface DetailResult {
  items: DetailItem[];
  stats: { total: number; resolved: number; pending: number; calling: number; done: number; noPhone: number; };
}

const TYPE_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  nfbrk: { bg: "bg-blue-50", text: "text-blue-700", label: "NFBRK" },
  febrk: { bg: "bg-orange-50", text: "text-orange-700", label: "FEBRK" },
  "febrk-jeena": { bg: "bg-violet-50", text: "text-violet-700", label: "FEBRK-Jeena" },
  "febrk-sunimpex": { bg: "bg-purple-50", text: "text-purple-700", label: "FEBRK-Sunimpex" },
  calling: { bg: "bg-amber-50", text: "text-amber-700", label: "Calling" },
  hold: { bg: "bg-slate-100", text: "text-slate-500", label: "Hold" },
};

const CALL_STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-slate-100", text: "text-slate-600", label: "Pending" },
  in_progress: { bg: "bg-amber-100", text: "text-amber-700", label: "Calling..." },
  done: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Answered" },
  skipped: { bg: "bg-red-50", text: "text-red-500", label: "No Phone" },
  failed: { bg: "bg-red-100", text: "text-red-700", label: "Failed" },
};

const REASON_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  clearance_type: { bg: "bg-red-50", text: "text-red-600", label: "Type" },
  broker: { bg: "bg-amber-50", text: "text-amber-600", label: "Broker" },
  email: { bg: "bg-sky-50", text: "text-sky-600", label: "Email" },
};

function sourceBadge(src: string) {
  if (src.includes("master_db_email")) return { bg: "bg-cyan-50", text: "text-cyan-700", label: "Master Email" };
  if (src.includes("master_db_fuzzy") || src.includes("fuzzy")) return { bg: "bg-indigo-50", text: "text-indigo-700", label: "Fuzzy" };
  if (src.includes("master_db")) return { bg: "bg-sky-50", text: "text-sky-700", label: "Master DB" };
  if (src.includes("rule")) return { bg: "bg-violet-50", text: "text-violet-700", label: "Rule" };
  if (src.includes("remarks") || src.includes("mail_id") || src.includes("consignee_email")) return { bg: "bg-teal-50", text: "text-teal-700", label: "Email Col" };
  if (src === "excel" || src.includes("excel+broker")) return { bg: "bg-emerald-50", text: "text-emerald-700", label: "Excel" };
  return { bg: "bg-slate-100", text: "text-slate-500", label: "Auto" };
}

function formatDate(d: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }); }
  catch { return d; }
}

function callSummaryText(summary: any): string {
  if (!summary) return "";
  if (typeof summary === "string") return summary;
  if (typeof summary === "object") {
    const parts: string[] = [];
    if (summary.main_points) parts.push(summary.main_points);
    if (summary.summary) parts.push(summary.summary);
    if (summary.key_information) parts.push(summary.key_information);
    if (parts.length === 0) return JSON.stringify(summary, null, 2);
    return parts.join("\n\n");
  }
  return String(summary);
}

export default function BatchDetailPage() {
  const params = useParams();
  const batchId = params.batchId as string;

  const [data, setData] = useState<DetailResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"items" | "calls">("items");
  const [expandedCall, setExpandedCall] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/clearance-fill/${batchId}/status`);
      if (res.ok) setData(await res.json());
    } catch {} finally { setLoading(false); }
  }, [batchId]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex items-center justify-center py-32"><RefreshCw className="h-6 w-6 animate-spin text-slate-400" /></div>;
  if (!data) return (
    <div className="flex flex-col items-center py-32">
      <AlertCircle className="mb-3 h-10 w-10 text-slate-300" />
      <p className="text-sm text-slate-500">Batch not found.</p>
      <Link href="/clearance-fill/dashboard" className="mt-3 text-sm text-sky-600">← Back to Dashboard</Link>
    </div>
  );

  const s = data.stats;
  const callItems = data.items.filter((i) => i.callStatus);
  const autoResolved = data.items.filter((i) => i.clearanceType && !i.callStatus && i.callReasons.length === 0);

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link href="/clearance-fill/dashboard" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Dashboard
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Batch Detail</h1>
            <p className="mt-0.5 text-sm text-slate-500">ID: {batchId.slice(0, 8)}...</p>
          </div>
          <div className="flex items-center gap-2">
            <a href={`/api/clearance-fill/${batchId}/download-excel`} target="_blank"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
              <Download className="h-4 w-4" /> Download Excel
            </a>
            <a href={`/api/clearance-fill/${batchId}/export`} target="_blank"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
              <Download className="h-4 w-4" /> Export CSV
            </a>
            <button onClick={load} className="rounded-lg border border-slate-300 p-2 text-slate-500 hover:bg-slate-50">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-6 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Total Items</p>
          <p className="mt-0.5 text-2xl font-semibold text-slate-900">{s.total}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-white p-4">
          <p className="flex items-center gap-1 text-xs font-medium text-emerald-600">
            <CheckCircle2 className="h-3 w-3" /> Resolved
          </p>
          <p className="mt-0.5 text-2xl font-semibold text-emerald-700">{s.resolved}</p>
          <p className="text-xs text-emerald-500">{s.done} via AI call</p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-white p-4">
          <p className="flex items-center gap-1 text-xs font-medium text-sky-600">
            Auto-Filled
          </p>
          <p className="mt-0.5 text-2xl font-semibold text-sky-700">{autoResolved.length}</p>
          <p className="text-xs text-sky-500">without AI</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <p className="flex items-center gap-1 text-xs font-medium text-amber-600">
            <Phone className="h-3 w-3" /> AI Calls
          </p>
          <p className="mt-0.5 text-2xl font-semibold text-amber-700">{callItems.length}</p>
          <p className="text-xs text-amber-500">{s.calling} in progress</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-white p-4">
          <p className="flex items-center gap-1 text-xs font-medium text-emerald-600">
            <CheckCircle2 className="h-3 w-3" /> Answered
          </p>
          <p className="mt-0.5 text-2xl font-semibold text-emerald-700">{s.done}</p>
          <p className="text-xs text-emerald-500">{callItems.length > 0 ? Math.round((s.done / callItems.length) * 100) : 0}% rate</p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-white p-4">
          <p className="flex items-center gap-1 text-xs font-medium text-sky-600">
            <Smartphone className="h-3 w-3" /> No Phone
          </p>
          <p className="mt-0.5 text-2xl font-semibold text-sky-700">{s.noPhone}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex items-center gap-1 rounded-lg bg-slate-100 p-1">
        <button onClick={() => setTab("items")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition ${tab === "items" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
          Items ({data.items.length})
        </button>
        <button onClick={() => setTab("calls")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition ${tab === "calls" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
          AI Calls ({callItems.length})
        </button>
      </div>

      {/* ── ITEMS TAB ── */}
      {tab === "items" && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="max-h-[600px] overflow-y-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">AWB</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Phone</th>
                  <th className="px-4 py-3">Clearance</th>
                  <th className="px-4 py-3">Broker</th>
                  <th className="px-4 py-3">Email</th>
                  <th className="px-4 py-3">Missing</th>
                  <th className="px-4 py-3">Call</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((item) => {
                  const ct = item.clearanceType ?? "";
                  const badge = TYPE_BADGES[ct] ?? { bg: "bg-slate-100", text: "text-slate-500", label: ct || "—" };
                  const csBadge = item.callStatus ? (CALL_STATUS_BADGE[item.callStatus] ?? CALL_STATUS_BADGE.pending) : null;
                  const hasPhone = item.contactPhone && item.contactPhone.length > 0;
                  const isEmailValid = item.email && item.email.includes("@");
                  const reasons = item.callReasons ?? [];

                  return (
                    <tr key={item.awb} className={`hover:bg-slate-50 ${item.callStatus === "done" ? "bg-emerald-50/30" : reasons.length > 0 && !hasPhone ? "bg-red-50/20" : ""}`}>
                      <td className="px-4 py-3 font-mono text-xs text-slate-900">{item.awb}</td>
                      <td className="max-w-[160px] truncate px-4 py-3 text-slate-700" title={item.companyName || ""}>{item.companyName || "—"}</td>
                      <td className="px-4 py-3">
                        {hasPhone
                          ? <span className="font-mono text-xs text-slate-600">{item.contactPhone}</span>
                          : <span className="inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-500"><X className="h-3 w-3" /> No Phone</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>{badge.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-slate-600">{item.fedexBroker || "—"}</span>
                      </td>
                      <td className="max-w-[180px] truncate px-4 py-3">
                        {isEmailValid
                          ? <span className="text-sm text-slate-600" title={item.email}>{item.email}</span>
                          : <span className="text-xs text-slate-400">—</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        {reasons.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {reasons.map((r: string) => {
                              const rb = REASON_BADGES[r] ?? { bg: "bg-slate-100", text: "text-slate-600", label: r };
                              return <span key={r} className={`rounded px-1.5 py-0.5 text-xs font-medium ${rb.bg} ${rb.text}`}>{rb.label}</span>;
                            })}
                          </div>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
                            <CheckCircle2 className="h-3 w-3" /> All Set
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {csBadge ? (
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${csBadge.bg} ${csBadge.text}`}>
                            {item.callStatus === "in_progress" && <RefreshCw className="h-3 w-3 animate-spin" />}
                            {csBadge.label}
                          </span>
                        ) : reasons.length > 0 ? (
                          <span className="text-xs text-amber-500">Pending</span>
                        ) : (
                          <span className="text-xs text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── CALLS TAB ── */}
      {tab === "calls" && (
        <div className="space-y-3">
          {callItems.length === 0 ? (
            <div className="flex flex-col items-center rounded-xl border border-slate-200 bg-white py-16">
              <BarChart3 className="mb-3 h-10 w-10 text-slate-200" />
              <p className="text-sm text-slate-500">No AI calls were made for this batch.</p>
            </div>
          ) : (
            callItems.map((item) => {
              const csBadge = item.callStatus ? (CALL_STATUS_BADGE[item.callStatus] ?? CALL_STATUS_BADGE.pending) : CALL_STATUS_BADGE.pending;
              const reasons: string[] = item.callReasons ?? [];
              const isExpanded = expandedCall === item.awb;
              const mf: string[] = item.missingFields as string[] ?? [];

              return (
                <div key={item.awb} className={`rounded-xl border ${item.callStatus === "done" ? "border-emerald-200" : "border-slate-200"} bg-white overflow-hidden`}>
                  <button onClick={() => setExpandedCall(isExpanded ? null : item.awb)}
                    className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-slate-50">
                    <div className="flex items-center gap-4">
                      <span className="font-mono text-sm font-medium text-slate-900">{item.awb}</span>
                      <span className="text-xs text-slate-500">{item.companyName || "—"}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {mf.length > 0 && (
                        <div className="hidden gap-1 sm:flex">
                          {mf.map((f: string) => {
                            const rb = REASON_BADGES[f] ?? { bg: "bg-slate-100", text: "text-slate-600", label: f };
                            return <span key={f} className={`rounded px-2 py-0.5 text-xs font-medium ${rb.bg} ${rb.text}`}>{rb.label}</span>;
                          })}
                        </div>
                      )}
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${csBadge.bg} ${csBadge.text}`}>
                        {item.callStatus === "in_progress" && <RefreshCw className="h-3 w-3 animate-spin" />}
                        {csBadge.label}
                      </span>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-100 px-5 py-4 space-y-4">
                      {/* Call Info Grid */}
                      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                        <div>
                          <p className="text-xs font-medium text-slate-500">Phone</p>
                          <p className="mt-0.5 text-sm text-slate-900">{item.contactPhone || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-500">Call ID</p>
                          <p className="mt-0.5 truncate text-xs text-slate-600">{item.vapiCallId || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-500">Completed</p>
                          <p className="mt-0.5 text-sm text-slate-900">{formatDate(item.completedAt)}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-slate-500">Agent Asked About</p>
                          <div className="mt-0.5 flex flex-wrap gap-1">
                            {mf.length > 0 ? mf.map((f: string) => {
                              const rb = REASON_BADGES[f] ?? { bg: "bg-slate-100", text: "text-slate-600", label: f };
                              return <span key={f} className={`rounded px-1.5 py-0.5 text-xs font-medium ${rb.bg} ${rb.text}`}>{rb.label}</span>;
                            }) : <span className="text-xs text-slate-400">All resolved</span>}
                          </div>
                        </div>
                      </div>

                      {/* Call Results (answered) */}
                      {item.callStatus === "done" && (
                        <div className="rounded-lg bg-emerald-50 p-4">
                          <p className="mb-3 text-xs font-semibold text-emerald-700">Call Results</p>
                          <div className="grid grid-cols-3 gap-4">
                            <div className="rounded-lg bg-white/60 p-3">
                              <p className="text-xs text-emerald-600">Clearance Type</p>
                              <p className="mt-1 text-sm font-semibold text-emerald-900">
                                {item.clearanceType ? (TYPE_BADGES[item.clearanceType]?.label ?? item.clearanceType) : "—"}
                              </p>
                            </div>
                            <div className="rounded-lg bg-white/60 p-3">
                              <p className="text-xs text-emerald-600">FedEx Broker</p>
                              <p className="mt-1 text-sm font-semibold text-emerald-900">{item.fedexBroker || "—"}</p>
                            </div>
                            <div className="rounded-lg bg-white/60 p-3">
                              <p className="text-xs text-emerald-600">Consignee Email</p>
                              <p className="mt-1 break-all text-sm font-semibold text-emerald-900">{item.email || "—"}</p>
                            </div>
                          </div>
                          {item.vapiRecordingUrl && (
                            <div className="mt-3">
                              <audio controls className="h-8 w-full max-w-md" src={item.vapiRecordingUrl}>
                                <a href={item.vapiRecordingUrl} target="_blank" className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 hover:text-emerald-800">
                                  <Play className="h-3.5 w-3.5" /> Download recording
                                </a>
                              </audio>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Failed */}
                      {item.callStatus === "failed" && (
                        <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600">
                          Call failed: {item.callReason || "Unknown reason"}
                        </div>
                      )}

                      {/* No Phone */}
                      {item.callStatus === "skipped" && (
                        <div className="rounded-lg bg-red-50 p-3 text-xs text-red-600">
                          Skipped — no phone number available for this AWB.
                        </div>
                      )}

                      {/* AI Summary */}
                      {item.callSummary && (
                        <div>
                          <p className="mb-1.5 text-xs font-medium text-slate-500">AI Summary</p>
                          <div className="rounded-lg bg-slate-50 p-3">
                            <p className="whitespace-pre-wrap text-sm text-slate-700">{callSummaryText(item.callSummary)}</p>
                          </div>
                        </div>
                      )}

                      {/* Vapi Summary fallback */}
                      {!item.callSummary && item.vapiSummary && (
                        <div>
                          <p className="mb-1.5 text-xs font-medium text-slate-500">Call Summary</p>
                          <div className="rounded-lg bg-slate-50 p-3">
                            <p className="whitespace-pre-wrap text-sm text-slate-700">{item.vapiSummary}</p>
                          </div>
                        </div>
                      )}

                      {/* Action Items */}
                      {item.actionItems && Array.isArray(item.actionItems) && item.actionItems.length > 0 && (
                        <div>
                          <p className="mb-1.5 text-xs font-medium text-slate-500">Action Items</p>
                          <div className="space-y-1">
                            {(item.actionItems as string[]).map((ai: string, idx: number) => (
                              <div key={idx} className="flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-sm text-amber-800">
                                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <span>{ai}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
