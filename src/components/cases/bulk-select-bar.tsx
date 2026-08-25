"use client";

import { useState } from "react";
import { toast } from "sonner";
import { CheckSquare, Hand, Plus } from "lucide-react";

interface Props {
  totalRows: number;
  selected: Set<number>;
  onSelect: (indices: Set<number>) => void;
  caseIds: string[];
  onClaimed: () => void;
}

export function BulkSelectBar({ totalRows, selected, onSelect, caseIds, onClaimed }: Props) {
  const [selectLimit, setSelectLimit] = useState(10);
  const [claiming, setClaiming] = useState(false);

  function handleSelectAll() {
    const next = new Set(selected);
    const limit = Math.min(selectLimit, totalRows);
    for (let i = 0; i < limit; i++) next.add(i);
    onSelect(next);
  }

  function handleAdd10() {
    const newLimit = Math.min(selectLimit + 10, totalRows);
    setSelectLimit(newLimit);
    const next = new Set(selected);
    for (let i = 0; i < newLimit; i++) next.add(i);
    onSelect(next);
  }

  function handleClear() {
    setSelectLimit(10);
    onSelect(new Set());
  }

  function toggleIndex(idx: number) {
    const next = new Set(selected);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    onSelect(next);
  }

  function toggleAll() {
    if (selected.size === totalRows) {
      handleClear();
    } else {
      const next = new Set<number>();
      for (let i = 0; i < totalRows; i++) next.add(i);
      onSelect(next);
    }
  }

  async function handleClaim() {
    if (selected.size === 0) {
      toast("Select cases first");
      return;
    }

    setClaiming(true);
    const ids = Array.from(selected).map((idx) => caseIds[idx]).filter(Boolean);

    try {
      const res = await fetch("/api/cases/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseIds: ids }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Claimed ${data.claimed} case(s)`);
        onClaimed();
      } else {
        toast.error(data.error ?? "Claim failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setClaiming(false);
    }
  }

  const selectedCount = selected.size;

  return {
    selectedCount,
    selectLimit,
    handleSelectAll,
    handleAdd10,
    handleClear,
    toggleIndex,
    toggleAll,
    handleClaim,
    claiming,
    render: (
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={toggleAll}
          className="inline-flex items-center gap-1.5 rounded-md border border-input bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
        >
          <CheckSquare className="h-3.5 w-3.5" />
          {selected.size === totalRows ? "Deselect all" : `Select all (${totalRows})`}
        </button>
        <button
          type="button"
          onClick={handleAdd10}
          disabled={selectLimit >= totalRows}
          className="inline-flex items-center gap-1.5 rounded-md border border-input bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-30"
        >
          <Plus className="h-3.5 w-3.5" />
          +10 (up to {Math.min(selectLimit + 10, totalRows)})
        </button>
        {selected.size > 0 ? (
          <>
            <span className="text-xs text-muted-foreground">
              {selected.size} selected
            </span>
            <button
              type="button"
              onClick={handleClear}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={handleClaim}
              disabled={claiming}
              className="inline-flex items-center gap-1.5 rounded-md bg-sidebar-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-sidebar-primary/90 disabled:opacity-50"
            >
              <Hand className="h-3.5 w-3.5" />
              {claiming ? "Claiming..." : "Claim selected"}
            </button>
          </>
        ) : null}
      </div>
    ),
  };
}
