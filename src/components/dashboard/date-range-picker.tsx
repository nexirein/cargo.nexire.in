"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const PRESETS = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
] as const;

export function DateRangePicker({
  range,
  from,
  to,
}: {
  range?: string;
  from?: string;
  to?: string;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const navigate = useCallback(
    (params: Record<string, string | undefined>) => {
      const merged = new URLSearchParams(sp.toString());
      for (const [k, v] of Object.entries(params)) {
        if (v) merged.set(k, v);
        else merged.delete(k);
      }
      router.push(`/dashboard?${merged.toString()}`);
    },
    [router, sp],
  );

  const isPresetActive = !from && !to && !!range;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 rounded-lg border border-border bg-card p-0.5">
        {PRESETS.map((opt) => {
          const active = range === opt.value && isPresetActive;
          return (
            <button
              key={opt.value}
              onClick={() => navigate({ range: opt.value, from: undefined, to: undefined })}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? "bg-sidebar-primary text-white shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <span className="text-xs text-muted-foreground mx-1">or</span>

      <div className="flex items-center gap-2">
        <input
          type="date"
          value={from ?? ""}
          onChange={(e) =>
            navigate({ from: e.target.value, range: undefined, to: to || undefined })
          }
          className="h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground"
        />
        <span className="text-xs text-muted-foreground">to</span>
        <input
          type="date"
          value={to ?? ""}
          onChange={(e) =>
            navigate({ to: e.target.value, range: undefined, from: from || undefined })
          }
          className="h-8 rounded-md border border-border bg-card px-2 text-xs text-foreground"
        />
      </div>
    </div>
  );
}
