"use client";

import { useState } from "react";
import { toast } from "sonner";

export function InboxPollButton() {
  const [polling, setPolling] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  async function handlePoll() {
    setPolling(true);
    setLastResult(null);
    try {
      const res = await fetch("/api/inbox/poll?cron_key=demo-test-secret-2024");
      const data = await res.json();
      const summary = JSON.stringify(data, null, 2);

      if (res.ok) {
        const ingested = data.ingested ?? 0;
        const duplicates = data.duplicates ?? 0;
        const errors = data.errors ?? 0;
        if (ingested > 0 || duplicates > 0 || errors > 0) {
          setLastResult(summary);
          toast.success(
            `Ingested: ${ingested}, Duplicates: ${duplicates}, Errors: ${errors}`,
          );
          window.location.reload();
        } else {
          setLastResult(summary);
          toast("No new replies found — check IMAP credentials");
        }
      } else {
        setLastResult(summary);
        toast.error(`Poll failed: ${data.error ?? "Unknown error"}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setLastResult(msg);
      toast.error(`Poll error: ${msg}`);
    } finally {
      setPolling(false);
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={handlePoll}
        disabled={polling}
        className="h-9 rounded-lg border border-input bg-card px-4 text-sm font-medium text-foreground transition hover:bg-muted disabled:opacity-50"
      >
        {polling ? "Polling…" : "Poll inbox now"}
      </button>
      {lastResult ? (
        <pre className="absolute right-0 top-full z-50 mt-2 max-h-96 w-96 overflow-auto rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-700 shadow-lg">
          {lastResult}
        </pre>
      ) : null}
    </div>
  );
}
