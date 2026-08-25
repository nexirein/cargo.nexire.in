"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  CheckSquare, Plus, Hand, Bot, ShieldAlert,
  AlertTriangle, ArrowRight, ExternalLink, Mail, Clock,
} from "lucide-react";
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
import { CLEARANCE_DISPLAY } from "@/lib/cases/clearance-type";
import { ClearanceTracker } from "@/components/cases/clearance-tracker";

const TYPE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  u_bond: { bg: "bg-sky-100", text: "text-sky-700", label: "uBond" },
  consol: { bg: "bg-indigo-100", text: "text-indigo-700", label: "Consol" },
};

interface EmailEvent {
  id: string;
  direction: string;
  subject: string | null;
  body_clean: string | null;
  sender_email: string | null;
  recipient_emails: string[] | null;
  created_at: string;
}

interface TimelineEntry {
  id: string;
  actorName: string | null;
  action: string;
  remarks: string | null;
  createdAt: string;
}

interface TeamMember {
  id: string;
  full_name: string | null;
  email: string;
}

interface CaseDetail {
  case: Record<string, unknown>;
  emailEvents: EmailEvent[];
  timeline: TimelineEntry[];
  teamMembers: TeamMember[];
  ownerName: string | null;
}

export interface CaseRow {
  id: string;
  awb: string;
  current_status: string;
  clearance_type: string | null;
  pre_alert_type: string | null;
  issue_type: string | null;
  urgency: string | null;
  human_review_required: boolean;
  slipped?: boolean | null;
  owner_user_id: string | null;
  ownership_status: string | null;
  created_at: string;
  last_human_action_at: string | null;
  version?: number;
  latest_batch_run_id: string | null;
  batch_runs?: { run_name: string; run_date: string } | { run_name: string; run_date: string }[] | null;
  inbound_count?: number;
  outbound_count?: number;
  app_users?: { full_name: string | null; email: string } | { full_name: string | null; email: string }[] | null;
  next_action_label?: string;
  next_action_group?: string;
  next_action_sla?: string | null;
}

interface Props {
  cases: CaseRow[];
  columns: string[];
  showClaim?: boolean;
  currentUserId?: string;
}

const STATUS_DOT: Record<string, string> = {
  awaiting_reply: "bg-amber-400",
  reply_received: "bg-emerald-400",
  documents_provided: "bg-sky-400",
  boe_filed: "bg-blue-400",
  assessment_pending: "bg-amber-400",
  duty_assessed: "bg-violet-400",
  out_of_charge: "bg-emerald-500",
  do_ready: "bg-teal-400",
  do_collected: "bg-emerald-600",
  human_review: "bg-red-400",
  escalated: "bg-red-500",
  closed: "bg-slate-300",
};

const URGENCY_STYLES: Record<string, string> = {
  urgent: "bg-red-50 text-red-700 border-red-200",
  high: "bg-amber-50 text-amber-700 border-amber-200",
  normal: "bg-slate-50 text-slate-600 border-slate-200",
  low: "bg-slate-50 text-slate-400 border-slate-200",
};

const ISSUE_LABELS: Record<string, string> = {
  no_action: "No Action",
  info_only: "Info Only",
  payment_received: "Payment Received",
  pdf_invoice_request: "Invoice Request",
  checklist_request: "Checklist Request",
  status_query: "Status Query",
  reminder_needed: "Reminder Needed",
  special_case: "Special Case",
  escalation: "Escalation",
  unclear: "Unclear",
};

function timeAgo(date: string | null): string {
  if (!date) return "";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function getBatch(row: CaseRow): { run_name: string; run_date: string } | null {
  const b = row.batch_runs;
  if (!b) return null;
  if (Array.isArray(b)) return b[0] ?? null;
  return b;
}

export function SelectableTable({ cases, columns, showClaim, currentUserId }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [selectLimit, setSelectLimit] = useState(10);
  const [claiming, setClaiming] = useState(false);
  const [claimResult, setClaimResult] = useState<{ count: number } | null>(null);
  const [modalCase, setModalCase] = useState<CaseRow | null>(null);
  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [remarksDraft, setRemarksDraft] = useState("");
  const [assignTo, setAssignTo] = useState("");
  const [batchStatus, setBatchStatus] = useState("");
  const [batchUpdating, setBatchUpdating] = useState(false);

  const toggleIndex = useCallback((idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  }, []);

  const toggleAll = useCallback(() => {
    setSelected((prev) => {
      if (prev.size === cases.length) return new Set();
      return new Set(cases.map((_, i) => i));
    });
  }, [cases.length]);

  const handleAdd10 = useCallback(() => {
    const newLimit = Math.min(selectLimit + 10, cases.length);
    setSelectLimit(newLimit);
    setSelected(new Set(cases.map((_, i) => i < newLimit ? i : -1).filter((i) => i >= 0)));
  }, [selectLimit, cases.length]);

  const handleClaim = useCallback(async () => {
    if (selected.size === 0) return;
    setClaiming(true);
    const ids = Array.from(selected).map((i) => cases[i]?.id).filter(Boolean);
    try {
      const res = await fetch("/api/cases/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseIds: ids }),
      });
      const data = await res.json();
      if (res.ok) {
        setClaimResult({ count: data.claimed });
        setSelected(new Set());
        router.refresh();
      } else {
        toast.error(data.error ?? "Claim failed");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Network error");
    } finally {
      setClaiming(false);
    }
  }, [selected, cases, router]);

  const openDetail = useCallback(async (row: CaseRow) => {
    setModalCase(row);
    setLoadingDetail(true);
    setCaseDetail(null);
    setRemarksDraft("");
    setAssignTo("");
    try {
      const res = await fetch(`/api/cases/${row.id}/detail`);
      if (res.ok) {
        const data = await res.json();
        setCaseDetail(data);
        setRemarksDraft((data.case as Record<string, string>)?.remarks ?? "");
      } else {
        toast.error("Failed to load case details.");
      }
    } catch {
      toast.error("Network error loading details.");
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const isSlip = (row: CaseRow): boolean =>
    (row.slipped ?? false) || (row.current_status === "awaiting_reply" && !!row.last_human_action_at &&
      (Date.now() - new Date(row.last_human_action_at).getTime()) > 48 * 3600000);

  const isAiHandled = (row: CaseRow): boolean =>
    !row.human_review_required && row.current_status === "closed";

  return (
    <div>
      {/* Bulk bar */}
      {cases.length > 0 ? (
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={toggleAll}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted">
            <CheckSquare className="h-3.5 w-3.5" />
            {selected.size === cases.length ? "Deselect all" : `Select all (${cases.length})`}
          </button>
          <button type="button" onClick={handleAdd10}
            disabled={selectLimit >= cases.length}
            className="inline-flex items-center gap-1.5 rounded-md border border-input bg-card px-3 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-30">
            <Plus className="h-3.5 w-3.5" />
            +10 (up to {Math.min(selectLimit + 10, cases.length)})
          </button>
          {selected.size > 0 ? (
            <>
              <span className="text-xs text-muted-foreground">{selected.size} selected</span>
              <button type="button" onClick={() => { setSelected(new Set()); setSelectLimit(10); }}
                className="text-xs text-muted-foreground hover:text-foreground">Clear</button>
              {showClaim ? (
                <button type="button" onClick={handleClaim} disabled={claiming}
                  className="inline-flex items-center gap-1.5 rounded-md bg-sidebar-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-sidebar-primary/90 disabled:opacity-50">
                  <Hand className="h-3.5 w-3.5" />
                  {claiming ? "Claiming..." : "Claim selected"}
                </button>
              ) : null}
              {/* Batch status update */}
              <select value={batchStatus} onChange={(e) => setBatchStatus(e.target.value)}
                className="h-7 rounded border border-input bg-background px-1.5 text-xs">
                <option value="">Update status to...</option>
                <option value="closed">Closed</option>
                <option value="escalated">Escalated</option>
                <option value="human_review">Human Review</option>
              </select>
              <button type="button" onClick={async () => {
                if (!batchStatus) { toast.error("Select a status first."); return; }
                setBatchUpdating(true);
                const ids = Array.from(selected).map((i) => cases[i]?.id).filter(Boolean);
                try {
                  const res = await fetch("/api/cases/batch-update", {
                    method: "POST", headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ caseIds: ids, currentStatus: batchStatus }),
                  });
                  const data = await res.json();
                  if (res.ok) {
                    toast.success(`${data.succeeded} case(s) updated.${data.failed > 0 ? ` ${data.failed} failed.` : ""}`);
                    setSelected(new Set());
                    setBatchStatus("");
                    router.refresh();
                  } else { toast.error(data.error ?? "Batch update failed."); }
                } catch { toast.error("Network error."); }
                finally { setBatchUpdating(false); }
              }} disabled={!batchStatus || batchUpdating}
                className="inline-flex items-center gap-1.5 rounded-md border border-input bg-card px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-30">
                {batchUpdating ? "Updating..." : "Go"}
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <table className="min-w-full divide-y divide-border">
          <thead>
            <tr className="bg-muted/50">
              <th className="w-10 px-2 py-3 text-center">
                <input type="checkbox"
                  checked={selected.size === cases.length && cases.length > 0}
                  onChange={toggleAll}
                  className="h-4 w-4 rounded border-input accent-sidebar-primary" />
              </th>
              {columns.map((col) => (
                <th key={col} className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {col === "batch" ? "Batch" : col === "awb" ? "AWB" : col === "type" ? "Type" : col === "status" ? "Status" : col === "issue" ? "Issue" : col === "urgency" ? "Urgency" : col === "owner" ? "Owner" : col === "inout" ? "In/Out" : col === "updated" ? "Updated" : col === "slipped" ? "Slipped" : col === "ai_flag" ? "AI Flag" : col}
                </th>
              ))}
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {cases.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 2} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  <p className="font-medium">No cases match</p>
                </td>
              </tr>
            ) : (
              cases.map((row, idx) => {
                const batch = getBatch(row);
                const slip = isSlip(row);
                const ai = isAiHandled(row);
                const showSlipped = columns.includes("slipped");
                const showAiFlag = columns.includes("ai_flag");
                return (
                  <tr key={row.id}
                    className={`transition-colors hover:bg-muted/30 ${slip ? "bg-red-50/30" : ai ? "bg-emerald-50/20" : ""}`}>
                    <td className="px-2 py-3 text-center">
                      <input type="checkbox"
                        checked={selected.has(idx)}
                        onChange={() => toggleIndex(idx)}
                        className="h-4 w-4 rounded border-input accent-sidebar-primary" />
                    </td>
                    <td className="px-3 py-3">
                      {batch ? (
                        <Link href={`/batches/${row.latest_batch_run_id}/summary`}
                          className="text-xs font-medium text-sidebar-primary underline-offset-2 hover:underline">
                          {batch.run_name}
                        </Link>
                      ) : <span className="text-xs text-muted-foreground/50">&mdash;</span>}
                    </td>
                    <td className="px-3 py-3">
                      <button type="button" onClick={() => openDetail(row)}
                        className="flex items-center gap-1 font-mono text-sm font-medium text-sidebar-primary underline-offset-2 hover:underline">
                        {row.awb}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </button>
                    </td>
                    {columns.includes("type") ? (
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          {row.pre_alert_type && TYPE_BADGE[row.pre_alert_type] ? (
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_BADGE[row.pre_alert_type].bg} ${TYPE_BADGE[row.pre_alert_type].text}`}>
                              {TYPE_BADGE[row.pre_alert_type].label}
                            </span>
                          ) : null}
                          {row.clearance_type && CLEARANCE_DISPLAY[row.clearance_type] ? (
                            <span className={`inline-flex items-center gap-1.5 rounded-full ${CLEARANCE_DISPLAY[row.clearance_type].bg} ${CLEARANCE_DISPLAY[row.clearance_type].text} px-2 py-0.5 text-xs font-medium`}>
                              <span className={`inline-block h-1.5 w-1.5 rounded-full ${CLEARANCE_DISPLAY[row.clearance_type].dot}`} />
                              {CLEARANCE_DISPLAY[row.clearance_type].label}
                            </span>
                          ) : <span className="text-xs text-muted-foreground/50">&mdash;</span>}
                        </div>
                      </td>
                    ) : null}
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-block h-2 w-2 rounded-full ${STATUS_DOT[row.current_status] ?? "bg-slate-300"}`} />
                        <span className="text-sm text-muted-foreground">{statusLabel(row.current_status)}</span>
                        {ai ? <Bot className="h-3 w-3 text-emerald-500" /> :
                          row.human_review_required ? <ShieldAlert className="h-3 w-3 text-amber-500" /> : null}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-muted-foreground">
                      {row.issue_type ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          {ISSUE_LABELS[row.issue_type] ?? row.issue_type}
                        </span>
                      ) : <span className="text-xs text-muted-foreground/50">&mdash;</span>}
                    </td>
                    <td className="px-3 py-3">
                      {row.urgency ? (
                        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${URGENCY_STYLES[row.urgency] ?? URGENCY_STYLES.normal}`}>
                          {row.urgency}
                        </span>
                      ) : <span className="text-xs text-muted-foreground/50">&mdash;</span>}
                    </td>
                    {columns.includes("owner") ? (
                      <td className="px-3 py-3 text-sm text-muted-foreground">
                        {(() => {
                          const o = row.app_users;
                          const owner = Array.isArray(o) ? o[0] : o;
                          return owner ? (
                            <span className="text-xs font-medium">{owner.full_name ?? owner.email}</span>
                          ) : row.owner_user_id ? (
                            <span className="text-xs font-mono text-muted-foreground/50">{row.owner_user_id.slice(0, 8)}...</span>
                          ) : <span className="text-muted-foreground/50">Unassigned</span>;
                        })()}
                      </td>
                    ) : null}
                    {columns.includes("inout") ? (
                      <td className="px-3 py-3 text-sm text-muted-foreground">
                        <span className="text-xs"><span className="text-emerald-600">{row.inbound_count ?? 0}</span> / <span className="text-sky-600">{row.outbound_count ?? 0}</span></span>
                      </td>
                    ) : null}
                    <td className="px-3 py-3 text-xs text-muted-foreground">
                      {timeAgo(row.last_human_action_at ?? row.created_at)}
                    </td>
                    {showSlipped ? (
                      <td className="px-3 py-3 text-center">
                        {slip ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                            <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-400" />Slipped
                          </span>
                        ) : <span className="text-sm text-muted-foreground/30">&mdash;</span>}
                      </td>
                    ) : null}
                    {showAiFlag ? (
                      <td className="px-3 py-3">
                        {row.human_review_required ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                            <AlertTriangle className="h-3 w-3" />Needs review
                          </span>
                        ) : row.current_status === "reply_received" ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-0.5 text-xs font-medium text-sky-700">Reply received</span>
                        ) : <span className="text-sm text-muted-foreground/50">&mdash;</span>}
                      </td>
                    ) : null}
                    <td className="px-3 py-3 text-right">
                      <button type="button" onClick={() => openDetail(row)} className="text-xs font-medium text-sidebar-primary hover:underline">View</button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {/* Claim success popup */}
      <Dialog
        open={claimResult !== null}
        onOpenChange={(open) => { if (!open) setClaimResult(null); }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-700">
              <Hand className="h-5 w-5" />
              Cases claimed
            </DialogTitle>
            <DialogDescription>
              {claimResult?.count ?? 0} case(s) assigned to you. Track them and mark DO collection in My Cases.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2 sm:justify-center">
            <button
              type="button"
              onClick={() => { setClaimResult(null); router.refresh(); }}
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

      {/* Case detail modal */}
      <Dialog
        open={modalCase !== null}
        onOpenChange={(open) => { if (!open) { setModalCase(null); setCaseDetail(null); } }}
      >
        <DialogContent className="!max-w-6xl max-h-[95vh] overflow-y-auto p-0">
          {loadingDetail ? (
            <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">Loading...</div>
          ) : caseDetail ? (
            <div className="flex flex-col h-full">
              {/* Sticky header bar */}
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-popover px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-lg font-semibold text-foreground">{modalCase?.awb}</span>
                  {modalCase && <StatusBadge status={modalCase.current_status} />}
                  {modalCase && <StatusBadge status={modalCase.ownership_status ?? ""} />}
                </div>
                <div className="flex items-center gap-2">
                  {(() => {
                    const c = caseDetail.case as Record<string, string>;
                    const isOwner = c.owner_user_id === currentUserId;
                    const isUnassigned = c.ownership_status === "unassigned";
                    return (
                      <>
                        {isUnassigned && currentUserId ? (
                          <button type="button" onClick={async () => {
                            try {
                              const res = await fetch(`/api/cases/${modalCase!.id}/claim`, {
                                method: "POST", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ version: 1 }),
                              });
                              if (res.ok) {
                                toast.success("Case claimed.");
                                setModalCase(null); setCaseDetail(null);
                                router.refresh();
                              } else {
                                const data = await res.json();
                                toast.error(data.error ?? "Claim failed");
                              }
                            } catch { toast.error("Network error"); }
                          }} className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">
                            Claim
                          </button>
                        ) : null}
                        {!isUnassigned && isOwner ? (
                          <button type="button" onClick={async () => {
                            try {
                              const res = await fetch(`/api/cases/${modalCase!.id}/release`, {
                                method: "POST", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ version: 1 }),
                              });
                              if (res.ok) {
                                toast.success("Case released.");
                                setModalCase(null); setCaseDetail(null);
                                router.refresh();
                              } else {
                                const data = await res.json();
                                toast.error(data.error ?? "Release failed");
                              }
                            } catch { toast.error("Network error"); }
                          }} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                            Release
                          </button>
                        ) : null}
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Scrollable body: two-column layout */}
              <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-3">
                {/* Left: Email Thread + Remarks */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Email Thread */}
                  {caseDetail.emailEvents.length > 0 ? (
                    <div>
                      <h4 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                        <Mail className="h-4 w-4" />
                        Email Thread
                      </h4>
                      <div className="space-y-3">
                        {caseDetail.emailEvents.map((event) => (
                          <div key={event.id}
                            className={`rounded-lg border ${
                              event.direction === "outbound"
                                ? "border-blue-200 bg-blue-50/50"
                                : "border-emerald-200 bg-emerald-50/30"
                            }`}>
                            <div className="flex items-center justify-between border-b border-inherit px-4 py-2.5">
                              <div className="flex items-center gap-2 text-xs">
                                <span className={`rounded px-1.5 py-0.5 font-medium ${
                                  event.direction === "outbound"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-emerald-100 text-emerald-700"
                                }`}>
                                  {event.direction === "outbound" ? "SENT" : "REPLY"}
                                </span>
                                <span className="text-muted-foreground">
                                  {event.direction === "outbound"
                                    ? `To: ${event.recipient_emails?.join(", ") ?? "—"}`
                                    : `From: ${event.sender_email ?? "—"}`}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {new Date(event.created_at).toLocaleString("en-IN", {
                                  day: "numeric", month: "short", year: "numeric",
                                  hour: "2-digit", minute: "2-digit",
                                })}
                              </span>
                            </div>
                            <div className="px-4 py-3">
                              <p className="text-sm font-medium text-foreground mb-1">
                                {event.subject ?? "(no subject)"}
                              </p>
                              {event.body_clean ? (
                                <div className="prose prose-sm max-w-none text-muted-foreground text-xs leading-relaxed"
                                  dangerouslySetInnerHTML={{ __html: event.body_clean }} />
                              ) : (
                                <p className="text-xs text-muted-foreground italic">(no content)</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                {/* Right sidebar */}
                <div className="space-y-6">
                  {/* Case Info */}
                  <div className="rounded-lg border border-border bg-card p-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Case Info</h4>
                    <dl className="space-y-2.5 text-sm">
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Issue</dt>
                        <dd className="font-medium text-foreground">{(caseDetail.case as Record<string, string>)?.issue_type ?? "\u2014"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Urgency</dt>
                        <dd className="font-medium text-foreground">{(caseDetail.case as Record<string, string>)?.urgency ?? "\u2014"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Status</dt>
                        <dd className="font-medium capitalize text-foreground">{statusLabel((caseDetail.case as Record<string, string>)?.current_status ?? "")}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Type</dt>
                        <dd className="font-medium text-foreground">
                          {(() => {
                            const ct = (caseDetail.case as Record<string, string>)?.clearance_type;
                            const config = ct ? CLEARANCE_DISPLAY[ct] : null;
                            return config ? (
                              <span className={`inline-flex items-center gap-1 rounded-full ${config.bg} ${config.text} px-2 py-0.5 text-xs font-medium`}>
                                <span className={`inline-block h-1.5 w-1.5 rounded-full ${config.dot}`} />
                                {config.label}
                              </span>
                            ) : "\u2014";
                          })()}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Owner</dt>
                        <dd className="font-medium text-foreground">{caseDetail.ownerName ?? "Unassigned"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Emails</dt>
                        <dd className="font-medium text-foreground">{caseDetail.emailEvents.length} ({caseDetail.emailEvents.filter((e) => e.direction === "outbound").length} sent / {caseDetail.emailEvents.filter((e) => e.direction === "inbound").length} replies)</dd>
                      </div>
                    </dl>
                  </div>

                  {/* Clearance Tracker */}
                  <ClearanceTracker
                    caseData={caseDetail.case}
                    caseId={modalCase?.id ?? ""}
                    currentUserId={currentUserId}
                    onAction={() => { setModalCase(null); setCaseDetail(null); }}
                  />

                  {/* Quick Actions */}
                  {(() => {
                    const c = caseDetail.case as Record<string, string>;
                    const isOwner = c.owner_user_id === currentUserId;
                    const isUnassigned = c.ownership_status === "unassigned";
                    if (!isOwner && !isUnassigned) return null;
                    return (
                      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick Actions</h4>

                        <div className="flex flex-wrap gap-1.5">
                          <button type="button" onClick={async () => {
                            try {
                              const res = await fetch(`/api/cases/${modalCase!.id}/update`, {
                                method: "POST", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ version: 1, currentStatus: "escalated" }),
                              });
                              if (res.ok) {
                                toast.success("Case escalated.");
                                setModalCase(null); setCaseDetail(null);
                                router.refresh();
                              } else { const d = await res.json(); toast.error(d.error ?? "Escalate failed"); }
                            } catch { toast.error("Network error"); }
                          }} className="rounded border border-red-300 px-2.5 py-1 text-xs font-medium text-red-700 transition hover:bg-red-50">
                            Escalate
                          </button>
                          <button type="button" onClick={async () => {
                            try {
                              const res = await fetch(`/api/cases/${modalCase!.id}/update`, {
                                method: "POST", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ version: 1, currentStatus: "closed" }),
                              });
                              if (res.ok) {
                                toast.success("Case closed.");
                                setModalCase(null); setCaseDetail(null);
                                router.refresh();
                              } else { const d = await res.json(); toast.error(d.error ?? "Close failed"); }
                            } catch { toast.error("Network error"); }
                          }} className="rounded border border-emerald-300 px-2.5 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50">
                            Close
                          </button>
                        </div>

                        {/* Assign dropdown (for owner) */}
                        {isOwner && caseDetail.teamMembers.length > 0 ? (
                          <div className="flex items-center gap-2 pt-2 border-t border-border">
                            <select value={assignTo} onChange={(e) => setAssignTo(e.target.value)}
                              className="h-8 flex-1 rounded border border-input bg-background px-2 text-xs">
                              <option value="">Assign to...</option>
                              {caseDetail.teamMembers
                                .filter((m) => m.id !== c.owner_user_id)
                                .map((m) => (
                                  <option key={m.id} value={m.id}>{m.full_name ?? m.email}</option>
                                ))}
                            </select>
                            <button type="button" disabled={!assignTo} onClick={async () => {
                              try {
                                const res = await fetch(`/api/cases/${modalCase!.id}/assign`, {
                                  method: "POST", headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ version: 1, toUserId: assignTo }),
                                });
                                if (res.ok) {
                                  toast.success("Case assigned.");
                                  setModalCase(null); setCaseDetail(null);
                                  router.refresh();
                                } else { const d = await res.json(); toast.error(d.error ?? "Assign failed"); }
                              } catch { toast.error("Network error"); }
                            }} className="rounded border border-input px-2.5 py-1 text-xs font-medium text-foreground transition hover:bg-muted disabled:opacity-30">
                              Assign
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })()}

                  {/* Editable Remarks */}
                  {(() => {
                    const c = caseDetail.case as Record<string, string>;
                    const isOwner = c.owner_user_id === currentUserId;
                    const isUnassigned = c.ownership_status === "unassigned";
                    const canEdit = isOwner || isUnassigned;
                    return (
                      <div className="rounded-lg border border-border bg-card p-4">
                        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Remarks</h4>
                        <textarea value={remarksDraft}
                          onChange={(e) => setRemarksDraft(e.target.value)}
                          disabled={!canEdit}
                          rows={3}
                          className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-xs disabled:bg-muted/50" />
                        {canEdit ? (
                          <button type="button" onClick={async () => {
                            try {
                              const res = await fetch(`/api/cases/${modalCase!.id}/update`, {
                                method: "POST", headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ version: 1, remarks: remarksDraft }),
                              });
                              if (res.ok) {
                                toast.success("Remarks saved.");
                                router.refresh();
                              } else { const d = await res.json(); toast.error(d.error ?? "Save failed"); }
                            } catch { toast.error("Network error"); }
                          }} className="mt-2 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-800">
                            Save remarks
                          </button>
                        ) : null}
                      </div>
                    );
                  })()}

                  {/* Timeline */}
                  <div className="rounded-lg border border-border bg-card p-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Timeline</h4>
                    <ol className="space-y-3">
                      {caseDetail.timeline.map((entry) => (
                        <li key={entry.id} className="text-xs">
                          <p className="font-medium capitalize text-foreground">{entry.action.replace(/_/g, " ")}</p>
                          <p className="text-muted-foreground">{entry.actorName ?? "System"} &middot; {new Date(entry.createdAt).toLocaleString()}</p>
                          {entry.remarks ? <p className="mt-0.5 text-foreground/70">{entry.remarks}</p> : null}
                        </li>
                      ))}
                      {caseDetail.timeline.length === 0 ? <p className="text-muted-foreground">No activity yet.</p> : null}
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
