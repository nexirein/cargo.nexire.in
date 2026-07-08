"use client";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { StatusBadge } from "@/components/ui/status-badge";

interface BatchItem {
  id: string;
  awb: string;
  consignee_email: string;
  send_status: string;
  failure_reason: string | null;
}

interface SubBatch {
  id: string;
  sub_batch_index: number;
  status: string;
  total_items: number;
  sent_count: number;
  failed_count: number;
}

interface StatusResponse {
  batchRun: {
    id: string;
    run_name: string;
    status: string;
    total_rows: number;
    sent_count: number;
    failed_count: number;
  };
  items: BatchItem[];
  subBatches: SubBatch[];
}

const TERMINAL_STATUSES = ["completed", "partially_sent", "failed"];

export function SendProgress({
  batchRunId,
  canRequeue,
  initial,
}: {
  batchRunId: string;
  canRequeue: boolean;
  initial: StatusResponse;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const queryKey = ["batch-status", batchRunId];

  const { data } = useQuery<StatusResponse>({
    queryKey,
    queryFn: async () => {
      const response = await fetch(`/api/batches/${batchRunId}/status`);
      if (!response.ok) throw new Error("Could not load batch status.");
      return response.json();
    },
    initialData: initial,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`batch-${batchRunId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "batch_items",
          filter: `batch_run_id=eq.${batchRunId}`,
        },
        () => queryClient.invalidateQueries({ queryKey }),
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sub_batches",
          filter: `batch_run_id=eq.${batchRunId}`,
        },
        () => queryClient.invalidateQueries({ queryKey }),
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "batch_runs",
          filter: `id=eq.${batchRunId}`,
        },
        () => queryClient.invalidateQueries({ queryKey }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [batchRunId]);

  useEffect(() => {
    if (data && TERMINAL_STATUSES.includes(data.batchRun.status)) {
      router.replace(`/batches/${batchRunId}/summary`);
    }
  }, [data, batchRunId, router]);

  if (!data) return null;

  const { batchRun, items, subBatches } = data;
  const done = batchRun.sent_count + batchRun.failed_count;
  const percent =
    batchRun.total_rows === 0
      ? 0
      : Math.round((done / batchRun.total_rows) * 100);
  const failedItems = items.filter((i) => i.send_status === "failed");

  async function requeue(batchItemId: string) {
    const response = await fetch(`/api/batches/${batchRunId}/requeue-item`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ batchItemId }),
    });
    if (response.ok) {
      toast.success("Item requeued.");
      queryClient.invalidateQueries({ queryKey });
    } else {
      const body = await response.json().catch(() => ({}));
      toast.error(body.error ?? "Could not requeue that item.");
    }
  }

  return (
    <div className="mt-6 space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-slate-900">
            {done} of {batchRun.total_rows} processed
          </p>
          <StatusBadge status={batchRun.status} />
        </div>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-slate-900 transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-400">
          {batchRun.sent_count} sent · {batchRun.failed_count} failed
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Sub-batch</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Sent / Failed / Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {subBatches.map((sb) => (
              <tr key={sb.id}>
                <td className="px-4 py-3 font-medium text-slate-900">
                  #{sb.sub_batch_index}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={sb.status} />
                </td>
                <td className="px-4 py-3 text-slate-500">
                  {sb.sent_count} / {sb.failed_count} / {sb.total_items}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {failedItems.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3">
            <p className="text-sm font-medium text-slate-900">
              Failed sends ({failedItems.length})
            </p>
          </div>
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">AWB</th>
                <th className="px-4 py-3">Recipient</th>
                <th className="px-4 py-3">Reason</th>
                {canRequeue ? <th className="px-4 py-3" /> : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {failedItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {item.awb}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {item.consignee_email}
                  </td>
                  <td className="px-4 py-3 text-red-600">
                    {item.failure_reason ?? "Unknown error"}
                  </td>
                  {canRequeue ? (
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => requeue(item.id)}
                        className="text-xs font-medium text-slate-600 hover:text-slate-900"
                      >
                        Requeue
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}
