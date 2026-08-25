"use client";

import { useTransition } from "react";
import { markCallCompleted, skipCall } from "./actions";

export function MarkCallButton({ callId }: { callId: string }) {
  const [completedPending, startCompleted] = useTransition();
  const [skipPending, startSkip] = useTransition();
  const pending = completedPending || skipPending;

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        disabled={pending}
        onClick={() => startCompleted(async () => { await markCallCompleted(callId); })}
        className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-50"
      >
        {completedPending ? "..." : "Done"}
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => startSkip(async () => { await skipCall(callId); })}
        className="rounded-md bg-slate-50 px-2 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
      >
        Skip
      </button>
    </div>
  );
}
