import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { FirstTimeBanner } from "@/components/training/first-time-banner";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { InfoTip } from "@/components/ui/info-tip";
import { CLEARANCE_TYPES } from "@/lib/cases/clearance-type";
import {
  UserCheck, Send,
  AlertTriangle, Layers,
  FileText, DollarSign,
  Phone, PhoneCall, CheckCircle, XCircle,
} from "lucide-react";
import { RecentActivity } from "../recent-activity";
import { AiImpact } from "../ai-impact";

function startOfDay(dateStr?: string): string {
  if (dateStr) {
    const d = new Date(dateStr);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfDay(dateStr?: string): string {
  if (dateStr) {
    const d = new Date(dateStr);
    d.setHours(23, 59, 59, 999);
    return d.toISOString();
  }
  return new Date().toISOString();
}

const map = { "7d": 7, "30d": 30, "90d": 90 };

function parseRange(range: string, from?: string, to?: string) {
  let start: string;
  let end: string;
  if (from) {
    start = startOfDay(from);
    end = endOfDay(to || from);
  } else {
    const d = new Date();
    d.setDate(d.getDate() - ((map as Record<string, number>)[range] ?? 30));
    start = d.toISOString();
    end = endOfDay();
  }
  return { start, end };
}

function applyTypeFilter(q: any, ct?: string) {
  if (ct && ct !== "all") return q.eq("clearance_type", ct);
  return q;
}

function applyPhaseFilter(q: any) {
  return q.or("shipment_phase.is.null,shipment_phase.cs.{pre_alert}");
}

interface Counts {
  totalCases: number;
  humanReview: number;
  sentCount: number;
  replyCount: number;
  awaitingReply: number;
  slippedCases: number;
  replyRate: number;
}

interface ClearancePipeline {
  replyReceived: number;
  docsProvided: number;
  boeFiled: number;
  ooc: number;
  doReady: number;
  doCollected: number;
}

interface PenaltyMetrics {
  boeLateCases: number;
  boeLateDays: number;
  doOverdueCases: number;
  doOverdueDays: number;
  stuckClearance: number;
}

interface TypeBreakdown {
  nfbrk: number;
  febrkJeena: number;
  febrkSunimpex: number;
  calling: number;
  hold: number;
}

interface ConfirmedStatus {
  nfbrk: number;
  febrkJeena: number;
  febrkSunimpex: number;
  total: number;
}

interface CallPipeline {
  pending: number;
  inProgress: number;
  completed: number;
  failed: number;
}

interface SendMetrics {
  sent: number;
  failed: number;
  queued: number;
  pending: number;
}

async function getCounts(start: string, end: string, ct?: string): Promise<Counts> {
  const supabase = await createClient();
  const base = applyPhaseFilter(supabase.from("awb_cases").select("*", { count: "exact", head: true }).gte("created_at", start).lte("created_at", end));
  const typed = applyTypeFilter(base, ct);

  const [s, r, a, sl] = await Promise.all([
    supabase.from("batch_items").select("*", { count: "exact", head: true })
      .eq("send_status", "sent").gte("send_completed_at", start).lte("send_completed_at", end),
    supabase.from("email_events").select("*", { count: "exact", head: true })
      .eq("direction", "inbound").gte("created_at", start).lte("created_at", end),
    applyTypeFilter(applyPhaseFilter(supabase.from("awb_cases").select("*", { count: "exact", head: true })
      .gte("created_at", start).lte("created_at", end).eq("current_status", "awaiting_reply")), ct),
    applyTypeFilter(applyPhaseFilter(supabase.from("awb_cases").select("*", { count: "exact", head: true })
      .gte("created_at", start).lte("created_at", end).eq("slipped", true)), ct),
  ]);

  const [{ count: totalCases }, { count: humanReview }] = await Promise.all([
    typed,
    applyTypeFilter(applyPhaseFilter(supabase.from("awb_cases").select("*", { count: "exact", head: true })
      .gte("created_at", start).lte("created_at", end)
      .or("human_review_required.eq.true,current_status.eq.human_review").neq("current_status", "closed")), ct),
  ]);

  const t = totalCases ?? 0;
  return {
    totalCases: t,
    humanReview: humanReview ?? 0,
    sentCount: s.count ?? 0,
    replyCount: r.count ?? 0,
    awaitingReply: a.count ?? 0,
    slippedCases: sl.count ?? 0,
    replyRate: (s.count ?? 0) > 0 ? Math.round(((r.count ?? 0) / (s.count ?? 0)) * 100) : 0,
  };
}

async function getClearancePipeline(start: string, end: string, ct?: string): Promise<ClearancePipeline> {
  const supabase = await createClient();
  const statuses = [
    "reply_received", "documents_provided", "boe_filed",
    "out_of_charge", "do_ready", "do_collected",
  ] as const;
  const counts = await Promise.all(
    statuses.map((s) => {
      let q = applyPhaseFilter(supabase.from("awb_cases").select("*", { count: "exact", head: true })
        .gte("created_at", start).lte("created_at", end).eq("current_status", s));
      return applyTypeFilter(q, ct);
    }),
  );
  return {
    replyReceived: counts[0].count ?? 0,
    docsProvided: counts[1].count ?? 0,
    boeFiled: counts[2].count ?? 0,
    ooc: counts[3].count ?? 0,
    doReady: counts[4].count ?? 0,
    doCollected: counts[5].count ?? 0,
  };
}

async function getPenaltyMetrics(start: string, end: string, ct?: string): Promise<PenaltyMetrics> {
  const supabase = await createClient();
  const now = Date.now();

  let boeQ = applyPhaseFilter(supabase
    .from("awb_cases")
    .select("created_at")
    .gte("created_at", start).lte("created_at", end)
    .is("boe_filed_at", null)
    .in("clearance_type", ["nfbrk", null])
    .not("current_status", "in", '("closed","do_collected")'));
  boeQ = ct && ct !== "all" && ct !== "nfbrk" ? boeQ.eq("clearance_type", ct) : boeQ;
  const { data: boeLateRows } = await boeQ;

  let boeLateCases = 0;
  let boeLateDays = 0;
  for (const r of boeLateRows ?? []) {
    const h = (now - new Date(r.created_at).getTime()) / 3600000;
    if (h > 24) { boeLateCases++; boeLateDays += Math.floor((h - 24) / 24) + 1; }
  }

  let doQ = applyPhaseFilter(supabase
    .from("awb_cases")
    .select("do_ready_at")
    .gte("created_at", start).lte("created_at", end)
    .in("clearance_type", ["nfbrk", null])
    .not("do_ready_at", "is", null)
    .is("do_collected_at", null)
    .neq("current_status", "closed"));
  doQ = ct && ct !== "all" && ct !== "nfbrk" ? doQ.eq("clearance_type", ct) : doQ;
  const { data: doOverdueRows } = await doQ;

  let doOverdueCases = 0;
  let doOverdueDays = 0;
  for (const r of doOverdueRows ?? []) {
    if (!r.do_ready_at) continue;
    const h = (now - new Date(r.do_ready_at).getTime()) / 3600000;
    if (h > 24) { doOverdueCases++; doOverdueDays += Math.floor((h - 24) / 24) + 1; }
  }

  let stickQ = applyPhaseFilter(supabase
    .from("awb_cases")
    .select("boe_filed_at")
    .gte("created_at", start).lte("created_at", end)
    .not("boe_filed_at", "is", null)
    .is("out_of_charge_at", null)
    .neq("current_status", "closed"));
  stickQ = applyTypeFilter(stickQ, ct);
  const { data: stuckRows } = await stickQ;

  let stuckClearance = 0;
  for (const r of stuckRows ?? []) {
    if (!r.boe_filed_at) continue;
    if ((now - new Date(r.boe_filed_at).getTime()) / 3600000 > 72) stuckClearance++;
  }

  return { boeLateCases, boeLateDays, doOverdueCases, doOverdueDays, stuckClearance };
}

async function getTypeBreakdown(start: string, end: string): Promise<TypeBreakdown> {
  const supabase = await createClient();
  const [nf, fj, fs, ca, h] = await Promise.all([
    applyPhaseFilter(supabase.from("awb_cases").select("*", { count: "exact", head: true }).gte("created_at", start).lte("created_at", end)).eq("clearance_type", "nfbrk"),
    applyPhaseFilter(supabase.from("awb_cases").select("*", { count: "exact", head: true }).gte("created_at", start).lte("created_at", end)).eq("clearance_type", "febrk-jeena"),
    applyPhaseFilter(supabase.from("awb_cases").select("*", { count: "exact", head: true }).gte("created_at", start).lte("created_at", end)).eq("clearance_type", "febrk-sunimpex"),
    applyPhaseFilter(supabase.from("awb_cases").select("*", { count: "exact", head: true }).gte("created_at", start).lte("created_at", end)).eq("clearance_type", "calling"),
    applyPhaseFilter(supabase.from("awb_cases").select("*", { count: "exact", head: true }).gte("created_at", start).lte("created_at", end)).eq("clearance_type", "hold"),
  ]);
  return {
    nfbrk: nf.count ?? 0,
    febrkJeena: fj.count ?? 0,
    febrkSunimpex: fs.count ?? 0,
    calling: ca.count ?? 0,
    hold: h.count ?? 0,
  };
}

async function getConfirmedStatus(start: string, end: string): Promise<ConfirmedStatus> {
  const supabase = await createClient();
  const base = () => applyPhaseFilter(
    supabase.from("awb_cases").select("*", { count: "exact", head: true })
      .gte("created_at", start).lte("created_at", end)
      .not("clearance_type", "is", null)
      .neq("clearance_type", "hold"),
  );
  const [nf, fj, fs] = await Promise.all([
    base().eq("clearance_type", "nfbrk"),
    base().eq("clearance_type", "febrk-jeena"),
    base().eq("clearance_type", "febrk-sunimpex"),
  ]);
  return {
    nfbrk: nf.count ?? 0,
    febrkJeena: fj.count ?? 0,
    febrkSunimpex: fs.count ?? 0,
    total: (nf.count ?? 0) + (fj.count ?? 0) + (fs.count ?? 0),
  };
}

async function getCallPipeline(start: string, end: string): Promise<CallPipeline> {
  const supabase = await createClient();
  const [p, ip, c, f] = await Promise.all([
    supabase.from("call_tasks").select("*", { count: "exact", head: true })
      .eq("status", "pending").gte("created_at", start).lte("created_at", end),
    supabase.from("call_tasks").select("*", { count: "exact", head: true })
      .eq("status", "in_progress").gte("created_at", start).lte("created_at", end),
    supabase.from("call_tasks").select("*", { count: "exact", head: true })
      .eq("status", "done").gte("created_at", start).lte("created_at", end),
    supabase.from("call_tasks").select("*", { count: "exact", head: true })
      .eq("status", "failed").gte("created_at", start).lte("created_at", end),
  ]);
  return {
    pending: p.count ?? 0,
    inProgress: ip.count ?? 0,
    completed: c.count ?? 0,
    failed: f.count ?? 0,
  };
}

async function getSendMetrics(start: string, end: string, ct?: string): Promise<SendMetrics> {
  const supabase = await createClient();
  const base = supabase.from("batch_items").select("*", { count: "exact", head: true })
    .gte("created_at", start).lte("created_at", end);
  const filtered = (q: any) => ct && ct !== "all" ? q.eq("clearance_type", ct) : q;

  const [s, f, q, p] = await Promise.all([
    filtered(base.eq("send_status", "sent")),
    filtered(base.eq("send_status", "failed")),
    filtered(base.eq("send_status", "queued")),
    filtered(base.in("send_status", ["pending", "retrying"])),
  ]);
  return {
    sent: s.count ?? 0,
    failed: f.count ?? 0,
    queued: q.count ?? 0,
    pending: p.count ?? 0,
  };
}

async function getRecentCases(start: string, end: string, ct?: string) {
  const supabase = await createClient();
  let q = applyPhaseFilter(supabase
    .from("awb_cases")
    .select("id, awb, current_status, ownership_status, issue_type, urgency, updated_at, owner_user_id")
    .gte("created_at", start).lte("created_at", end)
    .order("updated_at", { ascending: false })
    .limit(10));
  q = applyTypeFilter(q, ct);
  const { data } = await q;
  return data ?? [];
}

interface TierData {
  fullAuto: number;
  aiAssisted: number;
  humanLed: number;
  inProgress: number;
}

async function getAiTiers(start: string, end: string, ct?: string): Promise<TierData> {
  const supabase = await createClient();
  const q1 = applyTypeFilter(
    applyPhaseFilter(supabase.from("awb_cases").select("*", { count: "exact", head: true }).gte("created_at", start).lte("created_at", end).eq("auto_closed", true).eq("human_ever_opened", false)), ct);
  const q2 = applyTypeFilter(
    applyPhaseFilter(supabase.from("awb_cases").select("*", { count: "exact", head: true }).gte("created_at", start).lte("created_at", end).eq("auto_classified", true).eq("human_ever_opened", true)), ct);
  const q3 = applyTypeFilter(
    applyPhaseFilter(supabase.from("awb_cases").select("*", { count: "exact", head: true }).gte("created_at", start).lte("created_at", end).eq("human_ever_opened", true).is("auto_classified", null)), ct);
  const q4 = applyTypeFilter(
    applyPhaseFilter(supabase.from("awb_cases").select("*", { count: "exact", head: true }).gte("created_at", start).lte("created_at", end).eq("auto_classified", false).eq("human_ever_opened", false).eq("auto_closed", false)), ct);

  const [{ count: fullAuto }, { count: aiAssisted }, { count: humanLed }, { count: inProgress }] = await Promise.all([q1, q2, q3, q4]);
  return {
    fullAuto: fullAuto ?? 0,
    aiAssisted: aiAssisted ?? 0,
    humanLed: humanLed ?? 0,
    inProgress: inProgress ?? 0,
  };
}

interface TaskAutomation {
  classify: { ai: number; human: number };
  reply: { ai: number; human: number; autoSend: number; draftSend: number };
  reminders: { cron: number };
  closure: { ai: number; human: number };
}

async function getTaskAutomation(start: string, end: string, ct?: string): Promise<TaskAutomation> {
  const supabase = await createClient();
  const classifyAi = supabase.from("case_updates").select("*", { count: "exact", head: true })
    .in("update_type", ["reply_received", "reclassify", "auto_reply_sent"])
    .in("actor_type", ["ai", "cron", "system"])
    .gte("created_at", start).lte("created_at", end);
  const classifyHuman = supabase.from("case_updates").select("*", { count: "exact", head: true })
    .in("update_type", ["reply_received", "reclassify"])
    .eq("actor_type", "human")
    .gte("created_at", start).lte("created_at", end);
  const replyAi = supabase.from("case_updates").select("*", { count: "exact", head: true })
    .eq("update_type", "auto_reply_sent")
    .gte("created_at", start).lte("created_at", end);
  const replyHuman = supabase.from("case_updates").select("*", { count: "exact", head: true })
    .eq("update_type", "status_change")
    .eq("actor_type", "human")
    .gte("created_at", start).lte("created_at", end);
  const autoSend = supabase.from("case_updates").select("*", { count: "exact", head: true })
    .eq("update_type", "auto_reply_sent")
    .textSearch("remarks", "auto-sent", { config: "english" })
    .gte("created_at", start).lte("created_at", end);
  const draftSend = supabase.from("case_updates").select("*", { count: "exact", head: true })
    .eq("update_type", "draft_approved_sent")
    .gte("created_at", start).lte("created_at", end);
  const remindersCron = supabase.from("case_updates").select("*", { count: "exact", head: true })
    .in("update_type", ["do_overdue_reminder", "reminder_sent", "final_reminder_sent"])
    .gte("created_at", start).lte("created_at", end);
  const closeAi = supabase.from("case_updates").select("*", { count: "exact", head: true })
    .in("update_type", ["status_change"])
    .eq("actor_type", "ai")
    .gte("created_at", start).lte("created_at", end);
  const closeHuman = supabase.from("case_updates").select("*", { count: "exact", head: true })
    .in("update_type", ["status_change"])
    .eq("actor_type", "human")
    .gte("created_at", start).lte("created_at", end);

  const [ca, ch, ra, rh, asd, dsd, rc, cla, clh] = await Promise.all([
    classifyAi, classifyHuman, replyAi, replyHuman, autoSend, draftSend, remindersCron, closeAi, closeHuman,
  ]);

  return {
    classify: { ai: ca.count ?? 0, human: ch.count ?? 0 },
    reply: { ai: ra.count ?? 0, human: rh.count ?? 0, autoSend: asd.count ?? 0, draftSend: dsd.count ?? 0 },
    reminders: { cron: rc.count ?? 0 },
    closure: { ai: cla.count ?? 0, human: clh.count ?? 0 },
  };
}

interface TimeSavedBreakdown {
  classifyActions: number;
  replyActions: number;
  reminderActions: number;
  autoCloseCases: number;
}

async function getTimeSaved(start: string, end: string): Promise<TimeSavedBreakdown> {
  const supabase = await createClient();
  const classifyAi = supabase.from("case_updates").select("*", { count: "exact", head: true })
    .in("update_type", ["reply_received", "reclassify"])
    .in("actor_type", ["ai", "cron", "system"])
    .gte("created_at", start).lte("created_at", end);
  const replyActions = supabase.from("case_updates").select("*", { count: "exact", head: true })
    .eq("update_type", "auto_reply_sent")
    .gte("created_at", start).lte("created_at", end);
  const reminders = supabase.from("case_updates").select("*", { count: "exact", head: true })
    .in("update_type", ["do_overdue_reminder", "reminder_sent", "final_reminder_sent"])
    .gte("created_at", start).lte("created_at", end);
  const autoCloseCount = supabase.from("awb_cases").select("*", { count: "exact", head: true })
    .eq("auto_closed", true)
    .gte("created_at", start).lte("created_at", end);

  const [cl, ra, rm, ac] = await Promise.all([classifyAi, replyActions, reminders, autoCloseCount]);

  return {
    classifyActions: cl.count ?? 0,
    replyActions: ra.count ?? 0,
    reminderActions: rm.count ?? 0,
    autoCloseCases: ac.count ?? 0,
  };
}

export default async function PriorDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string; clearance_type?: string }>;
}) {
  const user = await getCurrentAppUser();
  const { range, from, to, clearance_type } = await searchParams;
  const currentRange = ((range && map[range as keyof typeof map]) ? range : "30d") as string;
  const { start, end } = parseRange(currentRange, from, to);
  const activeType = CLEARANCE_TYPES.find((t) => t.value === clearance_type) ? clearance_type : undefined;

  const [counts, pipeline, penalties, types, confirmedStatus, callPipeline, sendMetrics, recentCases, tiers, taskAutomation, timeSaved] = await Promise.all([
    getCounts(start, end, activeType),
    getClearancePipeline(start, end, activeType),
    getPenaltyMetrics(start, end, activeType),
    getTypeBreakdown(start, end),
    getConfirmedStatus(start, end),
    getCallPipeline(start, end),
    getSendMetrics(start, end, activeType),
    getRecentCases(start, end, activeType),
    getAiTiers(start, end, activeType),
    getTaskAutomation(start, end, activeType),
    getTimeSaved(start, end),
  ]);

  const totalTyped = types.nfbrk + types.febrkJeena + types.febrkSunimpex + types.calling + types.hold;
  const uncatCount = counts.totalCases - totalTyped;

  const fromDate = from || undefined;
  const toDate = to || undefined;

  return (
    <div>
      {/* Header row */}
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Pre-alert Dashboard{user?.fullName ? ` — ${user.fullName}` : ""}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pre-alert operations overview for the selected period
            </p>
          </div>
          <DateRangePicker range={currentRange} from={fromDate} to={toDate} />
        </div>

        {/* Clearance type filter */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground mr-1">Filter by type:</span>
          {CLEARANCE_TYPES.map((t) => {
            const active = t.value === (activeType ?? "");
            return (
              <Link
                key={t.value}
                href={`/dashboard/prior${t.value ? `?clearance_type=${t.value}` : ""}`}
                className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                  active
                    ? "bg-sidebar-primary text-white shadow-sm"
                    : "bg-card border border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Hero: AI Impact + Volumes */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-8">
        <AiImpact
          tiers={tiers}
          taskAutomation={taskAutomation}
          timeSaved={timeSaved}
          totalCases={counts.totalCases}
        />

        {/* Volume: Sent vs Replies */}
        <div className="col-span-1 sm:col-span-2 rounded-xl border-2 border-sky-200 bg-gradient-to-br from-sky-50 to-white p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-xl bg-sky-500 p-3 text-white shadow-sm">
              <Send className="h-7 w-7" />
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-sky-600">
                Volume<InfoTip text="Total pre-alert emails sent in this period. Shows how many have replied, the reply rate, and how many are still waiting for a reply" />
              </p>
              <p className="text-3xl font-bold text-sky-800">{counts.sentCount}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-sky-700">
              <strong>{counts.replyCount}</strong> replies
            </span>
            <span className="text-sky-600">|</span>
            <span className="text-sky-700">
              <strong>{counts.replyRate}%</strong> reply rate<InfoTip text="Percentage of sent pre-alerts that received an inbound reply from the recipient" />
            </span>
            <span className="text-sky-600">|</span>
            <span className="text-amber-700">
              <strong>{counts.awaitingReply}</strong> awaiting
            </span>
          </div>
        </div>

        {/* Mini grid: Human Review / Slipped / Total */}
        <div className="col-span-1 sm:col-span-3 grid grid-cols-3 gap-3">
          <Link href="/human-review"
            className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 transition hover:shadow-md hover:-translate-y-0.5">
            <p className="text-xs font-medium text-amber-700">
              <UserCheck className="mr-1 inline h-3.5 w-3.5" />
              Human Review<InfoTip text="Cases that were flagged for manual operator review — AI could not handle them automatically" />
            </p>
            <p className="mt-1 text-2xl font-bold text-amber-800">{counts.humanReview}</p>
          </Link>
          <Link href="/cases?slipped=true"
            className="rounded-xl border border-red-200 bg-red-50/50 p-4 transition hover:shadow-md hover:-translate-y-0.5">
            <p className="text-xs font-medium text-red-700">
              <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
              Slipped<InfoTip text="Cases where the SLA deadline was missed — no reply received within the expected timeframe" />
            </p>
            <p className="mt-1 text-2xl font-bold text-red-800">{counts.slippedCases}</p>
          </Link>
          <Link href="/cases"
            className="rounded-xl border border-border bg-card p-4 transition hover:shadow-md hover:-translate-y-0.5">
            <p className="text-xs font-medium text-muted-foreground">
              <Layers className="mr-1 inline h-3.5 w-3.5" />Total Cases
            </p>
            <p className="mt-1 text-2xl font-bold text-foreground">{counts.totalCases}</p>
          </Link>
        </div>
      </div>

      <FirstTimeBanner />

      {/* Clearance Pipeline */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-3">
          Clearance Pipeline<InfoTip text="Stages from reply receipt through DO collection. Each card shows how many cases are currently at that stage. The funnel bar below shows the drop-off proportionally" />
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
          {([
            ["Reply Received", "replyReceived", "border-sky-200 bg-sky-50/50 text-sky-700", "/cases?status=reply_received"],
            ["Docs Provided", "docsProvided", "border-blue-200 bg-blue-50/50 text-blue-700", "/cases?status=documents_provided"],
            ["BOE Filed", "boeFiled", "border-indigo-200 bg-indigo-50/50 text-indigo-700", "/cases?status=boe_filed"],
            ["Out of Charge", "ooc", "border-emerald-200 bg-emerald-50/50 text-emerald-700", "/cases?status=out_of_charge"],
            ["DO Ready", "doReady", "border-teal-200 bg-teal-50/50 text-teal-700", "/cases?status=do_ready"],
            ["DO Collected", "doCollected", "border-emerald-300 bg-emerald-50/50 text-emerald-700", "/cases?status=do_collected"],
          ] as const).map(([label, key, classes, href]) => (
            <Link key={label} href={href}
              className={`group relative rounded-xl border ${classes} p-4 transition hover:shadow-md`}>
              <p className="text-xs font-medium">{label}</p>
              <p className="text-xl font-bold">{pipeline[key as keyof typeof pipeline]}</p>
            </Link>
          ))}
        </div>
        {counts.totalCases > 0 ? (
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
            <div className="flex h-full">
              <div className="h-full rounded-l-full bg-sky-400 transition-all"
                style={{ width: `${Math.max(0.5, (pipeline.replyReceived / counts.totalCases) * 100)}%` }} />
              <div className="h-full bg-blue-400 transition-all"
                style={{ width: `${Math.max(0.5, (pipeline.docsProvided / counts.totalCases) * 100)}%` }} />
              <div className="h-full bg-indigo-400 transition-all"
                style={{ width: `${Math.max(0.5, (pipeline.boeFiled / counts.totalCases) * 100)}%` }} />
              <div className="h-full bg-emerald-400 transition-all"
                style={{ width: `${Math.max(0.5, (pipeline.ooc / counts.totalCases) * 100)}%` }} />
              <div className="h-full bg-teal-400 transition-all"
                style={{ width: `${Math.max(0.5, (pipeline.doReady / counts.totalCases) * 100)}%` }} />
              <div className="h-full rounded-r-full bg-emerald-500 transition-all"
                style={{ width: `${Math.max(0.5, (pipeline.doCollected / counts.totalCases) * 100)}%` }} />
            </div>
          </div>
        ) : null}
      </div>

      {/* Penalty Exposure */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-3">
          Penalty Exposure<InfoTip text="Estimated financial risk from delayed filing and collection. Only NFBRK cases are counted since FEBRK penalties are the broker&rsquo;s responsibility" />
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {penalties.boeLateCases > 0 ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <div className="flex items-center gap-2 mb-1">
                <FileText className="h-4 w-4 text-red-600" />
                <p className="text-xs font-semibold text-red-800 uppercase tracking-wider">
                  BOE Late Penalty<InfoTip text="₹5K/day for duty ≤ ₹10L, ₹10K/day for duty > ₹10L. Counts days past 24h from arrival" />
                </p>
              </div>
              <p className="text-lg font-bold text-red-800">
                ₹{penalties.boeLateDays * 5000} – ₹{penalties.boeLateDays * 10000}
              </p>
              <p className="text-xs text-red-600">
                {penalties.boeLateCases} case{penalties.boeLateCases > 1 ? "s" : ""} &middot; {penalties.boeLateDays} day{penalties.boeLateDays > 1 ? "s" : ""} total overdue
              </p>
              <p className="text-xs text-red-500 mt-0.5">NFBRK only (consignee&rsquo;s responsibility)</p>
            </div>
          ) : null}
          {penalties.doOverdueCases > 0 ? (
            <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
              <div className="flex items-center gap-2 mb-1">
                <DollarSign className="h-4 w-4 text-orange-600" />
                <p className="text-xs font-semibold text-orange-800 uppercase tracking-wider">
                  DO Overdue Penalty<InfoTip text="₹1K/day + GST after DO is ready but not collected. Counts days past 24h from do_ready_at" />
                </p>
              </div>
              <p className="text-lg font-bold text-orange-800">
                ₹{penalties.doOverdueDays * 1000} + GST
              </p>
              <p className="text-xs text-orange-600">
                {penalties.doOverdueCases} case{penalties.doOverdueCases > 1 ? "s" : ""} &middot; {penalties.doOverdueDays} day{penalties.doOverdueDays > 1 ? "s" : ""} total overdue
              </p>
              <p className="text-xs text-orange-500 mt-0.5">NFBRK only (consignee&rsquo;s responsibility)</p>
            </div>
          ) : null}
          {penalties.stuckClearance > 0 ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider">
                  Stuck Clearance<InfoTip text="BOE was filed more than 72 hours ago but the case hasn't progressed to Out of Charge — may require escalation with customs" />
                </p>
              </div>
              <p className="text-lg font-bold text-amber-800">{penalties.stuckClearance}</p>
              <p className="text-xs text-amber-600">BOE filed &gt;72h ago, not yet assessed</p>
            </div>
          ) : null}
        </div>
      </div>

      {/* Shipments by Type */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-3">
          Shipments by Type<InfoTip text="Breakdown by clearance type. NFBRK = consignee's own broker, FEBRK = FedEx broker, Calling = manual phone follow-up, Hold = on hold" />
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
          <Link href="/cases?clearance_type=nfbrk"
            className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 transition hover:shadow-md">
            <p className="text-xs font-medium text-blue-700">NFBRK</p>
            <p className="text-xl font-bold text-blue-700">{types.nfbrk}</p>
            <p className="text-xs text-blue-500">Consignee&rsquo;s broker</p>
          </Link>
          <Link href="/cases?clearance_type=febrk-jeena"
            className="rounded-xl border border-violet-200 bg-violet-50/50 p-4 transition hover:shadow-md">
            <p className="text-xs font-medium text-violet-700">FEBRK-Jeena</p>
            <p className="text-xl font-bold text-violet-700">{types.febrkJeena}</p>
            <p className="text-xs text-violet-500">FedEx broker Jeena</p>
          </Link>
          <Link href="/cases?clearance_type=febrk-sunimpex"
            className="rounded-xl border border-purple-200 bg-purple-50/50 p-4 transition hover:shadow-md">
            <p className="text-xs font-medium text-purple-700">FEBRK-Sunimpex</p>
            <p className="text-xl font-bold text-purple-700">{types.febrkSunimpex}</p>
            <p className="text-xs text-purple-500">FedEx broker Sunimpex</p>
          </Link>
          <Link href="/cases?clearance_type=calling"
            className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 transition hover:shadow-md">
            <p className="text-xs font-medium text-amber-700">Calling</p>
            <p className="text-xl font-bold text-amber-700">{types.calling}</p>
            <p className="text-xs text-amber-500">Manual call follow-up</p>
          </Link>
          <Link href="/cases?clearance_type=hold"
            className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition hover:shadow-md">
            <p className="text-xs font-medium text-slate-600">Hold</p>
            <p className="text-xl font-bold text-slate-700">{types.hold}</p>
            <p className="text-xs text-slate-500">On hold</p>
          </Link>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium text-muted-foreground">Uncategorised</p>
            <p className="text-xl font-bold text-foreground">{uncatCount}</p>
            <p className="text-xs text-muted-foreground">No type set</p>
          </div>
        </div>
      </div>

      {/* Confirmed Status */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-3">
          Confirmed Status<InfoTip text="Clearance types that have been confirmed — either automatically from broker_master or via AI call" />
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-xl bg-emerald-500 p-2.5 text-white shadow-sm">
                <CheckCircle className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                NFBRK (Own CHA)
              </p>
            </div>
            <p className="text-3xl font-bold text-emerald-800">{confirmedStatus.nfbrk}</p>
            <p className="text-xs text-emerald-600 mt-1">Consignee&rsquo;s own broker</p>
          </div>
          <div className="rounded-xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-xl bg-violet-500 p-2.5 text-white shadow-sm">
                <CheckCircle className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-violet-600">
                FEBRK — Jeena
              </p>
            </div>
            <p className="text-3xl font-bold text-violet-800">{confirmedStatus.febrkJeena}</p>
            <p className="text-xs text-violet-600 mt-1">FedEx CHA Jeena &amp; Co.</p>
          </div>
          <div className="rounded-xl border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-white p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-xl bg-purple-500 p-2.5 text-white shadow-sm">
                <CheckCircle className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-purple-600">
                FEBRK — Sunimpex
              </p>
            </div>
            <p className="text-3xl font-bold text-purple-800">{confirmedStatus.febrkSunimpex}</p>
            <p className="text-xs text-purple-600 mt-1">FedEx CHA Sunimpex</p>
          </div>
          <div className="rounded-xl border-2 border-emerald-300 bg-gradient-to-br from-emerald-100 to-white p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-xl bg-emerald-600 p-2.5 text-white shadow-sm">
                <CheckCircle className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700">
                Total Confirmed
              </p>
            </div>
            <p className="text-3xl font-bold text-emerald-900">{confirmedStatus.total}</p>
            <p className="text-xs text-emerald-700 mt-1">{counts.totalCases > 0 ? Math.round((confirmedStatus.total / counts.totalCases) * 100) : 0}% of all cases</p>
          </div>
        </div>
      </div>

      {/* Calling Pipeline */}
      {(callPipeline.pending > 0 || callPipeline.inProgress > 0 || callPipeline.completed > 0) ? (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-foreground mb-3">
            AI Calling Pipeline<InfoTip text="Phone calls placed by the AI agent to confirm clearance type. Pending = queued, In progress = AI on the line, Completed = call finished" />
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-xl bg-amber-500 p-2.5 text-white shadow-sm">
                  <Phone className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                  Pending
                </p>
              </div>
              <p className="text-3xl font-bold text-amber-800">{callPipeline.pending}</p>
            </div>
            <div className="rounded-xl border-2 border-sky-200 bg-gradient-to-br from-sky-50 to-white p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-xl bg-sky-500 p-2.5 text-white shadow-sm">
                  <PhoneCall className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-sky-600">
                  In Progress
                </p>
              </div>
              <p className="text-3xl font-bold text-sky-800">{callPipeline.inProgress}</p>
            </div>
            <div className="rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-xl bg-emerald-500 p-2.5 text-white shadow-sm">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                  Completed
                </p>
              </div>
              <p className="text-3xl font-bold text-emerald-800">{callPipeline.completed}</p>
            </div>
            <div className="rounded-xl border-2 border-red-200 bg-gradient-to-br from-red-50 to-white p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="rounded-xl bg-red-500 p-2.5 text-white shadow-sm">
                  <XCircle className="h-5 w-5" />
                </div>
                <p className="text-xs font-semibold uppercase tracking-wider text-red-600">
                  Failed
                </p>
              </div>
              <p className="text-3xl font-bold text-red-800">{callPipeline.failed}</p>
            </div>
          </div>
          {callPipeline.completed > 0 && (
            <p className="mt-2 text-xs text-slate-500">
              Completed calls may have auto-confirmed clearance type via webhook
            </p>
          )}
        </div>
      ) : null}

      {/* Send Status */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-foreground mb-3">
          Send Status<InfoTip text="Email delivery status for pre-alert notifications" />
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-xl bg-emerald-500 p-2.5 text-white shadow-sm">
                <Send className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                Sent
              </p>
            </div>
            <p className="text-3xl font-bold text-emerald-800">{sendMetrics.sent}</p>
          </div>
          <div className="rounded-xl border-2 border-sky-200 bg-gradient-to-br from-sky-50 to-white p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-xl bg-sky-500 p-2.5 text-white shadow-sm">
                <PhoneCall className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-sky-600">
                Queued
              </p>
            </div>
            <p className="text-3xl font-bold text-sky-800">{sendMetrics.queued}</p>
          </div>
          <div className="rounded-xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-xl bg-amber-500 p-2.5 text-white shadow-sm">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                Pending
              </p>
            </div>
            <p className="text-3xl font-bold text-amber-800">{sendMetrics.pending}</p>
          </div>
          <div className="rounded-xl border-2 border-red-200 bg-gradient-to-br from-red-50 to-white p-5">
            <div className="flex items-center gap-3 mb-2">
              <div className="rounded-xl bg-red-500 p-2.5 text-white shadow-sm">
                <XCircle className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-red-600">
                Failed
              </p>
            </div>
            <p className="text-3xl font-bold text-red-800">{sendMetrics.failed}</p>
          </div>
        </div>
      </div>

      {/* Recent cases */}
      {recentCases.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-foreground">Recent Activity</h2>
            <Link href="/cases" className="text-xs font-medium text-sidebar-primary hover:underline">View all &rarr;</Link>
          </div>
          <RecentActivity cases={recentCases} />
        </div>
      ) : null}
    </div>
  );
}
