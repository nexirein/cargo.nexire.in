"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";

interface CaseRow {
  id: string;
  awb: string;
  current_status: string;
  ownership_status: string;
  owner_user_id: string | null;
  urgency: string | null;
  issue_type: string | null;
  remarks: string | null;
  version: number;
}

interface TeamMember {
  id: string;
  full_name: string | null;
  email: string;
}

interface TimelineEntry {
  id: string;
  actorName: string | null;
  action: string;
  remarks: string | null;
  createdAt: string;
}

export function CaseDetail({
  initialCase,
  currentUserId,
  canManage,
  canOverride,
  teamMembers,
  timeline,
}: {
  initialCase: CaseRow;
  currentUserId: string;
  canManage: boolean;
  canOverride: boolean;
  teamMembers: TeamMember[];
  timeline: TimelineEntry[];
}) {
  const router = useRouter();
  const [caseRow, setCaseRow] = useState(initialCase);
  const [conflict, setConflict] = useState<string | null>(null);
  const [assignTo, setAssignTo] = useState("");
  const [remarksDraft, setRemarksDraft] = useState(initialCase.remarks ?? "");

  async function callAction(
    path: string,
    body: Record<string, unknown>,
  ): Promise<CaseRow | null> {
    const response = await fetch(`/api/cases/${caseRow.id}/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json();

    if (response.status === 409) {
      setConflict(data.error);
      return null;
    }
    if (!response.ok) {
      toast.error(data.error ?? "Something went wrong.");
      return null;
    }
    return data.case as CaseRow;
  }

  const claimMutation = useMutation({
    mutationFn: () => callAction("claim", { version: caseRow.version }),
    onSuccess: (updated) => {
      if (!updated) return;
      setCaseRow(updated);
      toast.success("Case claimed.");
      router.refresh();
    },
  });

  const releaseMutation = useMutation({
    mutationFn: () => callAction("release", { version: caseRow.version }),
    onSuccess: (updated) => {
      if (!updated) return;
      setCaseRow(updated);
      toast.success("Case released.");
      router.refresh();
    },
  });

  const assignMutation = useMutation({
    mutationFn: () =>
      callAction("assign", { version: caseRow.version, toUserId: assignTo }),
    onSuccess: (updated) => {
      if (!updated) return;
      setCaseRow(updated);
      setAssignTo("");
      toast.success("Case assigned.");
      router.refresh();
    },
  });

  const updateMutation = useMutation({
    mutationFn: () =>
      callAction("update", { version: caseRow.version, remarks: remarksDraft }),
    onSuccess: (updated) => {
      if (!updated) return;
      setCaseRow(updated);
      toast.success("Remarks saved.");
      router.refresh();
    },
  });

  const isOwner = caseRow.owner_user_id === currentUserId;
  const isUnassigned = caseRow.ownership_status === "unassigned";
  const canAct = canManage && (isUnassigned || isOwner || canOverride);

  return (
    <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">
                {caseRow.awb}
              </h2>
              <p className="mt-1 text-sm text-slate-500">
                {caseRow.current_status}
              </p>
            </div>
            <StatusBadge status={caseRow.ownership_status} />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {canManage && isUnassigned ? (
              <button
                type="button"
                onClick={() => claimMutation.mutate()}
                disabled={claimMutation.isPending}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                {claimMutation.isPending ? "Claiming…" : "Claim"}
              </button>
            ) : null}

            {canManage && !isUnassigned && (isOwner || canOverride) ? (
              <button
                type="button"
                onClick={() => releaseMutation.mutate()}
                disabled={releaseMutation.isPending}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                {releaseMutation.isPending
                  ? "Releasing…"
                  : isOwner
                    ? "Release"
                    : "Release (override)"}
              </button>
            ) : null}
          </div>

          {canManage && (isOwner || canOverride || isUnassigned) ? (
            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
              <select
                value={assignTo}
                onChange={(e) => setAssignTo(e.target.value)}
                className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              >
                <option value="">Assign to…</option>
                {teamMembers
                  .filter((m) => m.id !== caseRow.owner_user_id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.full_name ?? m.email}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={() => assignMutation.mutate()}
                disabled={!assignTo || assignMutation.isPending}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                {assignMutation.isPending ? "Assigning…" : "Assign"}
              </button>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-900">Remarks</h3>
          <textarea
            value={remarksDraft}
            onChange={(e) => setRemarksDraft(e.target.value)}
            disabled={!canAct}
            rows={3}
            className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50"
          />
          {canAct ? (
            <button
              type="button"
              onClick={() => updateMutation.mutate()}
              disabled={updateMutation.isPending}
              className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
            >
              {updateMutation.isPending ? "Saving…" : "Save remarks"}
            </button>
          ) : null}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-slate-900">Timeline</h3>
        <ol className="mt-4 space-y-4">
          {timeline.map((entry) => (
            <li key={entry.id} className="text-sm">
              <p className="font-medium capitalize text-slate-900">
                {entry.action.replace(/_/g, " ")}
              </p>
              <p className="text-slate-500">
                {entry.actorName ?? "System"} ·{" "}
                {new Date(entry.createdAt).toLocaleString()}
              </p>
              {entry.remarks ? (
                <p className="mt-1 text-slate-600">{entry.remarks}</p>
              ) : null}
            </li>
          ))}
          {timeline.length === 0 ? (
            <p className="text-sm text-slate-400">No activity yet.</p>
          ) : null}
        </ol>
      </div>

      <Dialog
        open={conflict !== null}
        onOpenChange={(open) => !open && setConflict(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>This case changed</DialogTitle>
            <DialogDescription>{conflict}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button
              type="button"
              onClick={() => {
                setConflict(null);
                router.refresh();
              }}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Refresh
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
