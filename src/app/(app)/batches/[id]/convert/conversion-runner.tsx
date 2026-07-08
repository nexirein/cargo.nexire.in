"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  TiffConversionPool,
  type ConversionFileResult,
  type ConversionProgress,
} from "@/lib/tiff/pool";
import { buildZipFromResults, downloadBlob } from "@/lib/tiff/zip";
import { sha256Hex } from "@/lib/tiff/checksum";
import { matchAttachmentsToAwbs } from "@/lib/batches/match-attachments";
import { invoicePath } from "@/lib/batches/storage-paths";
import { ConversionStageStepper } from "@/components/tiff/conversion-stage-stepper";

interface FileResultRow extends ConversionFileResult {
  awb: string;
  retrying?: boolean;
  uploadStatus: "idle" | "uploading" | "uploaded" | "error";
  uploadError?: string;
}

export function ConversionRunner({
  batchRunId,
  knownAwbs,
}: {
  batchRunId: string;
  knownAwbs: string[];
}) {
  const poolRef = useRef<TiffConversionPool | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [showLargeWarning, setShowLargeWarning] = useState(false);
  const [progress, setProgress] = useState<ConversionProgress | null>(null);
  const [rows, setRows] = useState<FileResultRow[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    return () => poolRef.current?.terminate();
  }, []);

  function getPool() {
    if (!poolRef.current) {
      poolRef.current = new TiffConversionPool();
    }
    return poolRef.current;
  }

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setPendingFiles(files);
    setShowLargeWarning(files.length > 100);
    setRows([]);
    e.target.value = "";
  }

  async function startConversion() {
    if (pendingFiles.length === 0) return;
    const matches = matchAttachmentsToAwbs(
      pendingFiles.map((f) => f.name),
      knownAwbs,
    );

    const results = await getPool().convertAll(pendingFiles, setProgress);

    setRows(
      results.map((result, i) => ({
        ...result,
        awb: matches[i]?.awb ?? "",
        uploadStatus: "idle",
      })),
    );
  }

  async function retryFile(index: number) {
    const original = pendingFiles.find(
      (f) => f.name === rows[index].fileName,
    );
    if (!original) return;

    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, retrying: true } : r)),
    );
    const result = await getPool().convertOne(original);
    setRows((prev) =>
      prev.map((r, i) =>
        i === index ? { ...r, ...result, retrying: false } : r,
      ),
    );
  }

  async function skipFile(index: number) {
    const row = rows[index];
    if (row.awb) {
      await fetch(`/api/batches/${batchRunId}/attachments/mark-manual`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ awb: row.awb }),
      });
    }
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, uploadStatus: "uploaded" } : r)),
    );
  }

  function updateRowAwb(index: number, awb: string) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, awb } : r)));
  }

  async function uploadConverted() {
    setUploading(true);
    const supabase = createClient();

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (row.status !== "success" || !row.pdfBytes || !row.awb) continue;
      if (row.uploadStatus === "uploaded") continue;

      setRows((prev) =>
        prev.map((r, idx) =>
          idx === i ? { ...r, uploadStatus: "uploading" } : r,
        ),
      );

      const pdfName = row.fileName.replace(/\.(tif|tiff)$/i, ".pdf");
      const path = invoicePath(batchRunId, row.awb, pdfName);
      const checksum = await sha256Hex(row.pdfBytes);

      const { error: uploadError } = await supabase.storage
        .from("invoices")
        .upload(
          path,
          new Blob([new Uint8Array(row.pdfBytes)], { type: "application/pdf" }),
          { upsert: true },
        );

      if (uploadError) {
        setRows((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? { ...r, uploadStatus: "error", uploadError: uploadError.message }
              : r,
          ),
        );
        continue;
      }

      const registerResponse = await fetch(
        `/api/batches/${batchRunId}/attachments/register`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            awb: row.awb,
            originalName: pdfName,
            storagePath: path,
            sourceFormat: "tiff",
            derivedFormat: "pdf",
            checksum,
          }),
        },
      );

      if (!registerResponse.ok) {
        const data = await registerResponse.json().catch(() => ({}));
        setRows((prev) =>
          prev.map((r, idx) =>
            idx === i
              ? {
                  ...r,
                  uploadStatus: "error",
                  uploadError: data.error ?? "Could not register file.",
                }
              : r,
          ),
        );
        continue;
      }

      setRows((prev) =>
        prev.map((r, idx) => (idx === i ? { ...r, uploadStatus: "uploaded" } : r)),
      );
    }

    setUploading(false);
  }

  async function handleDownloadZip() {
    const successResults = rows.filter((r) => r.status === "success" && r.pdfBytes);
    if (successResults.length === 0) return;
    const blob = await buildZipFromResults(successResults);
    downloadBlob(blob, `${batchRunId}-converted-invoices.zip`);
  }

  const successCount = rows.filter((r) => r.status === "success").length;
  const errorCount = rows.filter((r) => r.status === "error").length;
  const uploadableCount = rows.filter(
    (r) => r.status === "success" && r.awb && r.uploadStatus !== "uploaded",
  ).length;
  const isConverting = progress !== null && progress.stage !== "complete";

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <label className="block text-sm font-medium text-slate-700">
          TIFF files
        </label>
        <input
          type="file"
          accept=".tif,.tiff"
          multiple
          onChange={handleFilesSelected}
          className="mt-2 block w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
        />

        {showLargeWarning ? (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
            {pendingFiles.length} files selected — large batches take longer
            to convert, but you can keep going.
          </p>
        ) : null}

        {pendingFiles.length > 0 && rows.length === 0 ? (
          <button
            type="button"
            onClick={startConversion}
            disabled={isConverting}
            className="mt-4 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            Convert {pendingFiles.length} file
            {pendingFiles.length === 1 ? "" : "s"}
          </button>
        ) : null}
      </div>

      {progress ? <ConversionStageStepper progress={progress} /> : null}

      {rows.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Converted</p>
              <p className="mt-2 text-3xl font-semibold text-emerald-600">
                {successCount}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <p className="text-sm text-slate-500">Couldn&apos;t convert</p>
              <p className="mt-2 text-3xl font-semibold text-red-600">
                {errorCount}
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">File</th>
                  <th className="px-4 py-3">AWB</th>
                  <th className="px-4 py-3">Pages</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 text-slate-700">
                      {row.fileName}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={row.awb}
                        onChange={(e) => updateRowAwb(i, e.target.value)}
                        disabled={row.uploadStatus === "uploaded"}
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
                    <td className="px-4 py-3 text-slate-500">
                      {row.pageCount ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      {row.retrying ? (
                        <span className="text-slate-400">retrying…</span>
                      ) : row.status === "success" ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          {row.uploadStatus === "uploaded"
                            ? "uploaded"
                            : "converted"}
                        </span>
                      ) : (
                        <span
                          className="text-red-600"
                          title={row.errorMessage}
                        >
                          {row.errorMessage ?? "failed"}
                        </span>
                      )}
                      {row.uploadStatus === "error" ? (
                        <p className="mt-1 text-xs text-red-500">
                          {row.uploadError}
                        </p>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.status === "error" && !row.retrying ? (
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => retryFile(i)}
                            className="text-xs font-medium text-slate-600 hover:text-slate-900"
                          >
                            Retry
                          </button>
                          <button
                            type="button"
                            onClick={() => skipFile(i)}
                            className="text-xs font-medium text-slate-400 hover:text-slate-600"
                          >
                            Skip
                          </button>
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between border-t border-slate-200 p-4">
              <button
                type="button"
                onClick={handleDownloadZip}
                disabled={successCount === 0}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Download all as ZIP
              </button>
              <button
                type="button"
                onClick={uploadConverted}
                disabled={uploading || uploadableCount === 0}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                {uploading
                  ? "Uploading…"
                  : `Upload ${uploadableCount} matched PDF(s)`}
              </button>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
