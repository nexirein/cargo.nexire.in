"use client";

import { useState } from "react";
import Link from "next/link";
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
import { statusLabel } from "@/lib/cases/status";
import { Hand, ArrowRight } from "lucide-react";

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
  actorType?: string | null;
}

interface EmailEvent {
  id: string;
  direction: string;
  subject: string | null;
  body_clean: string | null;
  sender_email: string | null;
  recipient_emails: string[] | null;
  created_at: string;
}

interface AiDraftRow {
  id: string;
  subject: string | null;
  status: string;
  confidence: number | null;
  flags: string[] | null;
  created_at: string;
}

export function CaseDetail({
  initialCase,
  currentUserId,
  canManage,
  canOverride,
  teamMembers,
  timeline,
  emailEvents,
  aiDrafts,
}: {
  initialCase: CaseRow;
  currentUserId: string;
  canManage: boolean;
  canOverride: boolean;
  teamMembers: TeamMember[];
  timeline: TimelineEntry[];
  emailEvents: EmailEvent[];
  aiDrafts: AiDraftRow[];
}) {
  const router = useRouter();
  const [caseRow, setCaseRow] = useState(initialCase);
  const [conflict, setConflict] = useState<string | null>(null);
  const [assignTo, setAssignTo] = useState("");
  const [remarksDraft, setRemarksDraft] = useState(initialCase.remarks ?? "");
  const [claimPopup, setClaimPopup] = useState(false);

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
      setClaimPopup(true);
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

  const closeMutation = useMutation({
    mutationFn: () =>
      callAction("update", { version: caseRow.version, currentStatus: "closed" }),
    onSuccess: (updated) => {
      if (!updated) return;
      setCaseRow(updated);
      toast.success("Case closed.");
      router.refresh();
    },
  });

  const escalateMutation = useMutation({
    mutationFn: () =>
      callAction("update", { version: caseRow.version, currentStatus: "escalated" }),
    onSuccess: (updated) => {
      if (!updated) return;
      setCaseRow(updated);
      toast.success("Case escalated.");
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
                {claimMutation.isPending ? "Claiming\u2026" : "Claim"}
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
                  ? "Releasing\u2026"
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
                <option value="">Assign to\u2026</option>
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
                {assignMutation.isPending ? "Assigning\u2026" : "Assign"}
              </button>
              <span className="mx-2 text-slate-200">|</span>
              <button
                type="button"
                onClick={() => escalateMutation.mutate()}
                disabled={escalateMutation.isPending || caseRow.current_status === "escalated"}
                className="rounded-md border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50"
              >
                {escalateMutation.isPending ? "Escalating\u2026" : "Escalate"}
              </button>
              <button
                type="button"
                onClick={() => closeMutation.mutate()}
                disabled={closeMutation.isPending || caseRow.current_status === "closed"}
                className="rounded-md border border-emerald-300 px-3 py-1.5 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
              >
                {closeMutation.isPending ? "Closing\u2026" : "Close"}
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
              {updateMutation.isPending ? "Saving\u2026" : "Save remarks"}
            </button>
          ) : null}
        </div>

        {emailEvents.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-slate-900">
              Email Thread
            </h3>
            <div className="mt-4 space-y-4">
              {emailEvents.map((event) => (
                <div
                  key={event.id}
                  className={`rounded-lg border p-4 ${
                    event.direction === "outbound"
                      ? "border-blue-100 bg-blue-50"
                      : "border-slate-200 bg-white"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="font-medium">
                      {event.direction === "outbound" ? "Sent to" : "Reply from"}{" "}
                      {event.direction === "outbound"
                        ? event.recipient_emails?.join(", ")
                        : event.sender_email}
                    </span>
                    <span>{new Date(event.created_at).toLocaleString()}</span>
                  </div>
                  <p className="mt-2 text-sm font-medium text-slate-900">
                    {event.subject ?? "(no subject)"}
                  </p>
                  {event.body_clean ? (
                    <div
                      className="prose prose-sm mt-2 max-w-none text-slate-700"
                      dangerouslySetInnerHTML={{
                        __html: event.body_clean,
                      }}
                    />
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {aiDrafts.length > 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-900">AI Drafts</h3>
              <Link
                href="/ai/drafts"
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
              >
                Review all →
              </Link>
            </div>
            <div className="mt-3 space-y-2">
              {aiDrafts.map((draft) => (
                <div
                  key={draft.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-amber-200 bg-white px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">
                      {draft.subject ?? "(no subject)"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {new Date(draft.created_at).toLocaleString()}
                      {draft.confidence != null
                        ? ` · conf ${Math.round(draft.confidence * 100)}%`
                        : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${
                      draft.status === "sent" || draft.status === "approved"
                        ? "bg-green-100 text-green-700"
                        : draft.status === "pending"
                          ? "bg-amber-100 text-amber-700"
                          : draft.status === "rejected"
                            ? "bg-red-100 text-red-700"
                            : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {draft.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="space-y-6">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-900">Case Info</h3>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Issue</dt>
              <dd className="font-medium text-slate-900">
                {caseRow.issue_type ?? "\u2014"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Urgency</dt>
              <dd className="font-medium text-slate-900">
                {caseRow.urgency ?? "\u2014"}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Status</dt>
              <dd className="font-medium text-slate-900">
                {statusLabel(caseRow.current_status)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Emails</dt>
              <dd className="font-medium text-slate-900">
                {emailEvents.length} (
                {emailEvents.filter((e) => e.direction === "outbound").length}{" "}
                sent /{" "}
                {emailEvents.filter((e) => e.direction === "inbound").length}{" "}
                replies)
              </dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-slate-900">Timeline</h3>
          <ol className="mt-4 space-y-4">
            {timeline.map((entry) => (
              <li key={entry.id} className="text-sm">
                <p className="font-medium capitalize text-slate-900 flex items-center gap-2">
                  {entry.action.replace(/_/g, " ")}
                  {entry.action === "auto_reply_sent" && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">
                      AI Auto-Sent
                    </span>
                  )}
                  {entry.action === "draft_created" && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                      AI Draft
                    </span>
                  )}
                  {entry.action === "draft_approved_sent" && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                      AI Draft (Approved)
                    </span>
                  )}
                  {entry.action === "followup_scheduled" && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-100 text-purple-700">
                      Follow-up Scheduled
                    </span>
                  )}
                  {entry.action === "followup_sent" && (
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">
                      Follow-up Sent
                    </span>
                  )}
                </p>
                <p className="text-slate-500">
                  {entry.actorName ?? (entry.actorType === "ai" ? "AI" : "System")} \u00B7{" "}
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

      <Dialog
        open={claimPopup}
        onOpenChange={(open) => { if (!open) setClaimPopup(false); }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <Hand className="h-5 w-5" />
              Case claimed
            </DialogTitle>
            <DialogDescription>
              {caseRow.awb} assigned to you. Track it and mark DO collection in My Cases.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2 sm:justify-center">
            <button
              type="button"
              onClick={() => setClaimPopup(false)}
              className="rounded-md border border-input px-4 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              Stay here
            </button>
            <Link
              href="/my-cases"
              className="inline-flex items-center gap-1.5 rounded-md bg-sidebar-primary px-4 py-2 text-sm font-medium text-white transition hover:bg-sidebar-primary/90"
            >
              Go to My Cases
              <ArrowRight className="h-4 w-4" />
            </Link>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
