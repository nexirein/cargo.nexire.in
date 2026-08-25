"use client";

import { useCallback, useState, useRef } from "react";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, RefreshCw, Database, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface SeedResult {
  success: boolean;
  totalRows: number;
  processed: number;
  skippedCalling: number;
  skippedNoType: number;
  clearanceMasterEntries: number;
  clearanceNew: number;
  brokerEntries: number;
  brokerNew: number;
}

export default function SeedMasterPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SeedResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((f: File) => {
    if (!f.name.endsWith(".xlsx") && !f.name.endsWith(".xls") && !f.name.endsWith(".csv")) {
      setError("Please upload an Excel file (.xlsx, .xls)");
      return;
    }
    setFile(f);
    setResult(null);
    setError(null);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/clearance-fill/seed-master", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Upload failed");
      }

      const data: SeedResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [file]);

  const reset = useCallback(() => {
    setFile(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/clearance-fill"
          className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Clearance Fill
        </Link>
        <h1 className="text-2xl font-semibold text-slate-900">Seed Master Data</h1>
        <p className="mt-1 text-sm text-slate-500">
          Upload your historical Excel file (36K rows) to populate{" "}
          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">company_clearance_master</code>{" "}
          and <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">broker_master</code>.
          After seeding, auto-fill will work for all companies in this file.
        </p>
      </div>

      {error && (
        <div className="mb-4 flex items-center gap-2 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Upload Zone */}
      {!result && (
        <div
          onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-12 transition ${
            dragOver
              ? "border-violet-400 bg-violet-50"
              : file
                ? "border-emerald-300 bg-emerald-50/50"
                : "border-slate-300 bg-white hover:border-slate-400"
          }`}
          onClick={() => inputRef.current?.click()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
          {file ? (
            <>
              <FileSpreadsheet className="mb-3 h-10 w-10 text-emerald-500" />
              <p className="font-medium text-slate-900">{file.name}</p>
              <p className="mt-1 text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
              <button
                onClick={(e) => { e.stopPropagation(); handleUpload(); }}
                disabled={loading}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-violet-700 disabled:opacity-60"
              >
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                {loading ? "Seeding Master Data..." : "Seed Master Data"}
              </button>
              <button onClick={(e) => { e.stopPropagation(); reset(); }} className="mt-2 text-xs text-slate-400 hover:text-slate-600">
                Choose a different file
              </button>
            </>
          ) : (
            <>
              <Database className="mb-3 h-10 w-10 text-slate-400" />
              <p className="font-medium text-slate-700">Drop your historical Excel file here</p>
              <p className="mt-1 text-xs text-slate-400">.xlsx or .xls with Consignee Name and End Result columns</p>
            </>
          )}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="animate-[slideIn_0.3s_ease-out] space-y-6">
          <div className="rounded-xl border border-emerald-200 bg-white p-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              <h2 className="text-lg font-semibold text-emerald-800">Master Data Seeded Successfully</h2>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total Rows</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{result.totalRows.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-emerald-600">Processed</p>
              <p className="mt-1 text-2xl font-semibold text-emerald-700">{result.processed.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-amber-600">Skipped (CALLING)</p>
              <p className="mt-1 text-2xl font-semibold text-amber-700">{result.skippedCalling.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Skipped (No Type)</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{result.skippedNoType.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-sky-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-sky-600">Clearance Master</p>
              <p className="mt-1 text-2xl font-semibold text-sky-700">{result.clearanceMasterEntries.toLocaleString()}</p>
              <p className="text-xs text-sky-500">{result.clearanceNew} new insertions</p>
            </div>
            <div className="rounded-xl border border-violet-200 bg-white p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-violet-600">Broker Master</p>
              <p className="mt-1 text-2xl font-semibold text-violet-700">{result.brokerEntries.toLocaleString()}</p>
              <p className="text-xs text-violet-500">{result.brokerNew} upserted</p>
            </div>
          </div>

          <div className="flex gap-3">
            <Link
              href="/clearance-fill"
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              <Upload className="h-4 w-4" />
              Go to Clearance Fill
            </Link>
            <button
              onClick={reset}
              className="rounded-lg border border-slate-300 px-5 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Upload another file
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
