"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import Link from "next/link";
import JSZip from "jszip";
import { matchAttachmentsToAwbs } from "@/lib/batches/match-attachments";
import {
  TiffConversionPool,
  type ConversionProgress,
} from "@/lib/tiff/pool";
import { ConversionStageStepper } from "@/components/tiff/conversion-stage-stepper";

const TIFF_EXTENSIONS = [".tif", ".tiff"];
const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".doc", ".xlsx", ".xls", ".png", ".jpg", ".jpeg", ...TIFF_EXTENSIONS, ".zip"];

interface BatchItemSummary {
  id: string;
  awb: string;
  consignee_name: string | null;
  attachment_status: string;
}

interface StagedFile {
  file: File;
  awb: string;
  isTiff: boolean;
  status: "pending" | "converting" | "registering" | "done" | "error";
  error?: string;
  pageCount?: number;
}

const REGISTER_CONCURRENCY = 4;

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  const len = bytes.length;
  const chunk = 8192;
  for (let i = 0; i < len; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.slice(i, Math.min(i + chunk, len))));
  }
  return btoa(binary);
}

function fileToBase64(file: File | Uint8Array): Promise<string> {
  if (file instanceof File) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result.split(",")[1] ?? result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
  return Promise.resolve(uint8ToBase64(file));
}

export function AttachmentsUploader({
  batchRunId,
  initialItems,
}: {
  batchRunId: string;
  initialItems: BatchItemSummary[];
}) {
  const [items, setItems] = useState(initialItems);
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [processing, setProcessing] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [convProgress, setConvProgress] = useState<ConversionProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const poolRef = useRef<TiffConversionPool | null>(null);
  const processingRef = useRef(false);

  useEffect(() => {
    return () => poolRef.current?.terminate();
  }, []);

  function getPool() {
    if (!poolRef.current) {
      poolRef.current = new TiffConversionPool();
    }
    return poolRef.current;
  }

  const knownAwbs = items.map((i) => i.awb);

  async function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const zipFile =
      files.length === 1 && files[0].name.endsWith(".zip") ? files[0] : null;

    if (zipFile) {
      await extractZip(zipFile);
    } else {
      addFiles(files);
    }

    e.target.value = "";
  }

  async function extractZip(zipFile: File) {
    setExtracting(true);
    try {
      const zip = new JSZip();
      const contents = await zip.loadAsync(zipFile);
      const entries = Object.values(contents.files).filter((f) => !f.dir);
      const extracted: File[] = [];
      for (const entry of entries) {
        const ext = "." + entry.name.split(".").pop()?.toLowerCase();
        if (!ACCEPTED_EXTENSIONS.includes(ext)) continue;
        const blob = await entry.async("blob");
        extracted.push(
          new File([blob], entry.name.split("/").pop() ?? entry.name),
        );
      }
      addFiles(extracted);
    } finally {
      setExtracting(false);
    }
  }

  function addFiles(files: File[]) {
    const matches = matchAttachmentsToAwbs(
      files.map((f) => f.name),
      knownAwbs,
    );
    const existingNames = new Set(staged.map((s) => s.file.name));
    const next: StagedFile[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const name = file.name;
      const awb = matches[i]?.awb ?? "";

      if (existingNames.has(name)) continue;
      existingNames.add(name);

      next.push({
        file,
        awb,
        isTiff: TIFF_EXTENSIONS.some((ext) => name.toLowerCase().endsWith(ext)),
        status: "pending",
      });
    }

    setStaged((prev) => [...prev, ...next]);
  }

  useEffect(() => {
    if (staged.length > 0 && !processingRef.current) {
      processAll();
    }
  }, [staged]);

  async function processAll() {
    if (processingRef.current) return;
    processingRef.current = true;
    setProcessing(true);

    const pool = getPool();
    const tiffFiles = staged.filter(
      (s) => s.isTiff && s.status === "pending",
    ).map((s) => s.file);

    if (tiffFiles.length > 0) {
      setStaged((prev) =>
        prev.map((s) =>
          s.isTiff && s.status === "pending"
            ? { ...s, status: "converting" as const }
            : s,
        ),
      );

      const results = await pool.convertAll(tiffFiles, (progress) => {
        setConvProgress(progress);
      });

      setConvProgress(null);

      const failedResults = results.filter((r) => r.status !== "success");
      for (const r of failedResults) {
        setStaged((prev) =>
          prev.map((s) =>
            s.file.name === r.fileName
              ? { ...s, status: "error" as const, error: r.errorMessage ?? "Conversion failed" }
              : s,
          ),
        );
      }

      const successfulTiffs = results.filter((r) => r.status === "success" && r.pdfBytes);
      const tiffJobs = successfulTiffs.map((r) => {
        const s = staged.find((f) => f.file.name === r.fileName);
        return { fileName: r.fileName, awb: s?.awb ?? "", bytes: r.pdfBytes!, pageCount: r.pageCount };
      });
      await registerJobsParallel(tiffJobs);
    }

    const nonTiffPending = staged.filter((s) => !s.isTiff && s.status === "pending" && s.awb);
    const nonTiffJobs = await Promise.all(
      nonTiffPending.map(async (s) => ({
        fileName: s.file.name,
        awb: s.awb,
        bytes: new Uint8Array(await s.file.arrayBuffer()),
      })),
    );
    await registerJobsParallel(nonTiffJobs);

    const unmatchedNonTiff = staged.filter((s) => !s.isTiff && s.status === "pending" && !s.awb);
    for (const s of unmatchedNonTiff) {
      setStaged((prev) =>
        prev.map((f) =>
          f.file.name === s.file.name
            ? { ...f, status: "error" as const, error: "No AWB assigned" }
            : f,
        ),
      );
    }

    processingRef.current = false;
    setProcessing(false);
    await refreshItems();
  }

  async function registerFile(
    fileName: string,
    awb: string,
    bytes: Uint8Array,
    pageCount?: number,
  ) {
    setStaged((prev) =>
      prev.map((s) =>
        s.file.name === fileName
          ? { ...s, status: "registering" as const, pageCount }
          : s,
      ),
    );

    try {
      const base64 = await fileToBase64(bytes);
      const isTiff = TIFF_EXTENSIONS.some((ext) => fileName.toLowerCase().endsWith(ext));
      const uploadName = isTiff
        ? fileName.replace(/\.(tif|tiff)$/i, ".pdf")
        : fileName;
      const sourceFormat = isTiff ? "tiff" : (fileName.split(".").pop() ?? "unknown");
      const derivedFormat = isTiff ? "pdf" : sourceFormat;

      const res = await fetch(
        `/api/batches/${batchRunId}/attachments/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ awb, originalName: uploadName, sourceFormat, derivedFormat, content: base64 }),
        },
      );

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Registration failed");
      }

      setStaged((prev) =>
        prev.map((s) =>
          s.file.name === fileName ? { ...s, status: "done" as const } : s,
        ),
      );
    } catch (err) {
      setStaged((prev) =>
        prev.map((s) =>
          s.file.name === fileName
            ? { ...s, status: "error" as const, error: err instanceof Error ? err.message : "Failed" }
            : s,
        ),
      );
    }
  }

  async function registerJobsParallel(
    jobs: { fileName: string; awb: string; bytes: Uint8Array; pageCount?: number }[],
  ) {
    let idx = 0;
    async function worker() {
      while (idx < jobs.length) {
        const j = jobs[idx++];
        await registerFile(j.fileName, j.awb, j.bytes, j.pageCount);
      }
    }
    await Promise.all(
      Array.from({ length: Math.min(REGISTER_CONCURRENCY, jobs.length) }, () => worker()),
    );
  }

  async function refreshItems() {
    const res = await fetch(`/api/batches/${batchRunId}/status`);
    if (res.ok) {
      const data = await res.json();
      setItems(data.items);
    }
  }

  function updateStagedAwb(index: number, awb: string) {
    setStaged((prev) => prev.map((s, i) => (i === index ? { ...s, awb } : s)));
  }

  function retryFile(index: number) {
    setStaged((prev) =>
      prev.map((s, i) =>
        i === index
          ? { ...s, status: "pending" as const, error: undefined }
          : s,
      ),
    );
  }

  function clearStaged() {
    setStaged([]);
  }

  const stagedCount = staged.length;
  const doneCount = staged.filter((s) => s.status === "done").length;
  const errorCount = staged.filter((s) => s.status === "error").length;
  const unmatchedCount = staged.filter((s) => !s.awb).length;
  const hasErrors = errorCount > 0;
  const allDone = doneCount + errorCount === stagedCount && stagedCount > 0;

  const matchedItems = items.filter(
    (i) =>
      i.attachment_status === "matched" ||
      i.attachment_status === "converted",
  ).length;

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        {error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
            <button
              type="button"
              onClick={() => setError(null)}
              className="ml-2 font-medium underline hover:no-underline"
            >
              Dismiss
            </button>
          </div>
        ) : null}
        <label className="block text-sm font-medium text-slate-700">
          Invoice files{" "}
          <span className="text-xs text-slate-400">
            (PDF, TIFF, or .zip)
          </span>
        </label>
        <input
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(",")}
          multiple
          onChange={handleFilesSelected}
          className="mt-2 block w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
        />
        <p className="mt-2 text-xs text-slate-400">
          Upload individual files (PDF, TIFF, images) or a{" "}
          <strong>.zip</strong> archive. Files are matched to an AWB
          automatically. TIFFs are converted to PDF and registered
          automatically.
        </p>
        {extracting ? (
          <p className="mt-3 flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            Extracting ZIP archive...
          </p>
        ) : null}
      </div>

      {convProgress ? (
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <ConversionStageStepper progress={convProgress} />
        </div>
      ) : null}

      {staged.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-slate-900">
                {staged.length} file{staged.length > 1 ? "s" : ""}
              </p>
              {allDone ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  {doneCount} done
                </span>
              ) : processing ? (
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  Processing...
                </span>
              ) : null}
              {hasErrors ? (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  {errorCount} failed
                </span>
              ) : null}
              {unmatchedCount > 0 && !processing ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                  {unmatchedCount} unmatched
                </span>
              ) : null}
            </div>
            <div className="flex gap-2">
              {hasErrors && !processing ? (
                <button
                  type="button"
                  onClick={() => {
                    const failed = staged
                      .map((s, i) => (s.status === "error" ? i : -1))
                      .filter((i) => i !== -1);
                    for (const i of failed) retryFile(i);
                  }}
                  className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
                >
                  Retry failed
                </button>
              ) : null}
              <button
                type="button"
                onClick={clearStaged}
                className="text-xs font-medium text-slate-400 hover:text-slate-600"
              >
                Clear all
              </button>
            </div>
          </div>

          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">AWB</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staged.map((s, i) => (
                <tr
                  key={i}
                  className={
                    s.status === "error"
                      ? "bg-red-50"
                      : s.status === "done"
                        ? "bg-emerald-50/30"
                        : ""
                  }
                >
                  <td
                    className="max-w-[200px] truncate px-4 py-3 text-slate-700"
                    title={s.file.name}
                  >
                    {s.file.name}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={s.awb}
                      onChange={(e) => updateStagedAwb(i, e.target.value)}
                      disabled={s.status === "registering" || s.status === "done" || s.status === "converting" || processing}
                      className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                    >
                      <option value="">Unmatched</option>
                      {knownAwbs.map((awb) => (
                        <option key={awb} value={awb}>
                          {awb}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    {s.isTiff ? (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        TIFF
                      </span>
                    ) : (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                        {s.file.name.split(".").pop()?.toUpperCase() ?? "FILE"}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {s.status === "converting" ? (
                      <span className="flex items-center gap-1 text-xs text-amber-600">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                        Converting...
                      </span>
                    ) : s.status === "registering" ? (
                      <span className="flex items-center gap-1 text-xs text-blue-600">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
                        Registering...
                      </span>
                    ) : s.status === "done" ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        {s.pageCount != null
                          ? `${s.pageCount} page${s.pageCount > 1 ? "s" : ""}`
                          : "Registered"}
                      </span>
                    ) : s.status === "error" ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-600">
                          {s.error ?? "Error"}
                        </span>
                        <button
                          type="button"
                          onClick={() => retryFile(i)}
                          className="rounded border border-red-300 bg-white px-1.5 py-0.5 text-[11px] font-medium text-red-700 hover:bg-red-50"
                        >
                          Retry
                        </button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400">
                        {s.awb ? "Pending" : "No AWB"}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {allDone && doneCount > 0 ? (
            <div className="border-t border-emerald-100 bg-emerald-50 px-5 py-4">
              <p className="text-sm font-medium text-emerald-700">
                {doneCount} file{doneCount > 1 ? "s" : ""} registered
                successfully
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <p className="text-sm font-medium text-slate-900">
            {matchedItems} of {items.length} AWBs have an attachment
          </p>
          <Link
            href={`/batches/${batchRunId}/preview`}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Continue to preview →
          </Link>
        </div>
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">AWB</th>
              <th className="px-4 py-3">Consignee</th>
              <th className="px-4 py-3">Attachment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-3 font-medium text-slate-900">
                  {item.awb}
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {item.consignee_name ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <AttachmentStatusBadge status={item.attachment_status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AttachmentStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-slate-100 text-slate-500",
    matched: "bg-emerald-50 text-emerald-700",
    converted: "bg-emerald-50 text-emerald-700",
    manual_needed: "bg-amber-50 text-amber-700",
    missing: "bg-red-50 text-red-700",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status] ?? styles.pending}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
