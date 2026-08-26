import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { InboxPollButton } from "@/components/inbox/poll-button";
import { SelectableTable, type CaseRow } from "@/components/cases/selectable-table";
import { CLEARANCE_TYPES } from "@/lib/cases/clearance-type";
import { computeNextAction } from "@/lib/cases/next-action";
import { Search, RefreshCw, Bot, UserCheck } from "lucide-react";

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "awaiting_reply", label: "Awaiting Reply" },
  { value: "reply_received", label: "Reply Received" },
  { value: "reply_sent", label: "Reply Sent" },
  { value: "documents_provided", label: "Docs Provided" },
  { value: "boe_filed", label: "BOE Filed" },
  { value: "assessment_pending", label: "Assessment Pending" },
  { value: "duty_assessed", label: "Duty Assessed" },
  { value: "out_of_charge", label: "Out of Charge" },
  { value: "do_ready", label: "DO Ready" },
  { value: "do_collected", label: "DO Collected" },
  { value: "human_review", label: "Human Review" },
  { value: "escalated", label: "Escalated" },
  { value: "closed", label: "Closed" },
];

const ISSUE_OPTIONS = [
  { value: "", label: "All issues" },
  { value: "no_action", label: "No Action" },
  { value: "info_only", label: "Info Only" },
  { value: "payment_received", label: "Payment Received" },
  { value: "pdf_invoice_request", label: "Invoice Request" },
  { value: "checklist_request", label: "Checklist Request" },
  { value: "status_query", label: "Status Query" },
  { value: "reminder_needed", label: "Reminder Needed" },
  { value: "special_case", label: "Special Case" },
  { value: "escalation", label: "Escalation" },
  { value: "unclear", label: "Unclear" },
];

const URGENCY_OPTIONS = [
  { value: "", label: "All urgency" },
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "urgent", label: "Urgent" },
];

const AI_FILTER_OPTIONS = [
  { value: "", label: "All cases" },
  { value: "ai_handled", label: "AI Handled (auto-replied/closed)" },
  { value: "human_review", label: "Human Review Needed" },
];

const PHASE_FILTER_OPTIONS = [
  { value: "", label: "All phases" },
  { value: "prior", label: "Pre-alert" },
  { value: "post", label: "Arrival" },
  { value: "hold", label: "TP Hold" },
];

function applyPhaseFilter(q: any, phase?: string) {
  if (phase === "prior") return q.or("shipment_phase.is.null,shipment_phase.cs.{pre_alert}");
  if (phase === "post") return q.contains("shipment_phase", ["post_arrival"]);
  if (phase === "hold") return q.not("tp_hold_status", "is", null);
  return q;
}

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string; status?: string; issue_type?: string; urgency?: string;
    ai_filter?: string; slipped?: string; batch_id?: string; clearance_type?: string; phase?: string;
  }>;
}) {
  const { q, status: sf, issue_type, urgency, ai_filter, slipped, batch_id, clearance_type: ct, phase } = await searchParams;
  const supabase = await createClient();
  const currentUser = await getCurrentAppUser();

  // Metrics
  const [{ count: totalCount }, { count: aiHandledCount }, { count: humanReviewCount }, { count: awaitingCount }] = await Promise.all([
    applyPhaseFilter(supabase.from("awb_cases").select("*", { count: "exact", head: true }), phase),
    applyPhaseFilter(supabase.from("awb_cases").select("*", { count: "exact", head: true }).eq("human_review_required", false).eq("current_status", "closed"), phase),
    applyPhaseFilter(supabase.from("awb_cases").select("*", { count: "exact", head: true }).eq("human_review_required", true).in("current_status", ["reply_received", "human_review"]), phase),
    applyPhaseFilter(supabase.from("awb_cases").select("*", { count: "exact", head: true }).eq("current_status", "awaiting_reply"), phase),
  ]);

  const aiPercent = totalCount && totalCount > 0 ? Math.round(((aiHandledCount ?? 0) / totalCount) * 100) : 0;

  // Batch filter options
  const { data: bidRows } = await supabase.from("awb_cases").select("latest_batch_run_id").not("latest_batch_run_id", "is", null);
  const bids = [...new Set((bidRows ?? []).map((b) => b.latest_batch_run_id).filter(Boolean))];
  const { data: allBatches } = bids.length > 0
    ? await supabase.from("batch_runs").select("id, run_name, run_date").in("id", bids).order("run_date", { ascending: false })
    : { data: [] };

  // Query — default: all. Built via helper so we can retry without the
  // newer columns if one is missing on this DB (avoids a blank tracker).
  const CASE_SELECT_FULL = "id, awb, current_status, clearance_type, pre_alert_type, ownership_status, urgency, issue_type, owner_user_id, slipped, human_review_required, created_at, last_human_action_at, version, latest_batch_run_id, batch_runs!latest_batch_run_id(run_name, run_date), app_users!owner_user_id(full_name, email)";
  const CASE_SELECT_CORE = "id, awb, current_status, clearance_type, ownership_status, urgency, issue_type, owner_user_id, slipped, human_review_required, created_at, last_human_action_at, version, latest_batch_run_id, batch_runs!latest_batch_run_id(run_name, run_date), app_users!owner_user_id(full_name, email)";

  const buildQuery = (select: string) => {
    let qb: any = applyPhaseFilter(supabase
      .from("awb_cases")
      .select(select)
      .order("created_at", { ascending: false })
      .limit(200), phase);
    if (q) qb = qb.ilike("awb", `%${q}%`);
    if (sf) qb = qb.eq("current_status", sf);
    if (issue_type) qb = qb.eq("issue_type", issue_type);
    if (urgency) qb = qb.eq("urgency", urgency);
    if (slipped === "true") qb = qb.eq("slipped", true);
    if (batch_id) qb = qb.eq("latest_batch_run_id", batch_id);
    if (ct) qb = qb.eq("clearance_type", ct);
    if (ai_filter === "ai_handled") {
      qb = qb.eq("human_review_required", false).eq("current_status", "closed");
    } else if (ai_filter === "human_review") {
      qb = qb.eq("human_review_required", true).in("current_status", ["reply_received", "human_review"]);
    }
    return qb;
  };

  const firstAttempt = await buildQuery(CASE_SELECT_FULL);
  let rows = firstAttempt.data ?? null;
  if (firstAttempt.error) {
    const fallback = await buildQuery(CASE_SELECT_CORE);
    rows = fallback.data ?? null;
  }
  const caseRowsUnsafe: any[] = rows ?? [];

  // Email counts
  const awbList = caseRowsUnsafe.filter((c: any) => c.awb).map((c: any) => c.awb);
  const { data: emailCounts } = awbList.length > 0
    ? await supabase.from("email_events").select("awb, direction").in("awb", awbList)
    : { data: [] };

  const inboundMap = new Map<string, number>();
  const outboundMap = new Map<string, number>();
  for (const e of (emailCounts ?? []) as { awb: string; direction: string }[]) {
    if (!e.awb) continue;
    if (e.direction === "inbound") inboundMap.set(e.awb, (inboundMap.get(e.awb) ?? 0) + 1);
    else outboundMap.set(e.awb, (outboundMap.get(e.awb) ?? 0) + 1);
  }

  const caseRows: CaseRow[] = caseRowsUnsafe.map((r: any) => {
    const na = computeNextAction({
      current_status: r.current_status,
      clearance_type: r.clearance_type,
      created_at: r.created_at,
      do_ready_at: null,
      do_collected_at: null,
      boe_filed_at: null,
    });
    return {
      ...r,
      inbound_count: inboundMap.get(r.awb) ?? 0,
      outbound_count: outboundMap.get(r.awb) ?? 0,
      next_action_label: na.label,
      next_action_group: na.group,
      next_action_sla: na.slaAt,
    };
  });

  const hasFilters = !!(q || sf || issue_type || urgency || ai_filter || slipped || batch_id || ct || phase);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Cases</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Master view of all AWB-level follow-ups with AI-powered classification and auto-reply.
        </p>
      </div>

      {/* Metrics */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-medium text-muted-foreground">Total Cases</div>
          <p className="mt-1 text-2xl font-bold text-foreground">{totalCount ?? 0}</p>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <Bot className="h-3.5 w-3.5" />AI Handled
          </div>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{aiHandledCount ?? 0}</p>
          <p className="text-xs text-emerald-600">{aiPercent}% ownership</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
            <UserCheck className="h-3.5 w-3.5" />Human Review
          </div>
          <p className="mt-1 text-2xl font-bold text-amber-700">{humanReviewCount ?? 0}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-4">
          <div className="text-xs font-medium text-amber-600">Awaiting Reply</div>
          <p className="mt-1 text-2xl font-bold text-amber-600">{awaitingCount ?? 0}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-medium text-muted-foreground">AI Ownership</div>
          <div className="mt-2 flex items-baseline gap-1">
            <span className="text-2xl font-bold text-emerald-600">{aiPercent}%</span>
            <span className="text-xs text-muted-foreground">({aiHandledCount ?? 0}/{totalCount ?? 0})</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${aiPercent}%` }} />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <form method="get" className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input name="q" defaultValue={q ?? ""} placeholder="Search AWB..." className="h-9 w-36 rounded-lg border border-input bg-card pl-9 pr-3 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring" />
          </div>
          <select name="batch_id" defaultValue={batch_id ?? ""} className="h-9 rounded-lg border border-input bg-card px-3 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring">
            <option value="">All batches</option>
            {(allBatches ?? []).map((b) => (
              <option key={b.id} value={b.id}>{b.run_name}</option>
            ))}
          </select>
          <select name="status" defaultValue={sf ?? ""} className="h-9 rounded-lg border border-input bg-card px-3 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring">
            {STATUS_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </select>
          <select name="issue_type" defaultValue={issue_type ?? ""} className="h-9 rounded-lg border border-input bg-card px-3 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring">
            {ISSUE_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </select>
          <select name="urgency" defaultValue={urgency ?? ""} className="h-9 rounded-lg border border-input bg-card px-3 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring">
            {URGENCY_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </select>
           <select name="clearance_type" defaultValue={ct ?? ""} className="h-9 rounded-lg border border-input bg-card px-3 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring">
            {CLEARANCE_TYPES.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </select>
          <select name="phase" defaultValue={phase ?? ""} className="h-9 rounded-lg border border-input bg-card px-3 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring">
            {PHASE_FILTER_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </select>
          <select name="ai_filter" defaultValue={ai_filter ?? ""} className="h-9 rounded-lg border border-input bg-card px-3 text-sm focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring">
            {AI_FILTER_OPTIONS.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
          </select>
          <button type="submit" className="h-9 rounded-lg bg-sidebar-primary px-4 text-sm font-medium text-white transition hover:bg-sidebar-primary/90">Filter</button>
          {hasFilters ? <Link href="/cases" className="text-xs text-muted-foreground hover:text-foreground">Clear</Link> : null}
        </form>
        <InboxPollButton />
        <Link href={slipped === "true" ? "/cases" : "/cases?slipped=true"} className={`h-9 rounded-lg border px-4 text-sm font-medium transition ${slipped === "true" ? "border-red-200 bg-red-50 text-red-700" : "border-input bg-card text-foreground hover:bg-muted"}`}>
          {slipped === "true" ? <><RefreshCw className="mr-1 inline-block h-3 w-3" />Slipped</> : "Slipped"}
        </Link>
      </div>

      <SelectableTable
        cases={caseRows}
        columns={["batch", "awb", "type", "status", "issue", "urgency", "owner", "inout", "updated", "slipped"]}
        showClaim
        currentUserId={currentUser?.id}
      />
    </div>
  );
}
