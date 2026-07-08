"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { batchSourcePath } from "@/lib/batches/storage-paths";

interface ParseResponse {
  headers: string[];
  guessedMapping: { awb?: string; consigneeEmail?: string; consigneeName?: string };
  totalRows: number;
  previewRows: Record<string, string>[];
}

type Stage = "upload" | "uploading" | "mapping" | "validating";

export function MappingWizard({ batchRunId }: { batchRunId: string }) {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("upload");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parseData, setParseData] = useState<ParseResponse | null>(null);
  const [mapping, setMapping] = useState({
    awb: "",
    consigneeEmail: "",
    consigneeName: "",
  });
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setFileName(file.name);
    setStage("uploading");

    const supabase = createClient();
    const { error: uploadError } = await supabase.storage
      .from("batch-sources")
      .upload(batchSourcePath(batchRunId), file, { upsert: true });

    if (uploadError) {
      setError(`Upload failed: ${uploadError.message}`);
      setStage("upload");
      return;
    }

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
    });
    setStage("mapping");
  }

  async function handleValidate() {
    if (!mapping.awb || !mapping.consigneeEmail) {
      setError("Select both the AWB and consignee email columns.");
      return;
    }
    setError(null);
    setStage("validating");

    const response = await fetch(`/api/batches/${batchRunId}/validate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mapping }),
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "Could not validate this file.");
      setStage("mapping");
      return;
    }

    router.push(`/batches/${batchRunId}/validate`);
  }

  return (
    <div className="mt-6 space-y-6">
      {error ? (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <label className="block text-sm font-medium text-slate-700">
          Excel file (.xlsx)
        </label>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleFileChange}
          disabled={stage === "uploading" || stage === "validating"}
          className="mt-2 block w-full text-sm text-slate-600 file:mr-4 file:rounded-md file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
        />
        {fileName ? (
          <p className="mt-2 text-xs text-slate-400">
            {fileName}
            {stage === "uploading" ? " — uploading and reading…" : ""}
          </p>
        ) : null}
      </div>

      {parseData ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-sm font-semibold text-slate-900">
            Map your columns
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            {parseData.totalRows} rows detected. Every other column is kept
            and stored alongside the shipment automatically.
          </p>

          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <MappingField
              label="AWB *"
              value={mapping.awb}
              headers={parseData.headers}
              onChange={(value) => setMapping((m) => ({ ...m, awb: value }))}
            />
            <MappingField
              label="Consignee email *"
              value={mapping.consigneeEmail}
              headers={parseData.headers}
              onChange={(value) =>
                setMapping((m) => ({ ...m, consigneeEmail: value }))
              }
            />
            <MappingField
              label="Consignee name"
              value={mapping.consigneeName}
              headers={parseData.headers}
              onChange={(value) =>
                setMapping((m) => ({ ...m, consigneeName: value }))
              }
              optional
            />
          </div>

          {parseData.previewRows.length > 0 ? (
            <div className="mt-6 overflow-x-auto">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
                Preview (first {parseData.previewRows.length} rows)
              </p>
              <table className="min-w-full divide-y divide-slate-200 text-xs">
                <thead>
                  <tr>
                    {parseData.headers.map((header) => (
                      <th
                        key={header}
                        className="whitespace-nowrap px-2 py-1 text-left font-medium text-slate-500"
                      >
                        {header}
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
                          className="whitespace-nowrap px-2 py-1 text-slate-600"
                        >
                          {row[header]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <button
            type="button"
            onClick={handleValidate}
            disabled={stage === "validating"}
            className="mt-6 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {stage === "validating" ? "Validating…" : "Validate rows"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MappingField({
  label,
  value,
  headers,
  onChange,
  optional,
}: {
  label: string;
  value: string;
  headers: string[];
  onChange: (value: string) => void;
  optional?: boolean;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-700">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
      >
        <option value="">{optional ? "None" : "Select column…"}</option>
        {headers.map((header) => (
          <option key={header} value={header}>
            {header}
          </option>
        ))}
      </select>
    </div>
  );
}
