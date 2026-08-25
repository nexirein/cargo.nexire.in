"use client";

import { useCallback, useState, useRef, useEffect } from "react";
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Phone,
  Download, RefreshCw, X, Edit3, Save, Database, BarChart3,
  Smartphone, Search, BookOpen, ArrowRight, Zap, Trash2,
} from "lucide-react";
import Link from "next/link";
import { CLEARANCE_TYPES } from "@/lib/cases/clearance-type";

interface FillItem {
  awb: string; companyName: string; email: string;
  endResult: string | null; fedexBroker: string | null;
  contactPhone: string | null;
  resolvedClearanceType: string | null; resolvedBroker: string | null;
  resolvedEmail: string | null; source: string;
  confidence: "high" | "medium" | "low"; callReasons: string[];
}

interface FillResult {
  sessionId: string; total: number; resolved: number; unresolved: number;
  callReasonCounts: Record<string, number>;
  sourceCounts: Record<string, number>;
  hasPhoneCount: number; items: FillItem[];
}

interface CallStatusItem {
  id: string; awb: string; companyName: string; email: string;
  clearanceType: string | null; fedexBroker: string | null;
  contactPhone: string | null; callReasons: string[];
  callStatus: string | null; completedAt: string | null;
}

interface StatusResult {
  items: CallStatusItem[];
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

const CALL_STATUS: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-slate-100", text: "text-slate-600", label: "Pending" },
  in_progress: { bg: "bg-amber-100", text: "text-amber-700", label: "Calling..." },
  done: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Done" },
  skipped: { bg: "bg-red-50", text: "text-red-500", label: "No Phone" },
  failed: { bg: "bg-red-100", text: "text-red-700", label: "Failed" },
};

const REASON_BADGES: Record<string, { bg: string; text: string; label: string; icon: string }> = {
  clearance_type: { bg: "bg-red-50", text: "text-red-600", label: "Type", icon: "type" },
  broker: { bg: "bg-amber-50", text: "text-amber-600", label: "Broker", icon: "broker" },
  email: { bg: "bg-sky-50", text: "text-sky-600", label: "Email", icon: "email" },
};

const SOURCE_META: Record<string, { label: string; bg: string; text: string; icon: string }> = {
  excel: { label: "From Excel Column", bg: "bg-emerald-50", text: "text-emerald-700", icon: "file" },
  master_db_exact: { label: "Master DB Exact (36K)", bg: "bg-sky-50", text: "text-sky-700", icon: "database" },
  master_db_fuzzy: { label: "Master DB Fuzzy", bg: "bg-indigo-50", text: "text-indigo-700", icon: "search" },
  rule: { label: "Hardcoded Rule", bg: "bg-violet-50", text: "text-violet-700", icon: "zap" },
  email_column: { label: "From Remarks/Email Col", bg: "bg-teal-50", text: "text-teal-700", icon: "mail" },
  master_db_email: { label: "Email from Master DB", bg: "bg-cyan-50", text: "text-cyan-700", icon: "database" },
  ai_call: { label: "Needs AI Call", bg: "bg-amber-50", text: "text-amber-700", icon: "phone" },
};

function getBadge(s: string) { return SOURCE_META[s] ?? { label: s, bg: "bg-slate-100", text: "text-slate-500", icon: "" }; }

const PROCESS_STEPS = [
  { label: "Reading Excel file", sub: "Parsing columns and rows..." },
  { label: "Scanning master database", sub: "Searching 36,000 historical records..." },
  { label: "Auto-filling clearance types", sub: "Matching company names → NFBRK / FEBRK..." },
  { label: "Auto-filling FedEx brokers", sub: "Resolving Jeena, Sunimpex, HC Khanna..." },
  { label: "Auto-filling emails", sub: "Extracting from ConsigneeEmailID, Remarks..." },
  { label: "Checking remaining fields", sub: "Flagging items that need AI calling..." },
];

export default function ClearanceFillPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<FillResult | null>(null);
  const [callingStatus, setCallingStatus] = useState<"idle" | "initiating" | "processing" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [editingAWB, setEditingAWB] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [processingStep, setProcessingStep] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [liveStatus, setLiveStatus] = useState<StatusResult | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (callingStatus === "processing" && result) {
      pollingRef.current = setInterval(async () => {
        try {
          const res = await fetch(`/api/clearance-fill/${result.sessionId}/status`);
          if (res.ok) {
            const data: StatusResult = await res.json();
            setLiveStatus(data);
            if (data.stats.pending === 0 && data.stats.calling === 0) {
              if (pollingRef.current) clearInterval(pollingRef.current);
              setCallingStatus("done");
            }
          }
        } catch {}
      }, 3000);
    }
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [callingStatus, result]);

  const handleFile = useCallback((f: File) => {
    if (!f.name.endsWith(".xlsx") && !f.name.endsWith(".xls") && !f.name.endsWith(".csv")) {
      setError("Please upload an Excel file (.xlsx, .xls)"); return;
    }
    setFile(f); setResult(null); setError(null); setCallingStatus("idle"); setLiveStatus(null);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file) return;
    setLoading(true); setError(null); setProcessingStep(0);

    // Animate processing steps
    const stepInterval = setInterval(() => {
      setProcessingStep((p) => Math.min(p + 1, PROCESS_STEPS.length - 1));
    }, 800);

    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch("/api/clearance-fill", { method: "POST", body: formData });
      clearInterval(stepInterval);
      setProcessingStep(PROCESS_STEPS.length); // done
      if (!res.ok) throw new Error((await res.json()).error ?? "Upload failed");
      const data: FillResult = await res.json();
      // Brief pause so user sees "Done!" step
      await new Promise((r) => setTimeout(r, 400));
      setResult(data); setCallingStatus("idle");
    } catch (err) {
      clearInterval(stepInterval);
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally { setLoading(false); }
  }, [file]);

  const handleInitiateCalls = useCallback(async () => {
    if (!result) return;
    setCallingStatus("initiating");
    try {
      const res = await fetch(`/api/clearance-fill/${result.sessionId}/initiate-calls`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed");
      setCallingStatus("processing");
      fetch(`/api/clearance-fill/${result.sessionId}/process-calls`, { method: "POST" }).catch(() => {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start calls");
      setCallingStatus("error");
    }
  }, [result]);

  const handleExport = useCallback(() => {
    if (result) window.open(`/api/clearance-fill/${result.sessionId}/export`, "_blank");
  }, [result]);
  const handleDownloadExcel = useCallback(() => {
    if (result) window.open(`/api/clearance-fill/${result.sessionId}/download-excel`, "_blank");
  }, [result]);

  const reset = useCallback(() => {
    setFile(null); setResult(null); setError(null); setCallingStatus("idle"); setLiveStatus(null);
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const startEditing = useCallback((awb: string, item: any) => {
    setEditingAWB(awb);
    setEditValues({
      clearanceType: item.clearanceType ?? item.resolvedClearanceType ?? "",
      broker: item.fedexBroker ?? item.resolvedBroker ?? "",
      email: item.email ?? item.resolvedEmail ?? "",
      phone: item.contactPhone ?? item.contact_phone ?? "",
    });
  }, []);

  const saveEdit = useCallback(async (awb: string) => {
    if (!result) return;
    try {
      await fetch(`/api/clearance-fill/${result.sessionId}/items/${awb}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editValues),
      });
      setEditingAWB(null);
      fetch(`/api/clearance-fill/${result.sessionId}/status`).then((r) => r.ok ? r.json() : null).then((d) => { if (d) setLiveStatus(d); });
    } catch {}
  }, [result, editValues]);

  const itemsForDisplay = liveStatus?.items ?? result?.items ?? [];
  const stats = liveStatus?.stats ?? null;
  const needsCallItems = itemsForDisplay.filter((i: any) => {
    const reasons = i.callReasons ?? [];
    return reasons.length > 0;
  });
  const fullyResolvedItems = itemsForDisplay.filter((i: any) => {
    const reasons = i.callReasons ?? [];
    return reasons.length === 0;
  });
  const dbResolvedItems = fullyResolvedItems.filter((i: any) => {
    const src = i.source ?? "";
    return src.includes("master_db") || src.includes("fuzzy");
  });
  const excelResolvedItems = fullyResolvedItems.filter((i: any) => {
    const src = i.source ?? "";
    return !src.includes("master_db") && !src.includes("fuzzy");
  });
  const sc = result?.sourceCounts ?? {};
  const sourceTotal = Object.values(sc).reduce((a: number, b: number) => a + b, 0);

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Bulk Clearance Fill</h1>
          <p className="mt-1 text-sm text-slate-500">
            Upload daily Excel → auto-fill from 36K master DB → AI calls for the rest
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/clearance-fill/dashboard" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            <BarChart3 className="h-4 w-4" /> Dashboard
          </Link>
          <Link href="/clearance-fill/seed" className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            <Database className="h-4 w-4" /> Seed Master Data
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* ── Upload Zone ── */}
      {!result && !loading && (
        <div onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)}
          className={`mb-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 transition ${
            dragOver ? "border-sky-400 bg-sky-50" : file ? "border-emerald-300 bg-emerald-50/50" : "border-slate-300 bg-white hover:border-slate-400"
          }`} onClick={() => inputRef.current?.click()}>
          <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          {file ? (
            <>
              <FileSpreadsheet className="mb-3 h-10 w-10 text-emerald-500" />
              <p className="font-medium text-slate-900">{file.name}</p>
              <p className="mt-1 text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB</p>
              <button onClick={(e) => { e.stopPropagation(); handleUpload(); }}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-800">
                <Upload className="h-4 w-4" /> Start Auto-Fill
              </button>
              <button onClick={(e) => { e.stopPropagation(); reset(); }} className="mt-2 text-xs text-slate-400 hover:text-slate-600">Choose a different file</button>
            </>
          ) : (
            <>
              <Upload className="mb-3 h-10 w-10 text-slate-400" />
              <p className="font-medium text-slate-700">Drop your daily Excel file here</p>
              <p className="mt-1 text-xs text-slate-400">.xlsx with AWB, Consignee Name, End Result, Contact, etc.</p>
            </>
          )}
        </div>
      )}

      {/* ── Processing Animation ── */}
      {loading && (
        <div className="mb-6 rounded-xl border border-sky-200 bg-sky-50/50 p-8">
          <div className="mx-auto max-w-lg">
            <h3 className="mb-6 text-center text-sm font-semibold text-sky-800">Auto-Fill in Progress</h3>
            <div className="space-y-3">
              {PROCESS_STEPS.map((step, idx) => {
                const done = idx < processingStep;
                const current = idx === processingStep;
                return (
                  <div key={idx} className={`flex items-center gap-3 transition-opacity ${current || done ? "opacity-100" : "opacity-30"}`}>
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      done ? "bg-emerald-500 text-white" : current ? "bg-sky-500 text-white" : "bg-slate-200 text-slate-400"
                    }`}>
                      {done ? <CheckCircle2 className="h-4 w-4" /> : current ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : idx + 1}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${done ? "text-emerald-700" : current ? "text-sky-700" : "text-slate-400"}`}>
                        {done ? "Done" : step.label}
                      </p>
                      <p className={`text-xs ${current ? "text-sky-500" : "text-slate-400"}`}>
                        {done ? "✓ Completed" : step.sub}
                      </p>
                    </div>
                    {current && (
                      <div className="flex gap-0.5">
                        <span className="h-2 w-2 animate-bounce rounded-full bg-sky-400" style={{ animationDelay: "0ms" }} />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-sky-400" style={{ animationDelay: "150ms" }} />
                        <span className="h-2 w-2 animate-bounce rounded-full bg-sky-400" style={{ animationDelay: "300ms" }} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Results ── */}
      {result && (
        <div className="animate-[slideIn_0.3s_ease-out] space-y-5">
          {/* Summary Cards with Source Breakdown */}
          <div className="grid grid-cols-6 gap-3">
            <div className="col-span-1 rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium text-slate-500">Total</p>
              <p className="mt-0.5 text-2xl font-semibold text-slate-900">{stats ? stats.total : result.total}</p>
            </div>
            {Object.entries(SOURCE_META).map(([key, meta]) => {
              const count = sc[key] ?? 0;
              if (count === 0 && key !== "ai_call") return null;
              return (
                <div key={key} className={`rounded-xl border p-4 ${key === "ai_call" && count > 0 ? "border-amber-200 bg-amber-50/50" : meta.bg}`}>
                  <p className={`text-xs font-medium ${meta.text}`}>{meta.label}</p>
                  <p className={`mt-0.5 text-2xl font-semibold ${meta.text}`}>{count}</p>
                  {sourceTotal > 0 && (
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/50">
                      <div className={`h-full rounded-full ${key === "ai_call" ? "bg-amber-400" : key === "excel" ? "bg-emerald-400" : key === "master_db_exact" ? "bg-sky-400" : key === "master_db_fuzzy" ? "bg-indigo-400" : key === "rule" ? "bg-violet-400" : "bg-teal-400"}`}
                        style={{ width: `${(count / sourceTotal) * 100}%` }} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Visual Flow: what happened */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Zap className="h-4 w-4 text-slate-400" />
              Auto-Fill Flow
            </h3>
            <div className="flex items-start gap-0">
              {/* Upload */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
                  <Upload className="h-5 w-5 text-slate-500" />
                </div>
                <p className="text-xs text-slate-500">Upload</p>
                <p className="text-xs font-medium text-slate-700">{result.total} rows</p>
              </div>

              <ArrowRight className="mx-3 mt-3 h-5 w-5 shrink-0 text-slate-300" />

              {/* Master DB */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100">
                  <Database className="h-5 w-5 text-sky-600" />
                </div>
                <p className="text-xs text-slate-500">Master DB</p>
                <p className="text-xs font-medium text-sky-700">36K records</p>
                <p className="text-xs text-sky-500">{(sc.master_db_exact ?? 0) + (sc.master_db_fuzzy ?? 0)} matched</p>
              </div>

              <ArrowRight className="mx-3 mt-3 h-5 w-5 shrink-0 text-slate-300" />

              {/* Auto-Filled */}
              <div className="flex flex-col items-center gap-1.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
                <p className="text-xs text-slate-500">Auto-Filled</p>
                <p className="text-sm font-semibold text-emerald-700">{result.resolved}</p>
                <div className="text-center text-xs text-emerald-600">
                  <p>{sc.excel ?? 0} from Excel</p>
                  <p>{sc.master_db_exact ?? 0} exact match</p>
                  <p>{sc.master_db_fuzzy ?? 0} fuzzy match</p>
                  <p>{sc.rule ?? 0} rule</p>
                </div>
              </div>

              <ArrowRight className="mx-3 mt-3 h-5 w-5 shrink-0 text-slate-300" />

              {/* Needs AI */}
              <div className="flex flex-col items-center gap-1.5">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${result.unresolved > 0 ? "bg-amber-100" : "bg-slate-100"}`}>
                  <Phone className={`h-5 w-5 ${result.unresolved > 0 ? "text-amber-600" : "text-slate-400"}`} />
                </div>
                <p className={`text-xs ${result.unresolved > 0 ? "text-slate-500" : "text-slate-400"}`}>Needs AI Call</p>
                <p className={`text-sm font-semibold ${result.unresolved > 0 ? "text-amber-700" : "text-slate-400"}`}>
                  {result.unresolved}
                </p>
                <div className="text-center text-xs text-amber-600">
                  {Object.entries(result.callReasonCounts).map(([key, count]) => {
                    const rb = REASON_BADGES[key] ?? { label: key };
                    return <p key={key}>{count} need {rb.label}</p>;
                  })}
                </div>
              </div>

              {stats && (
                <>
                  <ArrowRight className="mx-3 mt-3 h-5 w-5 shrink-0 text-slate-300" />
                  <div className="flex flex-col items-center gap-1.5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    </div>
                    <p className="text-xs text-slate-500">AI Results</p>
                    <p className="text-sm font-semibold text-emerald-700">{stats.done}</p>
                    <p className="text-xs text-emerald-500">answered</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Call Reasons Breakdown */}
          {needsCallItems.length > 0 && !stats && (
            <div className="rounded-xl border border-amber-200 bg-white p-5">
              <h3 className="mb-1 flex items-center gap-2 text-base font-semibold text-amber-800">
                <Phone className="h-5 w-5" />
                {needsCallItems.length} item{needsCallItems.length !== 1 ? "s" : ""} need AI calls
              </h3>
              <p className="mb-3 text-sm text-amber-600">
                Each agent call asks only about missing fields:
              </p>
              <div className="flex flex-wrap gap-4">
                {(Object.entries(result.callReasonCounts) as [string, number][]).map(([key, count]) => {
                  const badge = REASON_BADGES[key] ?? { bg: "bg-slate-100", text: "text-slate-600", label: key, icon: "" };
                  const pct = result.total > 0 ? Math.round((count / result.total) * 100) : 0;
                  return (
                    <div key={key} className="flex items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.bg} ${badge.text}`}>{count} need {badge.label}</span>
                      <div className="h-2 w-20 overflow-hidden rounded-full bg-slate-100">
                        <div className={`h-full rounded-full ${key === "clearance_type" ? "bg-red-400" : key === "broker" ? "bg-amber-400" : "bg-sky-400"}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-slate-400">{pct}%</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-3 text-xs text-amber-600">
                <strong>{needsCallItems.filter((i: any) => i.callReasons.length === 3).length}</strong> need all 3 fields,
                <strong> {needsCallItems.filter((i: any) => i.callReasons.length === 2).length}</strong> need 2 fields,
                <strong> {needsCallItems.filter((i: any) => i.callReasons.length === 1).length}</strong> need 1 field.
                {result.hasPhoneCount < needsCallItems.length && (
                  <span className="ml-1 text-red-500">({needsCallItems.length - result.hasPhoneCount} have no phone)</span>
                )}
              </div>
            </div>
          )}

          {/* Resolved from Excel / Rule */}
          {excelResolvedItems.length > 0 && (
            <div className="rounded-xl border border-emerald-200 bg-white">
              <div className="border-b border-emerald-100 bg-emerald-50/50 px-5 py-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Resolved from Excel / Rule — {excelResolvedItems.length}
                </h2>
              </div>
              <div className="max-h-60 overflow-y-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                    <tr><th className="px-4 py-2.5">AWB</th><th className="px-4 py-2.5">Company</th><th className="px-4 py-2.5">Type</th><th className="px-4 py-2.5">Broker</th><th className="px-4 py-2.5">Email</th><th className="px-4 py-2.5">Source</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {excelResolvedItems.map((item: any) => {
                      const ct = item.clearanceType ?? item.resolvedClearanceType ?? "";
                      const badge = TYPE_BADGES[ct] ?? TYPE_BADGES.nfbrk;
                      const src = item.source ?? "";
                      const srcMeta = src.includes("rule") ? SOURCE_META.rule :
                        src.includes("remarks") || src.includes("consignee_email") || src.includes("mail_id") ? SOURCE_META.email_column :
                        SOURCE_META.excel;
                      return (
                        <tr key={item.awb} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-mono text-xs text-slate-900">{item.awb}</td>
                          <td className="max-w-[160px] truncate px-4 py-2.5 text-slate-700">{item.companyName || "—"}</td>
                          <td className="px-4 py-2.5"><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>{badge.label}</span></td>
                          <td className="px-4 py-2.5 text-slate-600">{item.fedexBroker ?? item.resolvedBroker ?? "—"}</td>
                          <td className="max-w-[200px] truncate px-4 py-2.5 text-slate-600">{item.email ?? item.resolvedEmail ?? "—"}</td>
                          <td className="px-4 py-2.5"><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${srcMeta.bg} ${srcMeta.text}`}>{srcMeta.label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Resolved from Master DB */}
          {dbResolvedItems.length > 0 && (
            <div className="rounded-xl border border-sky-200 bg-white">
              <div className="border-b border-sky-100 bg-sky-50/50 px-5 py-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-sky-800">
                  <Database className="h-4 w-4 text-sky-500" />
                  Resolved from Master DB — {dbResolvedItems.length}
                </h2>
              </div>
              <div className="max-h-60 overflow-y-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                    <tr><th className="px-4 py-2.5">AWB</th><th className="px-4 py-2.5">Company</th><th className="px-4 py-2.5">Type</th><th className="px-4 py-2.5">Broker</th><th className="px-4 py-2.5">Email</th><th className="px-4 py-2.5">Match</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dbResolvedItems.map((item: any) => {
                      const ct = item.clearanceType ?? item.resolvedClearanceType ?? "";
                      const badge = TYPE_BADGES[ct] ?? TYPE_BADGES.nfbrk;
                      const src = item.source ?? "";
                      const srcMeta = src.includes("fuzzy") ? SOURCE_META.master_db_fuzzy : SOURCE_META.master_db_exact;
                      return (
                        <tr key={item.awb} className="hover:bg-sky-50/50">
                          <td className="px-4 py-2.5 font-mono text-xs text-slate-900">{item.awb}</td>
                          <td className="max-w-[160px] truncate px-4 py-2.5 text-slate-700">{item.companyName || "—"}</td>
                          <td className="px-4 py-2.5"><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>{badge.label}</span></td>
                          <td className="px-4 py-2.5 text-slate-600">{item.fedexBroker ?? item.resolvedBroker ?? "—"}</td>
                          <td className="max-w-[200px] truncate px-4 py-2.5 text-slate-600">{item.email ?? item.resolvedEmail ?? "—"}</td>
                          <td className="px-4 py-2.5"><span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${srcMeta.bg} ${srcMeta.text}`}>{srcMeta.label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Needs AI Call Table */}
          {needsCallItems.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-white">
              <div className="border-b border-amber-100 bg-amber-50/50 px-5 py-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                  <AlertCircle className="h-4 w-4" />
                  Need AI Call — {needsCallItems.length}
                  {stats && stats.calling > 0 ? ` (${stats.calling} calling)` : ""}
                </h2>
              </div>
              <div className="max-h-80 overflow-y-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-medium uppercase text-slate-500">
                    <tr><th className="px-4 py-2.5">AWB</th><th className="px-4 py-2.5">Company</th><th className="px-4 py-2.5">Phone</th><th className="px-4 py-2.5">Missing Fields</th><th className="px-4 py-2.5">Call Status</th><th className="px-4 py-2.5">Override</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {needsCallItems.map((item: any) => {
                      const reasons: string[] = item.callReasons ?? [];
                      const phone = item.contactPhone ?? item.contact_phone ?? "";
                      const isEditing = editingAWB === item.awb;
                      const itemType = item.clearanceType ?? item.resolvedClearanceType ?? null;
                      return (
                        <tr key={item.awb} className="hover:bg-amber-50/30">
                          <td className="px-4 py-2.5 font-mono text-xs text-slate-900">{item.awb}</td>
                          <td className="max-w-[160px] truncate px-4 py-2.5 text-slate-700">{item.companyName || "—"}</td>
                          <td className="px-4 py-2.5">
                            {phone ? <span className="font-mono text-xs text-slate-600">{phone}</span>
                            : <span className="inline-flex items-center gap-1 rounded bg-red-50 px-1.5 py-0.5 text-xs text-red-500"><X className="h-3 w-3" /> No Phone</span>}
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex flex-wrap gap-1">
                              {reasons.map((r: string) => {
                                const rb = REASON_BADGES[r] ?? { bg: "bg-slate-100", text: "text-slate-600", label: r, icon: "" };
                                return <span key={r} className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${rb.bg} ${rb.text}`}>{rb.label}</span>;
                              })}
                              {itemType === "febrk" && <span className="inline-flex items-center rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-600">FEBRK (unresolved broker)</span>}
                            </div>
                          </td>
                          <td className="px-4 py-2.5">
                            {(() => {
                              const cs = item.callStatus ?? null;
                              if (!cs) return <span className="text-xs text-slate-400">Ready for call</span>;
                              const b = CALL_STATUS[cs] ?? CALL_STATUS.pending;
                              return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${b.bg} ${b.text}`}>{cs === "in_progress" && <RefreshCw className="h-3 w-3 animate-spin" />}{b.label}</span>;
                            })()}
                          </td>
                          <td className="px-4 py-2.5">
                            {isEditing ? (
                              <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-1">
                                  <select className="w-22 rounded border border-slate-300 px-1.5 py-1 text-xs" value={editValues.clearanceType}
                                    onChange={(e) => setEditValues((v) => ({ ...v, clearanceType: e.target.value }))}>
                                    <option value="">Type...</option>
                                    {CLEARANCE_TYPES.filter((t) => t.value).map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                                  </select>
                                  <input className="w-14 rounded border border-slate-300 px-1.5 py-1 text-xs" placeholder="Broker" value={editValues.broker}
                                    onChange={(e) => setEditValues((v) => ({ ...v, broker: e.target.value }))} />
                                </div>
                                <div className="flex items-center gap-1">
                                  <input className="w-26 rounded border border-slate-300 px-1.5 py-1 text-xs" placeholder="Email" value={editValues.email}
                                    onChange={(e) => setEditValues((v) => ({ ...v, email: e.target.value }))} />
                                  <input className="w-22 rounded border border-slate-300 px-1.5 py-1 text-xs" placeholder="Phone" value={editValues.phone}
                                    onChange={(e) => setEditValues((v) => ({ ...v, phone: e.target.value }))} />
                                  <button onClick={() => saveEdit(item.awb)} className="rounded bg-emerald-500 p-1 text-white hover:bg-emerald-600"><Save className="h-3.5 w-3.5" /></button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => startEditing(item.awb, item)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"><Edit3 className="h-3.5 w-3.5" /></button>
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

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-5 py-4">
            {result.unresolved > 0 && callingStatus !== "done" && (
              <button onClick={handleInitiateCalls} disabled={callingStatus === "initiating" || callingStatus === "processing"}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-60">
                {callingStatus === "initiating" || callingStatus === "processing" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Phone className="h-4 w-4" />}
                {callingStatus === "initiating" ? "Initiating..." : callingStatus === "processing" ? "Processing..." : `Initiate AI Calls (${needsCallItems.length})`}
              </button>
            )}
            <button onClick={handleDownloadExcel} className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"><Download className="h-4 w-4" /> Excel</button>
            <button onClick={handleExport} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"><Download className="h-4 w-4" /> CSV</button>
            <button onClick={reset} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">New Batch</button>
            <button onClick={async () => {
              if (!confirm("Delete this batch and all its data?")) return;
              try {
                const res = await fetch(`/api/clearance-fill/${result.sessionId}`, { method: "DELETE" });
                if (res.ok) reset();
                else alert("Failed to delete batch");
              } catch { alert("Failed to delete batch"); }
            }} className="ml-auto inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Delete Batch</button>
            {callingStatus === "done" && <p className="flex items-center gap-1.5 text-xs text-emerald-600"><CheckCircle2 className="h-3.5 w-3.5" /> AI calls completed.</p>}
          </div>

          {/* Dashboard link */}
          <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-5 w-5 text-slate-400" />
                <div>
                  <p className="text-sm font-medium text-slate-900">Call History & Batch Dashboard</p>
                  <p className="text-xs text-slate-500">View all past batches, call results, and detailed reports.</p>
                </div>
              </div>
              <Link href="/clearance-fill/dashboard" className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800">
                <BarChart3 className="h-4 w-4" /> Open Dashboard
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
