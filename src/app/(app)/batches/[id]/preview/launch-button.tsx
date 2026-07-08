"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export function LaunchButton({
  batchRunId,
  status,
}: {
  batchRunId: string;
  status: string;
}) {
  const router = useRouter();
  const [launching, setLaunching] = useState(false);

  if (status !== "ready") {
    return (
      <button
        type="button"
        disabled
        className="cursor-not-allowed rounded-md bg-slate-300 px-4 py-2 text-sm font-medium text-white"
      >
        Batch is not ready to launch
      </button>
    );
  }

  async function handleLaunch() {
    setLaunching(true);
    const response = await fetch(`/api/batches/${batchRunId}/launch`, {
      method: "POST",
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      toast.error(data.error ?? "Could not launch this batch.");
      setLaunching(false);
      return;
    }

    toast.success(`Queued ${data.queued} pre-alert(s) to send.`);
    router.push(`/batches/${batchRunId}/send`);
  }

  return (
    <button
      type="button"
      onClick={handleLaunch}
      disabled={launching}
      className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
    >
      {launching ? "Launching…" : "Launch batch"}
    </button>
  );
}
