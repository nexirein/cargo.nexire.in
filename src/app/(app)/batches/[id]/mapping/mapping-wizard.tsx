"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { batchSourcePath } from "@/lib/batches/storage-paths";
import { CLEARANCE_DISPLAY, resolveClearanceType } from "@/lib/cases/clearance-type";

interface ParseResponse {
  headers: string[];
  guessedMapping: { awb?: string; consigneeEmail?: string; consigneeName?: string; templateType?: string; fedexBroker?: string };
  totalRows: number;
  previewRows: Record<string, string>[];
  clearanceCounts: Record<string, number>;
}

type Stage = "upload" | "uploading" | "mapping" | "validating";

const CLEARANCE_COLUMN_HINTS: Record<string, string> = {
  pre_alert: "Pick the column whose row values contain: NFBRK, FEBRK (Jeena/Sunimpex), Calling, or HOLD",
  consol: "Pick the column whose row values contain: NFBRK, FEBRK (Jeena/Sunimpex), Calling, or HOLD",
  post_arrival: "Pick the column whose row values contain: Cargo Arrival Notice, Same Day, Next Day, Reminder, or ICEGATE Retry",
  tp_hold: "Not applicable for TP Hold",
};

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export function MappingWizard({ batchRunId, phase, preAlertType }: { batchRunId: string; phase: string; preAlertType?: string }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("upload");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseData, setParseData] = useState<ParseResponse | null>(null);
  const [mapping, setMapping] = useState({
    awb: "",
    consigneeEmail: "",
    consigneeName: "",
    templateType: "",
    fedexBroker: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const [previewEdits, setPreviewEdits] = useState<Map<number, Record<string, string>>>(new Map());

  useEffect(() => {
    const supabase = createClient();
    supabase.storage
      .from("batch-sources")
      .list(batchRunId)
      .then(({ data }) => {
        if (data && data.length > 0) {
          setFileName(data[0].name);
          setStage("uploading");
          setUploadProgress("Restoring previous upload...");
          fetch(`/api/batches/${batchRunId}/parse`, { method: "POST" })
            .then((r) => r.json())
            .then((parseResult) => {
              if (parseResult.headers) {
                setParseData(parseResult);
                setMapping({
                  awb: parseResult.guessedMapping.awb ?? "",
                  consigneeEmail: parseResult.guessedMapping.consigneeEmail ?? "",
                  consigneeName: parseResult.guessedMapping.consigneeName ?? "",
                  templateType: parseResult.guessedMapping.templateType ?? "",
                  fedexBroker: parseResult.guessedMapping.fedexBroker ?? "",
                });
                setStage("mapping");
              } else {
                setStage("upload");
              }
            })
            .catch(() => setStage("upload"));
        }
      })
      .catch(() => {});
  }, [batchRunId]);

  async function deleteStorageFile() {
    const supabase = createClient();
    await supabase.storage
      .from("batch-sources")
      .remove([batchSourcePath(batchRunId)]);
  }

  function resetFileInput() {
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function processFile(file: File) {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!ext || !["xlsx", "xls"].includes(ext)) {
      setError("Only .xlsx and .xls files are supported.");
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setError(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Max 10 MB.`);
      return;
    }

    setError(null);
    setFileName(file.name);
    setStage("uploading");
    setUploadProgress("Uploading to storage...");

    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from("batch-sources")
      .upload(batchSourcePath(batchRunId), file, { upsert: true });

    if (uploadError) {
      setError(`Upload failed: ${uploadError.message}`);
      setStage("upload");
      return;
    }

    setUploadProgress("Reading and parsing file...");
    const response = await fetch(`/api/batches/${batchRunId}/parse`, {
      method: "POST",
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "Could not read that file.");
      setStage("upload");
      return;
    }

    setParseData(data);
    setMapping({
      awb: data.guessedMapping.awb ?? "",
      consigneeEmail: data.guessedMapping.consigneeEmail ?? "",
      consigneeName: data.guessedMapping.consigneeName ?? "",
      templateType: data.guessedMapping.templateType ?? "",
      fedexBroker: data.guessedMapping.fedexBroker ?? "",
    });
    setStage("mapping");
  }

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processFile(file);
  }, [batchRunId, phase]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    processFile(file);
  }, [batchRunId, phase]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  function handlePreviewEdit(rowIndex: number, header: string, value: string) {
    setPreviewEdits((prev) => {
      const next = new Map(prev);
      const rowEdits = next.get(rowIndex) ?? {};
      next.set(rowIndex, { ...rowEdits, [header]: value });
      return next;
    });
  }

  function getPreviewValue(rowIndex: number, header: string, original: Record<string, string>): string {
    return previewEdits.get(rowIndex)?.[header] ?? original[header] ?? "";
  }

  async function handleValidate() {
    if (phase !== "tp_hold" && (!mapping.awb || !mapping.consigneeEmail)) {
      setError("Select both the AWB and consignee email columns.");
      return;
    }
    if (phase === "tp_hold" && !mapping.awb) {
      setError("Select the AWB column.");
      return;
    }
    setError(null);
    setStage("validating");

    try {
      const response = await fetch(`/api/batches/${batchRunId}/validate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mapping: { awb: mapping.awb, consigneeEmail: mapping.consigneeEmail, consigneeName: mapping.consigneeName, templateType: mapping.templateType, fedexBroker: mapping.fedexBroker },
          phase,
          preAlertType,
          previewEdits: previewEdits.size > 0 ? Object.fromEntries(previewEdits) : undefined,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Could not validate this file.");
        setStage("mapping");
        return;
      }

      if (phase === "tp_hold" || data.autoProcessed) {
        router.push(`/batches/${batchRunId}/summary`);
      } else {
        router.push(`/batches/${batchRunId}/validate`);
      }
    } catch (err) {
      setError(`Network error: ${err instanceof Error ? err.message : "Unknown error"}`);
      setStage("mapping");
    }
  }

  return (
    <div className="mt-6 space-y-6">
      {error ? (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="font-medium">Error: </span>
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

      {stage === "upload" || stage === "uploading" ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition ${
            isDragging
              ? "border-slate-900 bg-slate-50"
              : "border-slate-300 bg-white hover:border-slate-400 hover:bg-slate-50"
          } ${stage === "uploading" ? "pointer-events-none opacity-60" : ""}`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            disabled={stage === "uploading"}
            className="hidden"
          />
          {stage === "uploading" ? (
            <div>
              <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
              <p className="mt-3 text-sm font-medium text-slate-700">
                {uploadProgress}
              </p>
              {fileName ? (
                <p className="mt-1 text-xs text-slate-400">{fileName}</p>
              ) : null}
            </div>
          ) : (
            <div>
              <svg
                className="mx-auto h-10 w-10 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
                />
              </svg>
              <p className="mt-3 text-sm font-medium text-slate-700">
                Drop your Excel file here, or click to browse
              </p>
              <p className="mt-1 text-xs text-slate-400">
                .xlsx or .xls &middot; up to 10 MB
              </p>
            </div>
          )}
        </div>
      ) : null}

      {parseData ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Map your columns
              </h2>
              <p className="mt-1 text-xs text-slate-500">
                {parseData.totalRows} rows detected in <strong>{fileName}</strong>.
                Unmapped columns are stored as shipment data automatically.
              </p>
            </div>
            <button
              type="button"
              onClick={async () => {
                await deleteStorageFile();
                // Reset batch status so re-validate cleans up existing items
                await fetch(`/api/batches/${batchRunId}/reset`, { method: "POST" });
                setStage("upload");
                setParseData(null);
                setFileName(null);
                resetFileInput();
              }}
              className="text-xs text-slate-400 underline hover:text-slate-600"
            >
              Choose a different file
            </button>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-5">
            <MappingField
              label="AWB Number *"
              value={mapping.awb}
              headers={parseData.headers}
              onChange={(value) => setMapping((m) => ({ ...m, awb: value }))}
            />
            <MappingField
              label="Consignee Email *"
              value={mapping.consigneeEmail}
              headers={parseData.headers}
              onChange={(value) =>
                setMapping((m) => ({ ...m, consigneeEmail: value }))
              }
            />
            <MappingField
              label="Consignee Name"
              value={mapping.consigneeName}
              headers={parseData.headers}
              onChange={(value) =>
                setMapping((m) => ({ ...m, consigneeName: value }))
              }
              optional
            />
            <MappingField
              label="Clearance type column"
              value={mapping.templateType}
              headers={parseData.headers}
              onChange={(value) =>
                setMapping((m) => ({ ...m, templateType: value }))
              }
              optional
              hint={
                phase !== "tp_hold"
                  ? CLEARANCE_COLUMN_HINTS[phase === "pre_alert" ? (preAlertType ?? "u_bond") : phase]
                  : undefined
              }
            />
            {phase === "pre_alert" ? (
              <MappingField
                label="FedEx Broker"
                value={mapping.fedexBroker}
                headers={parseData.headers}
                onChange={(value) =>
                  setMapping((m) => ({ ...m, fedexBroker: value }))
                }
                optional
                hint="Column with broker name (0 / #N/A = needs resolution)"
              />
            ) : null}
          </div>

          {mapping.templateType && parseData.previewRows.length > 0 ? (
            <TemplateBreakdown
              rows={parseData.previewRows}
              templateColumn={mapping.templateType}
              fullCounts={parseData.clearanceCounts}
              totalRows={parseData.totalRows}
            />
          ) : null}

          {parseData.previewRows.length > 0 ? (
            <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200">
              <div className="flex items-center justify-between bg-slate-50 px-4 py-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Preview (first {parseData.previewRows.length} of {parseData.totalRows} rows)
                </p>
                <span className="text-xs text-slate-400">
                  {parseData.headers.length} columns
                </span>
              </div>
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead>
                  <tr>
                    {parseData.headers.map((header) => (
                      <th
                        key={header}
                        className={`whitespace-nowrap px-3 py-2 text-left font-medium ${
                          header === mapping.awb ||
                          header === mapping.consigneeEmail ||
                          header === mapping.consigneeName ||
                          header === mapping.templateType
                            ? "text-slate-900"
                            : "text-slate-500"
                        }`}
                      >
                        {header}
                        {header === mapping.awb ? (
                          <span className="ml-1 rounded bg-slate-900 px-1 py-0.5 text-[10px] text-white">
                            AWB
                          </span>
                        ) : null}
                        {header === mapping.consigneeEmail ? (
                          <span className="ml-1 rounded bg-slate-900 px-1 py-0.5 text-[10px] text-white">
                            Email
                          </span>
                        ) : null}
                        {header === mapping.consigneeName ? (
                          <span className="ml-1 rounded bg-slate-500 px-1 py-0.5 text-[10px] text-white">
                            Name
                          </span>
                        ) : null}
                        {header === mapping.templateType ? (
                          <span className="ml-1 rounded bg-amber-600 px-1 py-0.5 text-[10px] text-white">
                            Clearance
                          </span>
                        ) : null}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {parseData.previewRows.map((row, i) => (
                    <tr key={i}>
                      {parseData.headers.map((header) => (
                        <td
                          key={header}
                          className="whitespace-nowrap px-1 py-0.5"
                        >
                          <input
                            type="text"
                            value={getPreviewValue(i, header, row)}
                            onChange={(e) => handlePreviewEdit(i, header, e.target.value)}
                            className="w-full border-0 bg-transparent px-2 py-1 text-xs text-slate-600 outline-none ring-1 ring-transparent focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={handleValidate}
              disabled={stage === "validating"}
              className="rounded-md bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {stage === "validating" ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Validating…
                </span>
              ) : (
                "Validate rows"
              )}
            </button>
            {phase === "tp_hold" ? (
              <p className="text-xs text-slate-400">
                TP Hold will be processed immediately after validation.
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function TemplateBreakdown({
  rows,
  templateColumn,
  fullCounts,
  totalRows,
}: {
  rows: Record<string, string>[];
  templateColumn: string;
  fullCounts?: Record<string, number>;
  totalRows?: number;
}) {
  const useFull = fullCounts && Object.keys(fullCounts).length > 0;
  const counts: Record<string, { count: number; samples: string[] }> = {};

  if (useFull) {
    for (const [key, count] of Object.entries(fullCounts!)) {
      counts[key] = { count, samples: [] };
    }
  } else {
    for (const row of rows) {
      const val = row[templateColumn] ?? "";
      if (!val) {
        const key = "(empty)";
        if (!counts[key]) counts[key] = { count: 0, samples: [] };
        counts[key].count++;
        continue;
      }
      const ct = resolveClearanceType(val);
      const key = ct ?? `unresolved: ${val}`;
      if (!counts[key]) counts[key] = { count: 0, samples: [] };
      counts[key].count++;
      if (counts[key].samples.length < 2) counts[key].samples.push(val);
    }
  }

  const entries = Object.entries(counts).sort((a, b) => b[1].count - a[1].count);
  if (entries.length === 0) return null;

  const totalCounted = entries.reduce((s, [, v]) => s + v.count, 0);

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
          Clearance type preview{useFull && totalRows ? ` (${totalCounted} of ${totalRows} rows)` : ""}
        </p>
        {useFull && totalRows && totalCounted < totalRows ? (
          <span className="text-[11px] text-slate-400">{totalRows - totalCounted} unclassified</span>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        {entries.map(([type, info]) => {
          const style = CLEARANCE_DISPLAY[type];
          return (
            <span
              key={type}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${
                style?.bg ?? "bg-slate-200"
              } ${style?.text ?? "text-slate-600"}`}
              title={info.samples.join(", ")}
            >
              {style?.dot ? (
                <span className={`h-2 w-2 rounded-full ${style.dot}`} />
              ) : null}
              <span>{style?.label ?? type}</span>
              <span className="ml-0.5 font-semibold">{info.count}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

function MappingField({
  label,
  value,
  headers,
  onChange,
  optional,
  hint,
}: {
  label: string;
  value: string;
  headers: string[];
  onChange: (value: string) => void;
  optional?: boolean;
  hint?: string;
}) {
  const matched = value && headers.includes(value);
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700">
        {label}
        {optional ? (
          <span className="ml-1 font-normal text-slate-400">(optional)</span>
        ) : null}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`mt-1 block w-full rounded-md border bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 ${
          value && !matched
            ? "border-red-300 focus:border-red-500 focus:ring-red-500"
            : "border-slate-300 focus:border-slate-500 focus:ring-slate-500"
        }`}
      >
        <option value="">
          {optional ? "None" : "Select column\u2026"}
        </option>
        {headers.map((header) => (
          <option key={header} value={header}>
            {header}
          </option>
        ))}
      </select>
      {value && !matched ? (
        <p className="mt-1 text-xs text-red-500">
          Selected column not found in sheet
        </p>
      ) : null}
      {hint ? (
        <p className="mt-1 text-xs text-amber-600">{hint}</p>
      ) : null}
    </div>
  );
}
