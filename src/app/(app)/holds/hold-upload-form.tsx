"use client";

import { useRef, useState } from "react";
import { Upload, FileSpreadsheet, XCircle, CheckCircle2, PlusCircle, SkipForward, AlertCircle } from "lucide-react";
import { uploadHoldData } from "./actions";
import type { UploadResult } from "./actions";

export function HoldUploadForm() {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const formRef = useRef<HTMLFormElement>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    const formData = new FormData(e.currentTarget);
    try {
      const res = await uploadHoldData(formData);
      setResult(res);
    } catch (err) {
      setResult({
        total: 0, updated: 0, created: 0, skipped: 0, errors: 1, details: [{
          row: 0, awb: "", action: "error", reason: null, status: null,
          arrival_source: null, arrival_date: null, origin: null, dest: null, pieces: null,
          error: err instanceof Error ? err.message : "Server action failed",
        }],
      });
    } finally {
      setBusy(false);
    }
  }

  const ACTION_ICON: Record<string, React.ReactNode> = {
    updated: <CheckCircle2 className="h-4 w-4 text-emerald-600" />,
    created: <PlusCircle className="h-4 w-4 text-sky-600" />,
    not_found: <AlertCircle className="h-4 w-4 text-amber-500" />,
    skipped: <SkipForward className="h-4 w-4 text-slate-400" />,
    error: <XCircle className="h-4 w-4 text-red-500" />,
  };

  const ACTION_LABEL: Record<string, string> = {
    updated: "Updated",
    created: "New AWB",
    not_found: "Not in DB",
    skipped: "Skipped",
    error: "Error",
  };

  const ACTION_BADGE: Record<string, string> = {
    updated: "bg-emerald-50 text-emerald-700",
    created: "bg-sky-50 text-sky-700",
    not_found: "bg-amber-50 text-amber-700",
    skipped: "bg-slate-50 text-slate-500",
    error: "bg-red-50 text-red-700",
  };

  return (
    <div>
      {!result ? (
        <form ref={formRef} onSubmit={handleSubmit} className="max-w-xl">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border p-12 text-center transition hover:border-sidebar-primary/50">
            <Upload className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium text-muted-foreground">
              {fileName || "Choose an Excel file"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground/60">
              .xlsx or .xls — columns: AWB, ORG, DEST, PCS ARRIVED, REASON, STAT, ARRIVAL SOURCE, ARRIVAL DATE
            </p>
            <input
              type="file"
              name="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setFileName(f ? f.name : "");
              }}
              required
            />
          </label>

          <label className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" name="createMissing" className="rounded border-border" />
            Create new AWB cases for AWBs not found in the system
          </label>

          <button
            type="submit"
            disabled={busy || !fileName}
            className="mt-4 inline-flex items-center gap-2 rounded-md bg-sidebar-primary px-5 py-2.5 text-sm font-medium text-white transition hover:bg-sidebar-primary/90 disabled:opacity-50"
          >
            {busy ? (
              <>
                <FileSpreadsheet className="h-4 w-4 animate-pulse" />
                Processing…
              </>
            ) : (
              <>
                <FileSpreadsheet className="h-4 w-4" />
                Upload & Process
              </>
            )}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-5 gap-3 text-sm max-w-3xl">
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">Total rows</p>
              <p className="mt-0.5 text-xl font-bold text-foreground">{result.total}</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs text-emerald-600">Updated</p>
              <p className="mt-0.5 text-xl font-bold text-emerald-700">{result.updated}</p>
            </div>
            <div className="rounded-lg border border-sky-200 bg-sky-50 p-3">
              <p className="text-xs text-sky-600">New AWB</p>
              <p className="mt-0.5 text-xl font-bold text-sky-700">{result.created}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">Not in DB</p>
              <p className="mt-0.5 text-xl font-bold text-foreground">{result.details.filter((d) => d.action === "not_found").length}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">Skipped / Errors</p>
              <p className="mt-0.5 text-xl font-bold text-foreground">
                {result.skipped} / {result.errors}
              </p>
            </div>
          </div>

          {/* Detail table */}
          {result.details.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">#</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">AWB</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Action</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Reason</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Arrival Source</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Arrival Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Origin</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Dest</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">Pieces</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {result.details.map((d) => (
                    <tr key={`${d.row}-${d.awb}`} className="hover:bg-muted/30 transition-colors">
                      <td className="px-3 py-2 text-xs text-muted-foreground">{d.row}</td>
                      <td className="px-3 py-2 font-mono text-xs font-medium">{d.awb || "—"}</td>
                      <td className="px-3 py-2">
                        <span className="inline-flex items-center gap-1">
                          {ACTION_ICON[d.action]}
                          <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-xs font-medium ${ACTION_BADGE[d.action]}`}>
                            {ACTION_LABEL[d.action]}
                          </span>
                        </span>
                        {d.error && (
                          <p className="mt-0.5 text-xs text-red-500">{d.error}</p>
                        )}
                      </td>
                      <td className="max-w-[160px] truncate px-3 py-2 text-xs text-muted-foreground" title={d.reason ?? ""}>
                        {d.reason ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{d.status ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{d.arrival_source ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{d.arrival_date ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{d.origin ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{d.dest ?? "—"}</td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">{d.pieces ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={() => { setResult(null); setFileName(""); formRef.current?.reset(); }}
              className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              Upload another file
            </button>
            <a
              href="/holds"
              className="rounded-md bg-sidebar-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-sidebar-primary/90"
            >
              View Hold Tracker
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
