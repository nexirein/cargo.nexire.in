"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { matchAttachmentsToAwbs } from "@/lib/batches/match-attachments";
import { invoicePath } from "@/lib/batches/storage-paths";

const TIFF_EXTENSIONS = [".tif", ".tiff"];

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
  status: "pending" | "uploading" | "done" | "error";
  error?: string;
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
  const [uploading, setUploading] = useState(false);

  const knownAwbs = items.map((i) => i.awb);

  function handleFilesSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const matches = matchAttachmentsToAwbs(
      files.map((f) => f.name),
      knownAwbs,
    );

    const next: StagedFile[] = files.map((file, i) => ({
      file,
      awb: matches[i]?.awb ?? "",
      isTiff: TIFF_EXTENSIONS.some((ext) =>
        file.name.toLowerCase().endsWith(ext),
      ),
      status: "pending",
    }));

    setStaged((prev) => [...prev, ...next]);
    e.target.value = "";
  }

  async function refreshItems() {
    const response = await fetch(`/api/batches/${batchRunId}/status`);
    if (response.ok) {
      const data = await response.json();
      setItems(data.items);
    }
  }

  async function handleUploadAll() {
    setUploading(true);
    const supabase = createClient();
    const uploadable = staged.filter(
      (s) => !s.isTiff && s.awb && s.status !== "done",
    );

    for (const target of uploadable) {
      setStaged((prev) =>
        prev.map((s) => (s === target ? { ...s, status: "uploading" } : s)),
      );

      const path = invoicePath(batchRunId, target.awb, target.file.name);
      const { error: uploadError } = await supabase.storage
        .from("invoices")
        .upload(path, target.file, { upsert: true });

      if (uploadError) {
        setStaged((prev) =>
          prev.map((s) =>
            s === target
              ? { ...s, status: "error", error: uploadError.message }
              : s,
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
            awb: target.awb,
            originalName: target.file.name,
            storagePath: path,
            sourceFormat: target.file.name.split(".").pop() ?? "unknown",
          }),
        },
      );

      if (!registerResponse.ok) {
        const data = await registerResponse.json().catch(() => ({}));
        setStaged((prev) =>
          prev.map((s) =>
            s === target
              ? {
                  ...s,
                  status: "error",
                  error: data.error ?? "Could not register file.",
                }
              : s,
          ),
        );
        continue;
      }

      setStaged((prev) =>
        prev.map((s) => (s === target ? { ...s, status: "done" } : s)),
      );
    }

    setUploading(false);
    await refreshItems();
  }

  function updateStagedAwb(index: number, awb: string) {
    setStaged((prev) => prev.map((s, i) => (i === index ? { ...s, awb } : s)));
  }

  const tiffCount = staged.filter((s) => s.isTiff).length;
  const nonTiffStaged = staged.filter((s) => !s.isTiff);
  const matchedCount = items.filter(
    (i) =>
      i.attachment_status === "matched" || i.attachment_status === "converted",
  ).length;

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <label className="block text-sm font-medium text-slate-700">
          Invoice files
        </label>
        <input
          type="file"
          multiple
          onChange={handleFilesSelected}
          className="mt-2 block w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
        />
        <p className="mt-2 text-xs text-slate-400">
          Files are matched to an AWB by filename automatically — check the
          match before uploading.
        </p>
      </div>

      {tiffCount > 0 ? (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
          {tiffCount} TIFF file(s) selected. These need conversion before
          they can be attached —{" "}
          <Link
            href={`/batches/${batchRunId}/convert`}
            className="font-medium underline"
          >
            convert them here
          </Link>
          .
        </p>
      ) : null}

      {nonTiffStaged.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">File</th>
                <th className="px-4 py-3">AWB</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staged.map((s, i) =>
                s.isTiff ? null : (
                  <tr key={i}>
                    <td className="px-4 py-3 text-slate-700">
                      {s.file.name}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={s.awb}
                        onChange={(e) => updateStagedAwb(i, e.target.value)}
                        disabled={s.status === "uploading" || s.status === "done"}
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
                      {s.status === "error" ? (
                        <span className="text-red-600">{s.error}</span>
                      ) : (
                        s.status
                      )}
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
          <div className="border-t border-slate-200 p-4">
            <button
              type="button"
              onClick={handleUploadAll}
              disabled={uploading}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {uploading ? "Uploading…" : "Upload matched files"}
            </button>
          </div>
        </div>
      ) : null}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <p className="text-sm font-medium text-slate-900">
            {matchedCount} of {items.length} AWBs have an attachment
          </p>
          <Link
            href={`/batches/${batchRunId}/preview`}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
          >
            Continue to preview
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
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        styles[status] ?? styles.pending
      }`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
