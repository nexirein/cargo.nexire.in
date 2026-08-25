"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { CLEARANCE_DISPLAY } from "@/lib/cases/clearance-type";

interface ReadyItem {
  id: string;
  awb: string;
  clearance_type: string | null;
  resolvedFrom: "master" | null;
  resolvedLabel: string | null;
  consignee_name?: string | null;
}

export function ReadyItemRow({
  item,
  index,
  hasAiCall,
  batchRunId,
}: {
  item: ReadyItem;
  index: number;
  hasAiCall: boolean;
  batchRunId: string;
}) {
  const router = useRouter();
  const [reverting, setReverting] = useState(false);

  const canRevert =
    item.clearance_type &&
    item.clearance_type !== "nfbrk" &&
    item.clearance_type !== "hold";

  const isResolved = item.resolvedFrom === "master" || hasAiCall || canRevert;

  async function handleRevert() {
    setReverting(true);
    try {
      await fetch(`/api/batches/${batchRunId}/resolve-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchItemId: item.id, clearanceType: "calling" }),
      });
      router.refresh();
    } catch {
      setReverting(false);
    }
  }

  const rowBg = item.resolvedFrom === "master"
    ? "bg-emerald-50/40"
    : hasAiCall
      ? "bg-amber-50/30"
      : "";

  return (
    <div
      className={`flex items-center justify-between px-5 py-3 transition-all ${rowBg}`}
      style={{ animation: `slideIn 0.3s ease-out ${index * 0.03}s both` }}
    >
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm font-semibold text-slate-900">{item.awb}</span>
        {item.clearance_type ? (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
            CLEARANCE_DISPLAY[item.clearance_type]?.bg ?? "bg-slate-100"
          } ${CLEARANCE_DISPLAY[item.clearance_type]?.text ?? "text-slate-600"}`}>
            {CLEARANCE_DISPLAY[item.clearance_type]?.dot ? (
              <span className={`h-1.5 w-1.5 rounded-full ${CLEARANCE_DISPLAY[item.clearance_type].dot}`} />
            ) : null}
            {CLEARANCE_DISPLAY[item.clearance_type]?.label ?? item.clearance_type}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        {item.resolvedFrom === "master" ? (
          <span className="rounded bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
            From master DB
          </span>
        ) : null}
        {hasAiCall ? (
          <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
            Via AI call
          </span>
        ) : null}
        {canRevert ? (
          <button
            type="button"
            onClick={handleRevert}
            disabled={reverting}
            className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-0.5 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50"
            title="Revert to calling for AI handling"
          >
            <RotateCcw className="h-3 w-3" />
            {reverting ? "..." : "Calling"}
          </button>
        ) : null}
        <span className="text-xs text-slate-400">
          {item.resolvedLabel}
        </span>
      </div>
    </div>
  );
}
