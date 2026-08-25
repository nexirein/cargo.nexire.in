import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { SelectableTable, type CaseRow } from "@/components/cases/selectable-table";
import { CLEARANCE_TYPES } from "@/lib/cases/clearance-type";
import { Lightbulb, Bot } from "lucide-react";
import { ReviewFilters } from "./human-review-filters";

const PHASE_LABELS: Record<string, string> = {
  pre_alert: "Pre-alert Review",
  post_arrival: "Exception Review",
};

function applyPhaseFilter(q: any, phase?: string) {
  if (phase === "pre_alert") return q.or("shipment_phase.is.null,shipment_phase.cs.{pre_alert}");
  if (phase === "post_arrival") return q.contains("shipment_phase", ["post_arrival"]);
  return q;
}

export default async function HumanReviewPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string; issue_type?: string; urgency?: string; q?: string; batch_id?: string; clearance_type?: string; phase?: string;
  }>;
}) {
  const { status: sf, issue_type, urgency, q, batch_id, clearance_type: ct, phase } = await searchParams;
  const supabase = await createClient();
  const currentUser = await getCurrentAppUser();

  // Metrics
  const [{ count: totalCount }, { count: aiHandledCount }, { count: awaitingReviewCount }, { count: urgentCount }] = await Promise.all([
    applyPhaseFilter(supabase.from("awb_cases").select("*", { count: "exact", head: true }), phase),
    applyPhaseFilter(supabase.from("awb_cases").select("*", { count: "exact", head: true })
      .eq("human_review_required", false).eq("current_status", "closed"), phase),
    applyPhaseFilter(supabase.from("awb_cases").select("*", { count: "exact", head: true })
      .eq("human_review_required", true).in("current_status", ["reply_received", "human_review"]), phase),
    applyPhaseFilter(supabase.from("awb_cases").select("*", { count: "exact", head: true })
      .eq("urgency", "urgent").neq("current_status", "closed"), phase),
  ]);

  const aiPercent = totalCount && totalCount > 0 ? Math.round(((aiHandledCount ?? 0) / totalCount) * 100) : 0;

  // Batch filter options
  const { data: bidRows } = await supabase.from("awb_cases").select("latest_batch_run_id").not("latest_batch_run_id", "is", null);
  const bids = [...new Set((bidRows ?? []).map((b) => b.latest_batch_run_id).filter(Boolean))];
  const { data: allBatches } = bids.length > 0
    ? await supabase.from("batch_runs").select("id, run_name, run_date").in("id", bids).order("run_date", { ascending: false })
    : { data: [] };

  // Default: AI-unhandled + unassigned (so claimed cases disappear)
  let query = applyPhaseFilter(supabase
    .from("awb_cases")
    .select("id, awb, current_status, clearance_type, ownership_status, urgency, issue_type, owner_user_id, slipped, human_review_required, created_at, last_human_action_at, latest_batch_run_id, batch_runs!latest_batch_run_id(run_name, run_date), app_users!owner_user_id(full_name, email)")
    .neq("current_status", "closed")
    .order("updated_at", { ascending: false })
    .limit(50), phase);

  if (sf) {
    query = query.eq("current_status", sf);
  } else {
    // Default: only unassigned cases where consignee replied AND AI couldn't handle
    query = query
      .eq("human_review_required", true)
      .in("current_status", ["reply_received", "human_review"])
      .is("owner_user_id", null);
  }

  if (issue_type) query = query.eq("issue_type", issue_type);
  if (urgency) query = query.eq("urgency", urgency);
  if (q) query = query.ilike("awb", `%${q}%`);
  if (batch_id) query = query.eq("latest_batch_run_id", batch_id);
  if (ct) query = query.eq("clearance_type", ct);

  const { data: rows } = await query;

  // Email counts
  const awbList = (rows ?? []).filter((c: any) => c.awb).map((c: any) => c.awb);
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

  const caseRows: CaseRow[] = (rows ?? []).map((r: any) => ({
    ...r,
    inbound_count: inboundMap.get(r.awb) ?? 0,
    outbound_count: outboundMap.get(r.awb) ?? 0,
  }));

  const hasFilters = !!(sf || issue_type || urgency || q || batch_id || ct);
  const phaseTitle = PHASE_LABELS[phase ?? ""] ?? "Human Review";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">{phaseTitle}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Action queue &mdash; unclaimed cases the AI couldn&apos;t fully handle. Select &amp; claim, then reply from your email.
        </p>
      </div>

      {/* Metrics */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-medium text-muted-foreground">Total Cases</div>
          <p className="mt-1 text-2xl font-bold text-foreground">{totalCount ?? 0}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-medium text-muted-foreground">AI Handled</div>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{aiHandledCount ?? 0}</p>
          <p className="text-xs text-muted-foreground">{aiPercent}% of total</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-medium text-muted-foreground">Awaiting Review</div>
          <p className="mt-1 text-2xl font-bold text-amber-600">{awaitingReviewCount ?? 0}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4">
          <div className="text-xs font-medium text-muted-foreground">Urgent</div>
          <p className="mt-1 text-2xl font-bold text-red-600">{urgentCount ?? 0}</p>
        </div>
        <div className="rounded-xl border-2 border-indigo-200 bg-indigo-50 p-4">
          <div className="flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-indigo-600" />
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 uppercase tracking-wider">AI Tip</span>
          </div>
          {totalCount && totalCount > 0 ? (
            <p className="mt-2 text-xs text-indigo-700 leading-relaxed">
              {aiHandledCount && aiHandledCount > 0
                ? `AI closed ${aiHandledCount} case${aiHandledCount === 1 ? "" : "s"} — keep the training data flowing to improve accuracy.`
                : `No AI-closed cases yet — review quality training data to improve.`}
            </p>
          ) : null}
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4">
        <ReviewFilters
          status={sf}
          issue_type={issue_type}
          urgency={urgency}
          q={q}
          clearance_type={ct}
          batch_id={batch_id}
          phase={phase}
          allBatches={allBatches as any}
          clearanceTypes={CLEARANCE_TYPES as any}
        />
      </div>

      <SelectableTable
        cases={caseRows}
        columns={["awb", "type", "status", "issue", "urgency", "owner", "inout", "updated"]}
        showClaim
        currentUserId={currentUser?.id}
      />

      {!hasFilters && (rows ?? []).length === 0 && (
        <div className="mt-6 rounded-xl border-2 border-emerald-200 bg-emerald-50 p-6 text-center">
          <Bot className="mx-auto h-10 w-10 text-emerald-400" />
          <p className="mt-3 text-sm font-medium text-emerald-800">
            AI is handling everything — no cases need human review right now.
          </p>
        </div>
      )}
    </div>
  );
}
