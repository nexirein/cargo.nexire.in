"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { CLEARANCE_DISPLAY } from "@/lib/cases/clearance-type";

interface UnresolvedCompany {
  rowNumber: number;
  awb: string;
  companyName: string;
}

interface MasterResolved {
  rowNumber: number;
  awb: string;
  companyName: string;
  clearanceType: string;
  source: string;
}

interface MasterEmailResolved {
  rowNumber: number;
  awb: string;
  companyName: string;
  email: string;
}

interface Props {
  companies: UnresolvedCompany[];
  masterResolved: MasterResolved[];
  masterEmails: MasterEmailResolved[];
  batchId: string;
}

type CallStatus = "idle" | "calling" | "completed" | "error";

const CLEARANCE_OPTIONS = [
  { value: "febrk-jeena", label: "FEBRK Jeena" },
  { value: "febrk-sunimpex", label: "FEBRK Sunimpex" },
  { value: "nfbrk", label: "NFBRK" },
];

function sourceBadge(src: string) {
  if (src.includes("fuzzy")) return { bg: "bg-indigo-50", text: "text-indigo-700", label: "Fuzzy Match" };
  if (src.includes("broker") || src.includes("broker_rule")) return { bg: "bg-violet-50", text: "text-violet-700", label: "Broker Rule" };
  if (src.includes("master_db")) return { bg: "bg-sky-50", text: "text-sky-700", label: "Master DB" };
  if (src.includes("excel")) return { bg: "bg-emerald-50", text: "text-emerald-700", label: "Excel" };
  if (src.includes("rule")) return { bg: "bg-amber-50", text: "text-amber-700", label: "Rule" };
  return { bg: "bg-slate-100", text: "text-slate-500", label: src };
}

export function UnresolvedCompaniesPanel({ companies, masterResolved, masterEmails, batchId }: Props) {
  const [callStatuses, setCallStatuses] = useState<Record<number, CallStatus>>({});
  const [manualOverrides, setManualOverrides] = useState<Record<number, string>>({});
  const supabase = createClient();

  const hasAutoResolved = masterResolved.length > 0;
  const hasMasterEmails = masterEmails.length > 0;
  const hasUnresolved = companies.length > 0;

  if (!hasAutoResolved && !hasMasterEmails && !hasUnresolved) return null;

  async function triggerAiCall(rowNumber: number, companyName: string) {
    setCallStatuses((prev) => ({ ...prev, [rowNumber]: "calling" }));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const res = await fetch("/api/vapi/resolve-clearance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, batchId, rowNumber, userId: user?.id }),
      });
      if (!res.ok) throw new Error("AI call failed");
      setCallStatuses((prev) => ({ ...prev, [rowNumber]: "completed" }));
    } catch {
      setCallStatuses((prev) => ({ ...prev, [rowNumber]: "error" }));
    }
  }

  async function saveToMaster(rowNumber: number, companyName: string) {
    const ct = manualOverrides[rowNumber];
    if (!ct) return;
    setCallStatuses((prev) => ({ ...prev, [rowNumber]: "calling" }));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const res = await fetch("/api/vapi/resolve-clearance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyName, batchId, rowNumber, userId: user?.id, clearanceType: ct }),
      });
      if (!res.ok) throw new Error("Save failed");
      setCallStatuses((prev) => ({ ...prev, [rowNumber]: "completed" }));
    } catch {
      setCallStatuses((prev) => ({ ...prev, [rowNumber]: "error" }));
    }
  }

  return (
    <div className="mt-6 space-y-4">
      {/* Section 1: Auto-resolved from master data */}
      {hasAutoResolved && (
        <div className="rounded-xl border border-emerald-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-emerald-800">
                Auto-resolved from master data ({masterResolved.length})
              </p>
              <p className="mt-0.5 text-xs text-emerald-600">
                Companies matched via master DB (exact or fuzzy). No action needed.
              </p>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Row</th>
                  <th className="px-4 py-3">AWB</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Clearance</th>
                  <th className="px-4 py-3">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {masterResolved.map((r) => {
                  const style = CLEARANCE_DISPLAY[r.clearanceType];
                  const sb = sourceBadge(r.source);
                  return (
                    <tr key={`mr-${r.rowNumber}`} className="hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-500">{r.rowNumber}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.awb}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{r.companyName}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style?.bg ?? "bg-slate-100"} ${style?.text ?? "text-slate-600"}`}>
                          {style?.label ?? r.clearanceType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${sb.bg} ${sb.text}`}>
                          {sb.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section 2: Emails resolved from master DB */}
      {hasMasterEmails && (
        <div className="rounded-xl border border-cyan-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-cyan-800">
                Emails resolved from master DB ({masterEmails.length})
              </p>
              <p className="mt-0.5 text-xs text-cyan-600">
                Rows with missing/invalid emails in Excel — resolved via master database.
              </p>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Row</th>
                  <th className="px-4 py-3">AWB</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Resolved Email</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {masterEmails.map((r) => (
                  <tr key={`me-${r.rowNumber}`} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-slate-500">{r.rowNumber}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.awb}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{r.companyName}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-cyan-50 px-2 py-0.5 text-xs font-medium text-cyan-700">
                        {r.email}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section 3: Truly unresolved — need AI call or manual input */}
      {hasUnresolved && (
        <div className="rounded-xl border border-amber-200 bg-white p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-800">
                Companies not in master data ({companies.length})
              </p>
              <p className="mt-0.5 text-xs text-amber-600">
                {companies.length} row{companies.length !== 1 ? "s" : ""} affected.
                Research clearance type or trigger AI calling.
              </p>
            </div>
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Row</th>
                  <th className="px-4 py-3">AWB</th>
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Clearance Type</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {companies.map((c) => {
                  const status = callStatuses[c.rowNumber] ?? "idle";
                  const selectedCt = manualOverrides[c.rowNumber] ?? "";
                  return (
                    <tr key={c.rowNumber}>
                      <td className="px-4 py-3 text-slate-500">{c.rowNumber}</td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600">{c.awb}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{c.companyName}</td>
                      <td className="px-4 py-3">
                        <select
                          value={selectedCt}
                          onChange={(e) =>
                            setManualOverrides((prev) => ({ ...prev, [c.rowNumber]: e.target.value }))
                          }
                          className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                        >
                          <option value="">Select...</option>
                          {CLEARANCE_OPTIONS.map((opt) => {
                            const style = CLEARANCE_DISPLAY[opt.value];
                            return (
                              <option key={opt.value} value={opt.value}>
                                {style?.label ?? opt.label}
                              </option>
                            );
                          })}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {selectedCt && (
                            <button
                              type="button"
                              disabled={status === "calling"}
                              onClick={() => saveToMaster(c.rowNumber, c.companyName)}
                              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-500"
                            >
                              {status === "calling" ? "Saving..." : "Save to Master"}
                            </button>
                          )}
                          {!selectedCt && (
                            <button
                              type="button"
                              disabled={status === "calling" || status === "completed"}
                              onClick={() => triggerAiCall(c.rowNumber, c.companyName)}
                              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                                status === "completed"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : status === "error"
                                    ? "bg-red-50 text-red-700"
                                    : "bg-slate-900 text-white hover:bg-slate-800"
                              }`}
                            >
                              {status === "idle" && "AI Call"}
                              {status === "calling" && "Calling..."}
                              {status === "completed" && "Resolved"}
                              {status === "error" && "Retry"}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
