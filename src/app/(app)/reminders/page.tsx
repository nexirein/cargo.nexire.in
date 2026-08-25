import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Bell, Clock, AlertTriangle, Send, Mail, CheckCircle2, MessageCircle } from "lucide-react";
import { SendReminderButton } from "@/components/reminders/send-reminder-button";
import { BatchSendRemindersButton } from "@/components/reminders/batch-send-reminder-button";

function timeAgo(date: string | null): string {
  if (!date) return "";
  const diff = Date.now() - new Date(date).getTime();
  const hours = Math.floor(diff / 3600000);
  if (hours < 1) return "just now";
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function applyPhaseFilter(q: any, phase?: string) {
  if (phase === "pre_alert") return q.or("shipment_phase.is.null,shipment_phase.cs.{pre_alert}");
  if (phase === "post_arrival") return q.contains("shipment_phase", ["post_arrival"]);
  return q;
}

export default async function RemindersPage({
  searchParams,
}: {
  searchParams: Promise<{ phase?: string }>;
}) {
  const { phase } = await searchParams;
  const supabase = await createClient();

  // Resolve case IDs for the phase (used for reminder_jobs filtering)
  let phaseCaseIds: string[] | null = null;
  if (phase) {
    const { data: phaseCases } = await applyPhaseFilter(
      supabase.from("awb_cases").select("id"),
      phase,
    );
    phaseCaseIds = (phaseCases ?? []).map((c: { id: string }) => c.id);
  }

  // Summary counts
  const [{ count: totalCases }, { count: awaitingReply }, { count: replied }, { count: closed }, { count: remindersDue }] = await Promise.all([
    applyPhaseFilter(supabase.from("awb_cases").select("*", { count: "exact", head: true }), phase),
    applyPhaseFilter(supabase.from("awb_cases").select("*", { count: "exact", head: true }).eq("current_status", "awaiting_reply"), phase),
    applyPhaseFilter(supabase.from("awb_cases").select("*", { count: "exact", head: true }).eq("current_status", "reply_received"), phase),
    applyPhaseFilter(supabase.from("awb_cases").select("*", { count: "exact", head: true }).eq("current_status", "closed"), phase),
    phaseCaseIds
      ? supabase.from("reminder_jobs").select("*", { count: "exact", head: true })
          .eq("status", "pending")
          .lte("due_at", new Date().toISOString())
          .in("case_id", phaseCaseIds)
      : supabase.from("reminder_jobs").select("*", { count: "exact", head: true })
          .eq("status", "pending")
          .lte("due_at", new Date().toISOString()),
  ]);

  // Reminder jobs (pending + sent + failed)
  let pendingJobsQuery = supabase
    .from("reminder_jobs")
    .select(`
      id, reminder_level, due_at, status, created_at, case_id,
      awb_cases!case_id(awb, current_status, latest_batch_run_id)
    `)
    .order("due_at", { ascending: true })
    .limit(100);

  if (phaseCaseIds && phaseCaseIds.length > 0) {
    pendingJobsQuery = pendingJobsQuery.in("case_id", phaseCaseIds);
  } else if (phaseCaseIds) {
    pendingJobsQuery = pendingJobsQuery.is("case_id", null);
  }

  const { data: pendingJobs } = await pendingJobsQuery;

  // Cases awaiting reply (not yet covered by reminder_jobs)
  let overdueQuery = supabase
    .from("awb_cases")
    .select("id, awb, latest_batch_run_id, reminder_count, final_reminder_sent, created_at, last_human_action_at, current_status")
    .eq("current_status", "awaiting_reply")
    .order("created_at", { ascending: false })
    .limit(50);

  if (phase) {
    overdueQuery = applyPhaseFilter(overdueQuery, phase);
  }

  const { data: overdueCases } = await overdueQuery;

  // Get batch names for all relevant batch_run_ids
  const batchRunIds = new Set<string>();
  for (const job of pendingJobs ?? []) {
    const c = Array.isArray(job.awb_cases) ? job.awb_cases[0] : job.awb_cases;
    if (c?.latest_batch_run_id) batchRunIds.add(c.latest_batch_run_id);
  }
  for (const c of overdueCases ?? []) {
    if (c.latest_batch_run_id) batchRunIds.add(c.latest_batch_run_id);
  }

  const { data: batchRuns } = batchRunIds.size > 0
    ? await supabase
        .from("batch_runs")
        .select("id, run_name, run_date")
        .in("id", Array.from(batchRunIds))
    : { data: [] };

  const batchMap = new Map((batchRuns ?? []).map((b) => [b.id, b]));

  // Count per batch
  const { data: batchCounts } = batchRunIds.size > 0
    ? await supabase
        .from("awb_cases")
        .select("latest_batch_run_id, current_status")
        .in("latest_batch_run_id", Array.from(batchRunIds))
    : { data: [] };

  const batchStats = new Map<string, { total: number; awaiting: number; replied: number; closed: number }>();
  for (const c of batchCounts ?? []) {
    if (!c.latest_batch_run_id) continue;
    const s = batchStats.get(c.latest_batch_run_id) ?? { total: 0, awaiting: 0, replied: 0, closed: 0 };
    s.total++;
    if (c.current_status === "awaiting_reply") s.awaiting++;
    else if (c.current_status === "reply_received") s.replied++;
    else if (c.current_status === "closed") s.closed++;
    batchStats.set(c.latest_batch_run_id, s);
  }

  // Build a list of batches with stats
  const batchesWithStats = Array.from(batchStats.entries())
    .map(([bid, stats]) => ({
      id: bid,
      runName: batchMap.get(bid)?.run_name ?? bid,
      runDate: batchMap.get(bid)?.run_date ?? null,
      ...stats,
    }))
    .sort((a, b) => (b.runDate ?? "").localeCompare(a.runDate ?? ""));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Reminders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Follow-up cases needing reminder or escalation
        </p>
      </div>

      {/* Summary Cards */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-5">
        <SummaryCard icon={Bell} label="Total Cases" value={totalCases ?? 0} />
        <SummaryCard icon={Clock} label="Awaiting Reply" value={awaitingReply ?? 0} warn={(awaitingReply ?? 0) > 0} />
        <SummaryCard icon={MessageCircle} label="Replied" value={replied ?? 0} />
        <SummaryCard icon={CheckCircle2} label="Closed" value={closed ?? 0} />
        <SummaryCard icon={AlertTriangle} label="Reminders Due" value={remindersDue ?? 0} danger={(remindersDue ?? 0) > 0} />
      </div>

      {/* Overdue cases needing reminder */}
      {overdueCases && overdueCases.length > 0 ? (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-amber-800 flex items-center gap-2">
              <Send className="h-4 w-4" />
              Cases needing first reminder ({overdueCases.length})
            </h2>
            <span className="text-xs text-amber-600">Use per-batch buttons below</span>
          </div>
          <div className="space-y-2">
            {overdueCases.slice(0, 10).map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg bg-white px-3 py-2 text-sm">
                <div className="flex items-center gap-3">
                  <Link href={`/cases/${c.id}`} className="font-medium text-amber-900 hover:underline">
                    {c.awb}
                  </Link>
                  <span className="text-xs text-amber-600">
                    {timeAgo(c.created_at)} &middot; reminder {c.reminder_count}
                    {c.final_reminder_sent ? " (final sent)" : ""}
                  </span>
                </div>
                <SendReminderButton caseId={c.id} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Scheduled reminder jobs */}
      {pendingJobs && pendingJobs.length > 0 ? (
        <div className="mb-6 rounded-xl border border-border">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Scheduled reminders ({pendingJobs.length})
            </h2>
          </div>
          <div className="divide-y divide-border">
            {pendingJobs.map((job) => {
              const c = Array.isArray(job.awb_cases) ? job.awb_cases[0] : job.awb_cases;
              return (
                <div key={job.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <div className="flex items-center gap-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      job.status === "pending"
                        ? "bg-amber-50 text-amber-700"
                        : job.status === "sent"
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-red-50 text-red-700"
                    }`}>
                      #{job.reminder_level} {job.status}
                    </span>
                    <Link href={`/cases/${job.case_id}`} className="font-medium text-foreground hover:underline">
                      {c?.awb ?? job.case_id}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                      due {new Date(job.due_at).toLocaleString("en-IN")}
                    </span>
                  </div>
                  <SendReminderButton caseId={job.case_id} />
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Batch-wise breakdown */}
      {batchesWithStats.length > 0 ? (
        <div className="rounded-xl border border-border">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">By Batch</h2>
          </div>
          <div className="divide-y divide-border">
            {batchesWithStats.map((b) => (
              <div key={b.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <div>
                  <Link href={`/batches/${b.id}/summary`} className="font-medium text-foreground hover:underline">
                    {b.runName}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {b.awaiting} awaiting · {b.replied} replied · {b.closed} closed
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">{b.total} total</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  warn,
  danger,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  warn?: boolean;
  danger?: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${
      danger ? "border-red-200 bg-red-50" : warn ? "border-amber-200 bg-amber-50" : "border-border bg-card"
    }`}>
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`h-4 w-4 ${
          danger ? "text-red-600" : warn ? "text-amber-600" : "text-muted-foreground"
        }`} />
        <p className={`text-xs font-medium ${
          danger ? "text-red-700" : warn ? "text-amber-700" : "text-muted-foreground"
        }`}>
          {label}
        </p>
      </div>
      <p className={`text-2xl font-bold ${
        danger ? "text-red-800" : warn ? "text-amber-800" : "text-foreground"
      }`}>
        {value}
      </p>
    </div>
  );
}
