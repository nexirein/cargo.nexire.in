"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { statusLabel } from "@/lib/cases/status";
import { CLEARANCE_DISPLAY } from "@/lib/cases/clearance-type";
import { ClearanceTracker } from "@/components/cases/clearance-tracker";
import {
  Phone, FileCheck, ExternalLink, Mail, Loader2, Search,
  AlertTriangle, Eye, ChevronDown, ChevronRight,
} from "lucide-react";

const ALL_STATUSES = [
  "awaiting_reply", "reply_received", "documents_provided", "boe_filed",
  "assessment_pending", "duty_assessed", "out_of_charge", "do_ready",
  "do_collected", "human_review", "escalated", "closed",
];

interface CaseRow {
  id: string;
  awb: string;
  current_status: string;
  clearance_type: string | null;
  pre_alert_type: string | null;
  ownership_status: string;
  issue_type: string | null;
  urgency: string | null;
  do_number: string | null;
  do_collected_at: string | null;
  do_ready_at: string | null;
  claimed_at: string | null;
  owner_user_id: string | null;
  version: number;
  pending_info: unknown;
  last_called_at: string | null;
  created_at: string;
  next_action_id: string;
  next_action_label: string;
  next_action_group: string;
  next_action_sla: string | null;
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

interface TimelineEntry {
  id: string;
  actorName: string | null;
  action: string;
  remarks: string | null;
  createdAt: string;
}

interface CaseDetail {
  case: Record<string, unknown>;
  emailEvents: EmailEvent[];
  timeline: TimelineEntry[];
}

type SectionKey = "action_required" | "monitoring" | "completed";

interface SectionMeta {
  key: SectionKey;
  label: string;
  icon: string;
  bg: string;
  border: string;
}

const SECTIONS: SectionMeta[] = [
  { key: "action_required", label: "Action Required", icon: "📞", bg: "bg-red-50/30", border: "border-red-200" },
  { key: "monitoring", label: "Monitoring", icon: "👁️", bg: "bg-sky-50/20", border: "border-sky-200" },
  { key: "completed", label: "Completed", icon: "✅", bg: "bg-slate-50/20", border: "border-slate-200" },
];

export function MyCasesList({
  currentUserId,
  cases,
}: {
  currentUserId: string;
  cases: CaseRow[];
}) {
  const router = useRouter();
  const [doInputs, setDoInputs] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [changingStatus, setChangingStatus] = useState<Record<string, boolean>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    completed: true,
  });
  const [selectedCase, setSelectedCase] = useState<CaseRow | null>(null);
  const [caseDetail, setCaseDetail] = useState<CaseDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // --- Inline status change ---
  async function handleStatusChange(c: CaseRow, newStatus: string) {
    if (newStatus === c.current_status) return;
    setChangingStatus((prev) => ({ ...prev, [c.id]: true }));
    try {
      const res = await fetch(`/api/cases/${c.id}/update`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ version: c.version, currentStatus: newStatus }),
      });
      if (res.ok) {
        toast.success(`${c.awb}: ${statusLabel(newStatus)}`);
        router.refresh();
      } else {
        const data = await res.json();
        if (res.status === 409) {
          toast.error(data.error ?? "Version conflict — refresh and try again.");
          router.refresh();
        } else {
          toast.error(data.error ?? "Status update failed.");
        }
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setChangingStatus((prev) => ({ ...prev, [c.id]: false }));
    }
  }

  // --- DO Collection ---
  async function markDoCollected(c: CaseRow) {
    const doNumber = doInputs[c.id]?.trim();
    if (!doNumber) {
      toast.error("Enter a DO number first.");
      return;
    }
    setSaving((prev) => ({ ...prev, [c.id]: true }));
    try {
      const res = await fetch(`/api/cases/${c.id}/do-collect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doNumber }),
      });
      if (res.ok) {
        toast.success(`DO ${doNumber} collected for ${c.awb}`);
        router.refresh();
      } else {
        const body = await res.json().catch(() => ({}));
        toast.error(body.error ?? "Failed to mark DO collected.");
      }
    } catch {
      toast.error("Network error.");
    } finally {
      setSaving((prev) => ({ ...prev, [c.id]: false }));
    }
  }

  // --- Detail modal ---
  const openDetail = useCallback(async (c: CaseRow) => {
    setSelectedCase(c);
    setLoadingDetail(true);
    setCaseDetail(null);
    try {
      const res = await fetch(`/api/cases/${c.id}/detail`);
      if (res.ok) {
        setCaseDetail(await res.json());
      } else {
        toast.error("Failed to load case details.");
      }
    } catch {
      toast.error("Network error loading details.");
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  // --- Filter + group ---
  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return cases.filter((c) => {
      const ms = !q || c.awb.toLowerCase().includes(q) || (c.issue_type ?? "").toLowerCase().includes(q);
      const mst = statusFilter === "all" || c.current_status === statusFilter;
      const mt = typeFilter === "all" || c.clearance_type === typeFilter;
      return ms && mst && mt;
    });
  }, [cases, searchQuery, statusFilter, typeFilter]);

  const grouped = useMemo(() => {
    const groups: Record<SectionKey, CaseRow[]> = {
      action_required: [],
      monitoring: [],
      completed: [],
    };
    for (const c of filtered) {
      const g = c.next_action_group as SectionKey;
      if (groups[g]) groups[g].push(c);
      else groups.monitoring.push(c);
    }
    return groups;
  }, [filtered]);

  const counts = useMemo(() => ({
    action_required: grouped.action_required.length,
    monitoring: grouped.monitoring.length,
    completed: grouped.completed.length,
  }), [grouped]);

  if (cases.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-12 text-center">
        <FileCheck className="h-10 w-10 text-muted-foreground/30" />
        <p className="mt-4 font-medium text-foreground">No claimed cases yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Claim cases from the Cases or Human Review page to see them here.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Summary cards */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-red-200 bg-red-50/50 p-3">
          <p className="text-xs font-medium text-red-700">📞 Action Required</p>
          <p className="mt-1 text-xl font-bold text-red-800">{counts.action_required}</p>
          <p className="text-xs text-red-600">Needs your attention now</p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50/50 p-3">
          <p className="text-xs font-medium text-sky-700">👁️ Monitoring</p>
          <p className="mt-1 text-xl font-bold text-sky-800">{counts.monitoring}</p>
          <p className="text-xs text-sky-600">In progress, no action needed</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
          <p className="text-xs font-medium text-slate-600">✅ Completed</p>
          <p className="mt-1 text-xl font-bold text-slate-700">{counts.completed}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
          <p className="text-xs font-medium text-emerald-700">📄 DO Collected</p>
          <p className="mt-1 text-xl font-bold text-emerald-800">
            {cases.filter((c) => c.current_status === "do_collected" || c.current_status === "closed").length}
          </p>
        </div>
      </div>

      {/* Filter bar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search AWB or issue..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-md border border-input bg-background py-2 pl-8 pr-3 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-sidebar-primary/30"
          />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-sidebar-primary/30">
          <option value="all">All types</option>
          <option value="nfbrk">NFBRK</option>
          <option value="febrk-jeena">FEBRK-Jeena</option>
          <option value="febrk-sunimpex">FEBRK-Sunimpex</option>
          <option value="calling">Calling</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-sidebar-primary/30">
          <option value="all">All statuses</option>
          {ALL_STATUSES.map((s) => (<option key={s} value={s}>{statusLabel(s)}</option>))}
        </select>
        {(searchQuery || statusFilter !== "all" || typeFilter !== "all") ? (
          <button type="button" onClick={() => { setSearchQuery(""); setStatusFilter("all"); setTypeFilter("all"); }}
            className="text-xs text-muted-foreground hover:text-foreground">Clear filters</button>
        ) : null}
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} of {cases.length} case{filtered.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {SECTIONS.map((section) => {
          const items = grouped[section.key];
          if (items.length === 0) return null;
          const isCollapsed = collapsedSections[section.key] ?? false;
          return (
            <div key={section.key} className={`rounded-xl border ${section.border} ${section.bg} overflow-hidden`}>
              {/* Section header */}
              <button type="button" onClick={() => setCollapsedSections((p) => ({ ...p, [section.key]: !isCollapsed }))}
                className="flex w-full items-center gap-2 px-4 py-3 text-left transition hover:bg-black/5">
                {isCollapsed ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                <span className="text-sm font-semibold text-foreground">
                  {section.icon} {section.label}
                </span>
                <span className="ml-auto rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                  {items.length}
                </span>
              </button>

              {!isCollapsed ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-border text-sm">
                    <thead className="bg-muted/30 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2">AWB</th>
                        <th className="px-4 py-2">Type</th>
                        <th className="px-4 py-2">Status</th>
                        <th className="px-4 py-2">Next Action</th>
                        <th className="px-4 py-2">DO / Call</th>
                        <th className="px-4 py-2" />
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {items.map((c) => {
                        const isDoCollected = c.current_status === "do_collected";
                        const isDoReady = c.current_status === "do_ready" && !isDoCollected;
                        const typeConf = c.clearance_type ? CLEARANCE_DISPLAY[c.clearance_type] : null;
                        const isActionSection = section.key === "action_required";
                        const isSlaOverdue = c.next_action_sla && new Date(c.next_action_sla) < new Date();
                        return (
                          <tr key={c.id} className={`transition-colors hover:bg-muted/20 ${isSlaOverdue ? "bg-red-50/40" : ""}`}>
                            <td className="px-4 py-2">
                              <button type="button" onClick={() => openDetail(c)}
                                className="flex items-center gap-1 font-mono text-sm font-medium text-sidebar-primary hover:underline">
                                {c.awb}
                                <ExternalLink className="h-3 w-3 shrink-0" />
                              </button>
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-1.5">
                                {c.pre_alert_type && (c.pre_alert_type === "u_bond" || c.pre_alert_type === "consol") ? (
                                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                    c.pre_alert_type === "u_bond" ? "bg-sky-100 text-sky-700" : "bg-indigo-100 text-indigo-700"
                                  }`}>
                                    {c.pre_alert_type === "u_bond" ? "uBond" : "Consol"}
                                  </span>
                                ) : null}
                                {typeConf ? (
                                  <span className={`inline-flex items-center gap-1 rounded-full ${typeConf.bg} ${typeConf.text} px-2 py-0.5 text-xs font-medium`}>
                                    <span className={`inline-block h-1.5 w-1.5 rounded-full ${typeConf.dot}`} />
                                    {typeConf.label}
                                  </span>
                                ) : <span className="text-xs text-muted-foreground/50">&mdash;</span>}
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-1.5">
                                <select value={c.current_status}
                                  onChange={(e) => handleStatusChange(c, e.target.value)}
                                  disabled={changingStatus[c.id]}
                                  className={`h-7 rounded border border-input bg-background px-1.5 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-sidebar-primary/50 ${changingStatus[c.id] ? "opacity-50" : ""}`}>
                                  {ALL_STATUSES.map((s) => (
                                    <option key={s} value={s}>{statusLabel(s)}</option>
                                  ))}
                                </select>
                                {changingStatus[c.id] ? <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" /> : null}
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              <div className="flex items-center gap-1.5">
                                {isSlaOverdue ? (
                                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                                ) : null}
                                <span className={`text-xs font-medium ${isSlaOverdue ? "text-red-700" : isActionSection ? "text-foreground" : "text-muted-foreground"}`}>
                                  {c.next_action_label}
                                </span>
                              </div>
                            </td>
                            <td className="px-4 py-2">
                              {isDoReady ? (
                                <div className="flex items-center gap-1.5">
                                  <input type="text" placeholder="DO#"
                                    value={doInputs[c.id] ?? ""}
                                    onChange={(e) => setDoInputs((prev) => ({ ...prev, [c.id]: e.target.value }))}
                                    className="h-7 w-20 rounded border border-input bg-background px-2 text-xs" />
                                  <button type="button" onClick={() => markDoCollected(c)}
                                    disabled={saving[c.id]}
                                    className="whitespace-nowrap rounded bg-emerald-600 px-2 py-1 text-[10px] font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50">
                                    {saving[c.id] ? "..." : "Collect DO"}
                                  </button>
                                </div>
                              ) : isDoCollected ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                                  <FileCheck className="h-3 w-3" /> {c.do_number}
                                </span>
                              ) : c.current_status === "closed" ? (
                                <span className="text-xs text-muted-foreground/50">&mdash;</span>
                              ) : (
                                <button type="button" onClick={() => openDetail(c)}
                                  className="inline-flex items-center gap-1 text-xs font-medium text-sidebar-primary hover:underline">
                                  <Eye className="h-3 w-3" />
                                  View
                                </button>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right">
                              <button type="button" onClick={() => openDetail(c)}
                                className="text-xs font-medium text-sidebar-primary hover:underline">Details</button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </div>
          );
        })}

        {filtered.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
            <p className="text-sm text-muted-foreground">No cases match your filters.</p>
          </div>
        ) : null}
      </div>

      {/* Detail modal */}
      <Dialog open={selectedCase !== null}
        onOpenChange={(open) => { if (!open) { setSelectedCase(null); setCaseDetail(null); } }}>
        <DialogContent className="!max-w-6xl max-h-[95vh] overflow-y-auto p-0">
          {loadingDetail ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : caseDetail ? (
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-popover px-6 py-4">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-lg font-semibold text-foreground">{selectedCase?.awb}</span>
                  {selectedCase && <StatusBadge status={selectedCase.current_status} />}
                  {selectedCase && <StatusBadge status={selectedCase.ownership_status ?? ""} />}
                </div>
                <div className="flex items-center gap-2">
                  {selectedCase && !isDoCollectedOrClosed(selectedCase) ? (
                    <div className="flex items-center gap-1.5">
                      <input type="text" placeholder="DO#"
                        value={doInputs[selectedCase.id] ?? ""}
                        onChange={(e) => setDoInputs((prev) => ({ ...prev, [selectedCase.id]: e.target.value }))}
                        className="h-8 w-28 rounded border border-input bg-background px-2 text-xs" />
                      <button type="button" onClick={() => markDoCollected(selectedCase)}
                        disabled={saving[selectedCase.id]}
                        className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50">
                        {saving[selectedCase.id] ? "..." : "DO Collected"}
                      </button>
                    </div>
                  ) : selectedCase?.current_status === "do_collected" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                      <FileCheck className="h-3 w-3" /> DO: {selectedCase.do_number}
                    </span>
                  ) : null}
                </div>
              </div>

              {/* Body */}
              <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                  {caseDetail.emailEvents.length > 0 ? (
                    <div>
                      <h4 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-foreground">
                        <Mail className="h-4 w-4" /> Email Thread
                      </h4>
                      <div className="space-y-3">
                        {caseDetail.emailEvents.map((event) => (
                          <div key={event.id}
                            className={`rounded-lg border ${event.direction === "outbound" ? "border-blue-200 bg-blue-50/50" : "border-emerald-200 bg-emerald-50/30"}`}>
                            <div className="flex items-center justify-between border-b border-inherit px-4 py-2.5">
                              <div className="flex items-center gap-2 text-xs">
                                <span className={`rounded px-1.5 py-0.5 font-medium ${event.direction === "outbound" ? "bg-blue-100 text-blue-700" : "bg-emerald-100 text-emerald-700"}`}>
                                  {event.direction === "outbound" ? "SENT" : "REPLY"}
                                </span>
                                <span className="text-muted-foreground">
                                  {event.direction === "outbound" ? `To: ${event.recipient_emails?.join(", ") ?? "—"}` : `From: ${event.sender_email ?? "—"}`}
                                </span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {new Date(event.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            <div className="px-4 py-3">
                              <p className="text-sm font-medium text-foreground mb-1">{event.subject ?? "(no subject)"}</p>
                              {event.body_clean ? (
                                <div className="prose prose-sm max-w-none text-muted-foreground text-xs leading-relaxed"
                                  dangerouslySetInnerHTML={{ __html: event.body_clean }} />
                              ) : <p className="text-xs text-muted-foreground italic">(no content)</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-6">
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
                            const ctVal = (caseDetail.case as Record<string, string>)?.clearance_type;
                            const config = ctVal ? CLEARANCE_DISPLAY[ctVal] : null;
                            return config ? (
                              <span className={`inline-flex items-center gap-1 rounded-full ${config.bg} ${config.text} px-2 py-0.5 text-xs font-medium`}>
                                <span className={`inline-block h-1.5 w-1.5 rounded-full ${config.dot}`} />{config.label}
                              </span>
                            ) : "\u2014";
                          })()}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Next Action</dt>
                        <dd className="font-medium text-foreground text-xs">{selectedCase?.next_action_label ?? "\u2014"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">DO Number</dt>
                        <dd className="font-medium text-foreground">{(caseDetail.case as Record<string, string>)?.do_number ?? "\u2014"}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-muted-foreground">Emails</dt>
                        <dd className="font-medium text-foreground">{caseDetail.emailEvents.length} ({caseDetail.emailEvents.filter((e) => e.direction === "outbound").length} sent / {caseDetail.emailEvents.filter((e) => e.direction === "inbound").length} replies)</dd>
                      </div>
                    </dl>
                  </div>

                  <ClearanceTracker
                    caseData={caseDetail.case}
                    caseId={selectedCase?.id ?? ""}
                    currentUserId={currentUserId}
                    onAction={() => { setSelectedCase(null); setCaseDetail(null); }}
                  />

                  <div className="rounded-lg border border-border bg-card p-4">
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Remarks</h4>
                    <p className="text-sm text-muted-foreground">
                      {(caseDetail.case as Record<string, string>)?.remarks || <span className="italic">No remarks yet.</span>}
                    </p>
                  </div>

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
    </>
  );
}

function isDoCollectedOrClosed(c: CaseRow): boolean {
  return c.current_status === "do_collected" || c.current_status === "closed";
}
