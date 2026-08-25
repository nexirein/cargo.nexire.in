"use client";

import { useRef, useState, useTransition } from "react";
import { X } from "lucide-react";
import { releaseHold } from "./actions";

export function ReleaseHoldButton({ caseId, awb }: { caseId: string; awb: string }) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [remarks, setRemarks] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);

  function handleConfirm() {
    startTransition(async () => {
      await releaseHold(caseId, remarks || undefined);
      setOpen(false);
      setRemarks("");
    });
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100"
      >
        Clear Hold
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">
                Clear hold — {awb}
              </h3>
              <button
                onClick={() => { setOpen(false); setRemarks(""); }}
                className="rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-3 text-xs text-muted-foreground">
              This will mark the hold as cleared and revert the case status to
              &quot;awaiting reply&quot;.
            </p>

            <label className="mb-4 block">
              <span className="text-xs font-medium text-muted-foreground">
                Remarks (optional)
              </span>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="Why is this hold being cleared?"
                rows={3}
                className="mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm outline-none focus:border-sidebar-primary"
              />
            </label>

            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => { setOpen(false); setRemarks(""); }}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                disabled={pending}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {pending ? "Clearing…" : "Clear Hold"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
