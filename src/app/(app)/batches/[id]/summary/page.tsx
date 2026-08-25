import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { WizardSteps } from "@/components/batches/wizard-steps";
import { StatusBadge } from "@/components/ui/status-badge";
import { Bot, UserCheck, Hand, ShieldCheck, RefreshCw, Phone, CheckCircle, XCircle } from "lucide-react";
import { RetryFailedItems } from "@/components/batches/retry-failed-items";
import { PaginatedItemsTable } from "@/components/batches/paginated-items-table";
import { SummaryAutoRefresh } from "./summary-auto-refresh";

export default async function BatchSummaryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const filter = typeof sp.status === "string" ? sp.status : "all";
  const replyFilter = typeof sp.reply === "string" ? sp.reply : "all";

  const supabase = await createClient();
  const user = await getCurrentAppUser();
  const canRetry = user?.role === "admin" || user?.role === "lead";

  const { data: batch } = await supabase
    .from("batch_runs")
    .select(
      "id, run_name, status, phase, pre_alert_type, total_rows, sent_count, failed_count, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!batch) {
    notFound();
  }

  const { data: allItems } = await supabase
    .from("batch_items")
    .select("id, awb, consignee_name, consignee_email, send_status, failure_reason, attachment_status, clearance_type, send_completed_at, created_at, shipment_data")
    .eq("batch_run_id", id)
    .order("awb");

  const failedItems = (allItems ?? [])
    .filter((i) => i.send_status === "failed")
    .map((i) => ({
      id: i.id,
      awb: i.awb,
      consignee_email: i.consignee_email,
      failure_reason: i.failure_reason,
    }));

  const awbs = (allItems ?? []).map((i) => i.awb);

  const { data: cases } = await supabase
    .from("awb_cases")
    .select("id, awb, current_status, human_review_required, ownership_status, owner_user_id")
    .in("awb", awbs.length > 0 ? awbs : ["__none__"]);

  const caseByAwb = new Map<string, NonNullable<typeof cases>[number]>(
    (cases ?? []).map((c) => [c.awb, c]),
  );

  // Clearance type breakdown for this batch
  const ctCounts: Record<string, number> = {};
  for (const bi of allItems ?? []) {
    if (bi.clearance_type) ctCounts[bi.clearance_type] = (ctCounts[bi.clearance_type] ?? 0) + 1;
  }

  // Call tasks for this batch
  const { data: callTasks } = await supabase
    .from("call_tasks")
    .select("id, awb, status, call_type, vapi_call_id, completed_at, result_data")
    .in("awb", awbs.length > 0 ? awbs : ["__none__"])
    .order("created_at", { ascending: false });

  // Broker master to determine resolution source
  const { data: brokerMaster } = await supabase
    .from("broker_master")
    .select("company_name_normalized, broker_type");

  function normalize(str: string): string {
    return str.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }
  const masterNormSet = new Set((brokerMaster ?? []).map((r) => r.company_name_normalized));

  const callPipelineStats = {
    pending: callTasks?.filter((t) => t.status === "pending").length ?? 0,
    inProgress: callTasks?.filter((t) => t.status === "in_progress").length ?? 0,
    completed: callTasks?.filter((t) => t.status === "done").length ?? 0,
    failed: callTasks?.filter((t) => t.status === "failed").length ?? 0,
  };
  const totalCalls = callTasks?.length ?? 0;

  // Resolution source for each AWB
  const callDoneByAwb = new Set(
    (callTasks ?? []).filter((t) => t.status === "done" || t.status === "completed").map((t) => t.awb),
  );
  const itemsWithResolution = (allItems ?? []).map((item) => {
    let resolvedFrom: "master" | "ai_call" | "manual" | "auto" | null = null;
    const ct = item.clearance_type;
    if (ct === "nfbrk") resolvedFrom = "auto";
    else if (ct === "febrk-jeena" || ct === "febrk-sunimpex") {
      const normalized = normalize(item.consignee_name ?? "");
      resolvedFrom = masterNormSet.has(normalized) ? "master" : "manual";
    } else if (ct === "hold") resolvedFrom = "auto";
    else if (callDoneByAwb.has(item.awb)) resolvedFrom = "ai_call";
    return { ...item, resolvedFrom };
  });

  const sentItems = itemsWithResolution.filter((i) => i.send_status === "sent");
  const masterResolvedCount = itemsWithResolution.filter((i) => i.resolvedFrom === "master").length;
  const aiCallResolvedCount = itemsWithResolution.filter((i) => i.resolvedFrom === "ai_call").length;
  const confirmedAwsFromCalls = (callTasks ?? [])
    .filter((t) => (t.status === "done" || t.status === "completed") && t.result_data)
    .map((t) => ({ awb: t.awb, resultData: t.result_data }));

  // Adjunct sending time
  const sentCompletedAts = sentItems
    .map((i) => i.send_completed_at)
    .filter((d): d is string => !!d)
    .sort();
  const adjunctStart = sentCompletedAts.length > 0 ? new Date(sentCompletedAts[0]).getTime() : null;
  const adjunctEnd = sentCompletedAts.length > 1 ? new Date(sentCompletedAts[sentCompletedAts.length - 1]).getTime() : adjunctStart;
  const adjunctSeconds = adjunctStart && adjunctEnd ? Math.round((adjunctEnd - adjunctStart) / 1000) : 0;

  // Per-branch completion
  const branchMap = new Map<string, { total: number; sent: number; failed: number }>();
  for (const item of itemsWithResolution) {
    const branch = (item.shipment_data as Record<string, string> | null)?.["Loc"] ?? (item.shipment_data as Record<string, string> | null)?.["Destination"] ?? "Unknown";
    const entry = branchMap.get(branch) ?? { total: 0, sent: 0, failed: 0 };
    entry.total++;
    if (item.send_status === "sent") entry.sent++;
    if (item.send_status === "failed") entry.failed++;
    branchMap.set(branch, entry);
  }
  const branchEntries = Array.from(branchMap.entries()).sort((a, b) => b[1].total - a[1].total);

  const totalCases = cases?.length ?? 0;
  const closedCases = cases?.filter(
    (c) => c.current_status === "closed",
  ).length ?? 0;
  const aiHandled =
    cases?.filter(
      (c) => c.current_status === "closed" && !c.human_review_required,
    ).length ?? 0;
  const humanHandled =
    cases?.filter(
      (c) => c.current_status === "closed" && c.human_review_required,
    ).length ?? 0;
  const claimed = cases?.filter((c) => c.ownership_status === "claimed").length ?? 0;
  const pendingCases = cases?.filter((c) => c.current_status !== "closed").length ?? 0;
  const aiPct = totalCases > 0 ? Math.round((aiHandled / totalCases) * 100) : 0;

  const ownerIds = [
    ...new Set(
      (cases ?? [])
        .filter((c) => c.owner_user_id)
        .map((c) => c.owner_user_id!),
    ),
  ];
  const { data: owners } = await supabase
    .from("app_users")
    .select("id, full_name, email")
    .in("id", ownerIds.length > 0 ? ownerIds : ["__none__"]);
  const ownerMap = new Map(
    (owners ?? []).map((o) => [o.id, o.full_name ?? o.email]),
  );

  const memberStats: Record<string, { claimed: number; closed: number }> = {};
  for (const c of cases ?? []) {
    if (!c.owner_user_id) continue;
    if (!memberStats[c.owner_user_id]) memberStats[c.owner_user_id] = { claimed: 0, closed: 0 };
    if (c.ownership_status === "claimed") memberStats[c.owner_user_id].claimed++;
    if (c.current_status === "closed") memberStats[c.owner_user_id].closed++;
  }

  const itemsWithCase = (allItems ?? []).map((item) => ({
    ...item,
    caseInfo: caseByAwb.get(item.awb),
  }));

  const filtered = itemsWithCase.filter((item) => {
    if (filter === "sent" && item.send_status !== "sent") return false;
    if (filter === "failed" && item.send_status !== "failed") return false;
    if (filter === "pending" && item.send_status !== "pending" && item.send_status !== "retrying") return false;
    if (replyFilter === "replied" && !item.caseInfo) return false;
    if (replyFilter === "awaiting" && item.caseInfo?.current_status !== "awaiting_reply") return false;
    if (replyFilter === "received" && item.caseInfo?.current_status !== "reply_received") return false;
    return true;
  });

  const repliedCount = itemsWithCase.filter((i) => i.caseInfo?.current_status === "reply_received").length;
  const awaitingCount = itemsWithCase.filter((i) => i.caseInfo?.current_status === "awaiting_reply").length;

  return (
    <div>
      <WizardSteps current="summary" phase={batch.phase ?? "pre_alert"} preAlertType={batch.pre_alert_type} />
      <SummaryAutoRefresh batchRunId={id} />
      <div className="mt-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-slate-900">
          {batch.run_name}
        </h1>
        <StatusBadge status={batch.status} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-5">
        <SummaryCard label="Recipients" value={batch.total_rows} />
        <SummaryCard label="Sent" value={batch.sent_count} success />
        <SummaryCard label="Failed" value={batch.failed_count} danger={batch.failed_count > 0} />
        <SummaryCard label="Replies" value={repliedCount} success={repliedCount > 0} />
        <SummaryCard label="Awaiting" value={awaitingCount} muted />
      </div>

      {/* Already sent + timer */}
      {sentItems.length > 0 ? (
        <div className="mt-6 rounded-xl border-2 border-sky-200 bg-sky-50/50 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-sky-500 p-2.5 text-white">
                <CheckCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-sky-800">
                  Already sent — {sentItems.length} of {batch.total_rows} items
                </p>
                <p className="text-xs text-sky-600">
                  {adjunctSeconds > 0
                    ? `Total sending time: ${adjunctSeconds >= 60 ? `${Math.floor(adjunctSeconds / 60)}m ${adjunctSeconds % 60}s` : `${adjunctSeconds}s`}`
                    : "All items sent"}
                </p>
              </div>
            </div>
            <span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">
              {adjunctSeconds > 0
                ? `${adjunctSeconds >= 60 ? `${Math.floor(adjunctSeconds / 60)}m ${adjunctSeconds % 60}s` : `${adjunctSeconds}s`} adjunct`
                : "Complete"}
            </span>
          </div>
        </div>
      ) : null}

      <div className="mt-6 rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500 p-2.5 text-white">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-800">
                AI vs Human: {aiPct}% AI-handled
              </p>
              <p className="text-xs text-emerald-600">
                {aiHandled} AI-closed &middot; {humanHandled} human-closed &middot;{" "}
                {claimed} claimed &middot; {pendingCases} pending
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-emerald-700 font-medium">
              Target: 50%
            </span>
            <div className="w-32 h-2 overflow-hidden rounded-full bg-emerald-200">
              <div
                className={`h-full rounded-full transition-all ${
                  aiPct >= 50
                    ? "bg-emerald-500"
                    : aiPct >= 30
                      ? "bg-amber-400"
                      : "bg-red-400"
                }`}
                style={{ width: `${Math.min(aiPct, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {ownerIds.length > 0 && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <UserCheck className="h-4 w-4" />
            Team involvement ({ownerIds.length} members)
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ownerIds
              .map((oid) => ({
                id: oid,
                name: ownerMap.get(oid) ?? "Unknown",
                claimed: memberStats[oid]?.claimed ?? 0,
                closed: memberStats[oid]?.closed ?? 0,
              }))
              .sort((a, b) => b.claimed - a.claimed)
              .map((m) => (
                <div
                  key={m.id}
                  className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700">
                      {m.name.charAt(0)}
                    </div>
                    <span className="text-sm font-medium text-slate-700">
                      {m.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Hand className="h-3 w-3" />
                      {m.claimed}
                    </span>
                    <span className="flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3" />
                      {m.closed}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Clearance type confirmation */}
      {Object.keys(ctCounts).length > 0 && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <CheckCircle className="h-4 w-4 text-emerald-600" />
            Confirmed clearance types
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            {Object.entries(ctCounts)
              .filter(([ct]) => ct !== "calling" && ct !== "hold")
              .map(([ct, count]) => (
                <span key={ct} className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 border border-emerald-200">
                  <CheckCircle className="h-3.5 w-3.5" />
                  {ct.includes("febrk") ? ct.replace("-", " — ") : ct.toUpperCase()}
                  <span className="ml-1 text-emerald-500">({count})</span>
                </span>
              ))}
            {Object.entries(ctCounts)
              .filter(([ct]) => ct === "calling" || ct === "hold")
              .map(([ct, count]) => (
                <span key={ct} className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700 border border-amber-200">
                  <Phone className="h-3.5 w-3.5" />
                  {ct.charAt(0).toUpperCase() + ct.slice(1)} <span className="text-amber-500">({count})</span>
                </span>
              ))}
          </div>
        </div>
      )}

      {/* AI ownership */}
      {(masterResolvedCount > 0 || aiCallResolvedCount > 0) && (
        <div className="mt-6 rounded-xl border-2 border-indigo-200 bg-indigo-50/30 p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-indigo-800">
            <Bot className="h-4 w-4" />
            AI ownership — {masterResolvedCount + aiCallResolvedCount} items resolved without manual effort
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-200 text-sm font-bold text-emerald-700">
                  DB
                </div>
                <div>
                  <p className="text-sm font-semibold text-emerald-800">
                    Resolved from master DB — {masterResolvedCount}
                  </p>
                  <p className="text-xs text-emerald-600">
                    Auto-matched via broker master database
                  </p>
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-200 text-sm font-bold text-amber-700">
                  AI
                </div>
                <div>
                  <p className="text-sm font-semibold text-amber-800">
                    Confirmed via AI call — {aiCallResolvedCount}
                  </p>
                  <p className="text-xs text-amber-600">
                    {confirmedAwsFromCalls.length > 0
                      ? `AWBs: ${confirmedAwsFromCalls.map((c) => c.awb).join(", ")}`
                      : "Calls completed but awaiting results"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Per-branch completion */}
      {branchEntries.length > 1 && (
        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="mb-3 text-sm font-semibold text-slate-700">
            Completion per branch
          </h3>
          <div className="space-y-3">
            {branchEntries.map(([branch, stats]) => {
              const pct = stats.total > 0 ? Math.round((stats.sent / stats.total) * 100) : 0;
              return (
                <div key={branch}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-slate-700">{branch}</span>
                    <span className="text-xs text-slate-400">
                      {stats.sent} sent / {stats.failed} failed / {stats.total} total
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className={`h-full rounded-full transition-all ${
                        pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-red-400"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Calling pipeline */}
      {totalCalls > 0 && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/30 p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-800">
            <Phone className="h-4 w-4" />
            AI Calling Pipeline ({totalCalls} total)
          </h3>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <p className="text-xs text-amber-600">Pending</p>
              <p className="text-lg font-bold text-amber-800">{callPipelineStats.pending}</p>
            </div>
            <div>
              <p className="text-xs text-sky-600">In Progress</p>
              <p className="text-lg font-bold text-sky-800">{callPipelineStats.inProgress}</p>
            </div>
            <div>
              <p className="text-xs text-emerald-600">Completed</p>
              <p className="text-lg font-bold text-emerald-800">{callPipelineStats.completed}</p>
            </div>
            <div>
              <p className="text-xs text-red-600">Failed</p>
              <p className="text-lg font-bold text-red-800">{callPipelineStats.failed}</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="mb-3 text-sm font-semibold text-slate-700">
          Case status breakdown
        </h3>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <SummaryCard label="Total cases" value={totalCases} />
          <SummaryCard label="AI-closed" value={aiHandled} success />
          <SummaryCard label="Human-closed" value={humanHandled} />
          <SummaryCard label="Pending" value={pendingCases} muted />
        </div>
      </div>

      {canRetry && failedItems.length > 0 && (
        <div className="mt-6">
          <RetryFailedItems batchRunId={id} items={failedItems} />
        </div>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-slate-500">Status:</span>
        {["all", "sent", "failed", "pending"].map((f) => (
          <Link
            key={f}
            href={`/batches/${id}/summary?status=${f}&reply=${replyFilter}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              filter === f
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
          </Link>
        ))}
        <span className="ml-4 text-xs font-medium text-slate-500">Reply:</span>
        {["all", "awaiting", "received", "replied"].map((f) => (
          <Link
            key={f}
            href={`/batches/${id}/summary?status=${filter}&reply=${f}`}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              replyFilter === f
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
          </Link>
        ))}
      </div>

      <div className="mt-4">
        <PaginatedItemsTable items={filtered} batchId={id} />
      </div>

      <div className="mt-6 flex gap-3">
        <Link
          href="/batches"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Back to batches
        </Link>
        <Link
          href={`/cases?batch=${id}`}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          View cases from this run
        </Link>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  success,
  danger,
  muted,
}: {
  label: string;
  value: number;
  success?: boolean;
  danger?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p
        className={`mt-2 text-3xl font-semibold ${
          success
            ? "text-emerald-600"
            : danger
              ? "text-red-600"
              : muted
                ? "text-slate-400"
                : "text-slate-900"
        }`}
      >
        {value}
      </p>
    </div>
  );
}
