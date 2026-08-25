"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface BrokerItem {
  rowNumber: number;
  awb: string;
  companyName: string;
}

const BROKER_OPTIONS = [
  { value: "febrk-jeena", label: "Jeena" },
  { value: "febrk-sunimpex", label: "Sunimpex" },
] as const;

export function BrokerResolutionPanel({
  items,
  batchId,
}: {
  items: BrokerItem[];
  batchId: string;
}) {
  const router = useRouter();
  const [resolutions, setResolutions] = useState<
    Record<string, "febrk-jeena" | "febrk-sunimpex">
  >({});
  const [resolving, setResolving] = useState<Set<string>>(new Set());
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const hasRefreshed = useRef(false);

  async function resolveRow(awb: string) {
    const choice = resolutions[awb];
    if (!choice) return;

    setResolving((prev) => new Set(prev).add(awb));
    setErrors((prev) => ({ ...prev, [awb]: "" }));

    try {
      const item = items.find((i) => i.awb === awb);
      if (!item) throw new Error("Item not found");

      const res = await fetch(`/api/batches/${batchId}/resolve-broker`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ awb, brokerType: choice }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to resolve");
      }

      setResolved((prev) => new Set(prev).add(awb));
    } catch (err: unknown) {
      setErrors((prev) => ({
        ...prev,
        [awb]: err instanceof Error ? err.message : "Unknown error",
      }));
    } finally {
      setResolving((prev) => {
        const next = new Set(prev);
        next.delete(awb);
        return next;
      });
    }
  }

  async function resolveAll() {
    for (const item of items) {
      if (resolved.has(item.awb)) continue;
      if (!resolutions[item.awb]) continue;
      await resolveRow(item.awb);
    }
  }

  if (items.length === 0) return null;

  const allSelected = items.every((i) => resolutions[i.awb]);
  const allResolved = items.every((i) => resolved.has(i.awb));

  useEffect(() => {
    if (allResolved && !hasRefreshed.current) {
      hasRefreshed.current = true;
      const t = setTimeout(() => router.refresh(), 500);
      return () => clearTimeout(t);
    }
  }, [allResolved, router]);

  return (
    <div className="mt-4 rounded-xl border border-amber-200 bg-white">
      <div className="flex items-center justify-between border-b border-amber-100 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-amber-900">
            ⚠️ {items.length} FEBRK row{items.length > 1 ? "s" : ""} need broker resolution
          </h3>
          <p className="mt-0.5 text-xs text-amber-600">
            Company name not found in broker master. Select a broker below or keep unresolved to assign AI calling.
          </p>
        </div>
        {allSelected && !allResolved ? (
          <button
            onClick={resolveAll}
            className="rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-700"
          >
            Resolve all ({Object.keys(resolutions).length})
          </button>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-amber-50/50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Row</th>
              <th className="px-4 py-3">AWB</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Resolve as</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item) => {
              const awb = item.awb;
              const isResolved = resolved.has(awb);
              const isResolving = resolving.has(awb);
              const error = errors[awb];
              const choice = resolutions[awb];

              return (
                <tr key={awb} className={isResolved ? "bg-emerald-50/40" : ""}>
                  <td className="px-4 py-3 text-slate-500">{item.rowNumber}</td>
                  <td className="px-4 py-3 font-mono text-sm text-slate-700">{awb}</td>
                  <td className="px-4 py-3 text-slate-700">{item.companyName || "—"}</td>
                  <td className="px-4 py-3">
                    {isResolved ? (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        Resolved → {choice}
                      </span>
                    ) : (
                      <select
                        value={choice ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "febrk-jeena" || val === "febrk-sunimpex") {
                            setResolutions((prev) => ({ ...prev, [awb]: val }));
                          }
                        }}
                        disabled={isResolving}
                        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                      >
                        <option value="">— Keep unresolved —</option>
                        {BROKER_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {isResolved ? (
                      <span className="text-xs text-emerald-600">Done</span>
                    ) : choice ? (
                      <button
                        onClick={() => resolveRow(awb)}
                        disabled={isResolving}
                        className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
                      >
                        {isResolving ? (
                          <span className="flex items-center gap-1">
                            <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                            Resolving...
                          </span>
                        ) : (
                          "Resolve"
                        )}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400">Select a broker</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {Object.keys(errors).length > 0 ? (
        <div className="border-t border-red-100 px-5 py-3">
          {Object.entries(errors).map(([awb, err]) => (
            <p key={awb} className="text-xs text-red-600">
              {awb}: {err}
            </p>
          ))}
        </div>
      ) : null}

      {allResolved ? (
        <div className="border-t border-emerald-100 px-5 py-3">
          <p className="text-xs font-medium text-emerald-700">
            ✅ All brokers resolved — refreshing…
          </p>
        </div>
      ) : null}
    </div>
  );
}
