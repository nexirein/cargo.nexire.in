"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export function AutoLaunch({
  batchRunId,
  status,
  itemCount,
  missingAttachmentCount = 0,
}: {
  batchRunId: string;
  status: string;
  itemCount: number;
  missingAttachmentCount?: number;
}) {
  const router = useRouter();
  const [launchState, setLaunchState] = useState<
    "idle" | "confirming" | "launching" | "done" | "failed"
  >("idle");
  const [message, setMessage] = useState("");
  const launchedRef = useRef(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleLaunch = useCallback(async () => {
    if (launchedRef.current) return;
    launchedRef.current = true;

    setLaunchState("launching");
    setMessage("Preparing items for delivery…");

    const response = await fetch(`/api/batches/${batchRunId}/launch`, {
      method: "POST",
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      launchedRef.current = false;
      setLaunchState("failed");
      setMessage(data.error ?? "Could not launch this batch.");
      toast.error(data.error ?? "Could not launch this batch.");
      return;
    }

    setLaunchState("done");
    toast.success(`Queued ${data.queued} item(s) to send.`);

    setTimeout(() => {
      router.push(`/batches/${batchRunId}/send`);
    }, 800);
  }, [batchRunId, router]);

  if (status !== "ready") {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Batch is being prepared…
      </div>
    );
  }

  if (launchState === "confirming" && showConfirm) {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
        <p className="text-sm font-medium text-amber-800">
          {missingAttachmentCount} item{missingAttachmentCount > 1 ? "s" : ""} missing attachment
          {missingAttachmentCount > 1 ? "s" : ""}
        </p>
        <p className="text-xs text-amber-600">
          These items will be sent without attachments. Send anyway?
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowConfirm(false);
              handleLaunch();
            }}
            className="rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-amber-700"
          >
            Send anyway
          </button>
          <button
            onClick={() => {
              setShowConfirm(false);
              setLaunchState("idle");
              launchedRef.current = false;
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (launchState === "launching") {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
        {message}
        <span className="text-xs text-slate-400">({itemCount} items)</span>
      </div>
    );
  }

  if (launchState === "done") {
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-emerald-700">
        <CheckCircle2 className="h-4 w-4" />
        Sent — redirecting…
      </div>
    );
  }

  if (launchState === "failed") {
    return (
      <div className="flex items-center gap-2 text-sm font-medium text-red-700">
        <XCircle className="h-4 w-4" />
        {message}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (missingAttachmentCount > 0) {
          setShowConfirm(true);
          setLaunchState("confirming");
        } else {
          handleLaunch();
        }
      }}
      className="rounded-md bg-slate-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
    >
      Launch send ({itemCount} items)
    </button>
  );
}
