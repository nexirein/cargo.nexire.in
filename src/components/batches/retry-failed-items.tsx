"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw, RotateCcw } from "lucide-react";

interface FailedItem {
  id: string;
  awb: string;
  consignee_email: string;
  failure_reason: string | null;
}

export function RetryFailedItems({
  batchRunId,
  items,
}: {
  batchRunId: string;
  items: FailedItem[];
}) {
  const router = useRouter();
  const [retrying, setRetrying] = useState<Set<string>>(new Set());

  if (items.length === 0) return null;

  async function retryOne(itemId: string) {
    setRetrying((prev) => new Set(prev).add(itemId));
    try {
      const res = await fetch(`/api/batches/${batchRunId}/requeue-item`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batchItemId: itemId }),
      });
      if (res.ok) {
        toast.success("Item requeued — sending now.");
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "Failed to requeue item.");
      }
    } catch {
      toast.error("Network error — try again.");
    } finally {
      setRetrying((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  }

  async function retryAll() {
    const allItems = [...items];
    setRetrying(new Set(allItems.map((i) => i.id)));
    await Promise.allSettled(allItems.map((item) => retryOne(item.id)));
    router.refresh();
  }

  const allRetrying = items.length > 0 && items.every((i) => retrying.has(i.id));

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RefreshCw className="h-4 w-4 text-red-600" />
          <p className="text-sm font-semibold text-red-800">
            {items.length} failed {items.length === 1 ? "item" : "items"}
          </p>
        </div>
        <button
          type="button"
          onClick={retryAll}
          disabled={allRetrying}
          className="inline-flex items-center gap-1.5 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Retry all
        </button>
      </div>
      <div className="mt-3 space-y-1.5">
        {items.map((item) => {
          const isRetrying = retrying.has(item.id);
          return (
            <div
              key={item.id}
              className="flex items-center justify-between rounded-lg border border-red-100 bg-white px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-900">
                  {item.awb}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {item.consignee_email}
                </p>
                {item.failure_reason && (
                  <p className="mt-0.5 truncate text-xs text-red-500">
                    {item.failure_reason}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => retryOne(item.id)}
                disabled={isRetrying}
                className="ml-3 shrink-0 text-xs font-medium text-red-600 transition hover:text-red-800 disabled:opacity-50"
              >
                {isRetrying ? "Retrying..." : "Retry"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
