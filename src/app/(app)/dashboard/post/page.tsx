import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { DateRangePicker } from "@/components/dashboard/date-range-picker";
import { InfoTip } from "@/components/ui/info-tip";
import {
  BarChart3, Send, FileText,
  AlertTriangle, Clock, Phone,
  Lock,
} from "lucide-react";

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

function applyPostFilter(q: any) {
  return q.contains("shipment_phase", ["post_arrival"]);
}

interface PostCounts {
  total: number;
  noticesSent: number;
  doPending: number;
  doCollected: number;
  doOverdue: number;
  doPaid: number;
  doUnpaid: number;
  igmFiled: number;
  igmPending: number;
  tpHoldCount: number;
}

async function getPostCounts(start: string, end: string): Promise<PostCounts> {
  const supabase = await createClient();

  const [total, sentBatch, doPending, doCollected, doOverdue, doPaid, igmFiled, igmPending, tpHold] = await Promise.all([
    supabase.from("awb_cases").select("*", { count: "exact", head: true })
      .contains("shipment_phase", ["post_arrival"]).gte("created_at", start).lte("created_at", end),
    supabase.from("batch_items").select("*", { count: "exact", head: true })
      .eq("send_status", "sent").gte("send_completed_at", start).lte("send_completed_at", end)
      .in("batch_run_id", (await supabase.from("batch_runs").select("id").eq("phase", "post_arrival")).data?.map(r => r.id) ?? []),
    supabase.from("awb_cases").select("*", { count: "exact", head: true })
      .contains("shipment_phase", ["post_arrival"]).gte("created_at", start).lte("created_at", end)
      .eq("current_status", "do_ready"),
    supabase.from("awb_cases").select("*", { count: "exact", head: true })
      .contains("shipment_phase", ["post_arrival"]).gte("created_at", start).lte("created_at", end)
      .in("current_status", ["do_collected", "closed"]),
    supabase.from("awb_cases").select("id", { count: "exact", head: true })
      .contains("shipment_phase", ["post_arrival"]).gte("created_at", start).lte("created_at", end)
      .eq("current_status", "do_ready").not("do_ready_at", "is", null),
    supabase.from("awb_cases").select("*", { count: "exact", head: true })
      .contains("shipment_phase", ["post_arrival"]).gte("created_at", start).lte("created_at", end)
      .eq("do_payment_status", "paid"),
    supabase.from("awb_cases").select("*", { count: "exact", head: true })
      .contains("shipment_phase", ["post_arrival"]).gte("created_at", start).lte("created_at", end)
      .not("igm_number", "is", null).not("igm_number", "eq", ""),
    supabase.from("awb_cases").select("*", { count: "exact", head: true })
      .contains("shipment_phase", ["post_arrival"]).gte("created_at", start).lte("created_at", end)
      .or("igm_number.is.null,igm_number.eq."),
    supabase.from("awb_cases").select("*", { count: "exact", head: true })
      .contains("shipment_phase", ["post_arrival"]).gte("created_at", start).lte("created_at", end)
      .not("tp_hold_status", "is", null),
  ]);

  const doSafe = doOverdue.count ?? 0;
  let doOverdueActual = 0;
  const now = Date.now();
  if (doSafe > 0) {
    const { data: doRows } = await supabase.from("awb_cases").select("do_ready_at")
      .contains("shipment_phase", ["post_arrival"]).gte("created_at", start).lte("created_at", end)
      .eq("current_status", "do_ready").not("do_ready_at", "is", null);
    for (const r of doRows ?? []) {
      if (!r.do_ready_at) continue;
      if ((now - new Date(r.do_ready_at).getTime()) / 3600000 > 24) doOverdueActual++;
    }
  }

  return {
    total: total.count ?? 0,
    noticesSent: sentBatch.count ?? 0,
    doPending: doPending.count ?? 0,
    doCollected: doCollected.count ?? 0,
    doOverdue: doOverdueActual,
    doPaid: doPaid.count ?? 0,
    doUnpaid: (doSafe > 0 ? doSafe : 0) - (doPaid.count ?? 0),
    igmFiled: igmFiled.count ?? 0,
    igmPending: igmPending.count ?? 0,
    tpHoldCount: tpHold.count ?? 0,
  };
}

interface RecentPostCase {
  id: string;
  awb: string;
  current_status: string;
  mawb: string | null;
  igm_number: string | null;
  flight_number: string | null;
  dest_port: string | null;
  do_ready_at: string | null;
  do_payment_status: string | null;
  utr_no: string | null;
  do_amount: number | null;
  tp_hold_status: string | null;
  updated_at: string;
}

async function getRecentPostCases(start: string, end: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("awb_cases")
    .select("id, awb, current_status, mawb, igm_number, flight_number, dest_port, do_ready_at, do_payment_status, utr_no, do_amount, tp_hold_status, updated_at")
    .contains("shipment_phase", ["post_arrival"])
    .gte("created_at", start).lte("created_at", end)
    .order("updated_at", { ascending: false })
    .limit(10);
  return (data ?? []) as RecentPostCase[];
}

export default async function PostDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const { range, from, to } = await searchParams;
  const currentRange = ((range && map[range as keyof typeof map]) ? range : "30d") as string;
  const { start, end } = parseRange(currentRange, from, to);
  const fromDate = from || undefined;
  const toDate = to || undefined;

  const [counts, recentCases] = await Promise.all([
    getPostCounts(start, end),
    getRecentPostCases(start, end),
  ]);

  const doCollectionRate = counts.total > 0 ? Math.round((counts.doCollected / counts.total) * 100) : 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Arrival & Clearance Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Arrival and clearance operations overview for the selected period
          </p>
        </div>
        <DateRangePicker range={currentRange} from={fromDate} to={toDate} />
      </div>

      {/* Metrics grid */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-4">
        {/* Total post cases */}
        <div className="rounded-xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-xl bg-emerald-500 p-2.5 text-white shadow-sm">
              <BarChart3 className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
              Total Arrival Cases<InfoTip text="All AWBs that have entered the arrival/clearance phase" />
            </p>
          </div>
          <p className="text-3xl font-bold text-emerald-800">{counts.total}</p>
        </div>

        {/* DO Collection */}
        <div className="rounded-xl border-2 border-teal-200 bg-gradient-to-br from-teal-50 to-white p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-xl bg-teal-500 p-2.5 text-white shadow-sm">
              <Send className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-600">
              DO Collection<InfoTip text="Cases with DO ready for collection vs collected. Overdue = not collected within 24h of DO being ready" />
            </p>
          </div>
          <p className="text-3xl font-bold text-teal-800">{doCollectionRate}%</p>
          <div className="flex items-center gap-3 text-xs text-teal-600 mt-1">
            <span><strong>{counts.doCollected}</strong> collected</span>
            <span><strong>{counts.doPending}</strong> pending</span>
            {counts.doOverdue > 0 && (
              <span className="text-red-600 font-semibold">{counts.doOverdue} overdue</span>
            )}
          </div>
          <div className="mt-2 flex items-center gap-3 text-xs text-teal-700">
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 font-medium">
              {counts.doPaid} paid
            </span>
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 font-medium">
              {counts.doUnpaid} unpaid
            </span>
          </div>
        </div>

        {/* IGM Status */}
        <div className="rounded-xl border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-xl bg-blue-500 p-2.5 text-white shadow-sm">
              <FileText className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-600">
              IGM Status<InfoTip text="IGM (Import General Manifest) filing status — filed vs pending" />
            </p>
          </div>
          <p className="text-3xl font-bold text-blue-800">{counts.igmFiled}</p>
          <div className="flex items-center gap-3 text-xs text-blue-600 mt-1">
            <span><strong>{counts.igmFiled}</strong> filed</span>
            <span><strong>{counts.igmPending}</strong> pending</span>
          </div>
        </div>

        {/* TP Hold */}
        <div className="rounded-xl border-2 border-slate-200 bg-gradient-to-br from-slate-50 to-white p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-xl bg-slate-500 p-2.5 text-white shadow-sm">
              <Lock className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">
              TP Hold<InfoTip text="Cases on hold by IGM team" />
            </p>
          </div>
          <p className="text-3xl font-bold text-slate-800">{counts.tpHoldCount}</p>
          <Link href="/holds" className="text-xs font-medium text-slate-500 hover:text-slate-700 mt-1 inline-block">
            View details &rarr;
          </Link>
        </div>
      </div>

      {/* Notices sent */}
      <div className="mb-6">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center gap-3 mb-1">
            <Phone className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-semibold text-foreground">
              Cargo Arrival Notices Sent<InfoTip text="Number of cargo arrival notice emails sent in this period" />
            </p>
          </div>
          <p className="text-2xl font-bold text-foreground">{counts.noticesSent}</p>
        </div>
      </div>

      {/* Penalty / Overdue alert */}
      {counts.doOverdue > 0 && (
        <div className="mb-6 rounded-xl border-2 border-red-200 bg-red-50 p-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <p className="text-sm font-semibold text-red-800">
              {counts.doOverdue} case{counts.doOverdue > 1 ? "s" : ""} with DO overdue &mdash;
              penalty of ₹1,000 + GST/day applies
            </p>
          </div>
          <Link href="/cases?status=do_ready" className="text-xs text-red-600 hover:underline mt-1 inline-block">
            View overdue cases &rarr;
          </Link>
        </div>
      )}

      {/* Recent post-arrival cases */}
      {recentCases.length > 0 ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-foreground">
              Recent Arrival Cases<InfoTip text="Most recently updated arrival cases with IGM and DO status" />
            </h2>
            <Link href="/cases?phase=post" className="text-xs font-medium text-sidebar-primary hover:underline">
              View all &rarr;
            </Link>
          </div>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="min-w-full divide-y divide-border text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">AWB</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">MAWB</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">IGM</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Flight</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Dest</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">DO Ready</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">DO Payment</th>
                  <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">UTR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recentCases.map((c) => (
                  <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5">
                      <Link href={`/cases/${c.id}`} className="font-medium text-sidebar-primary hover:underline">
                        {c.awb}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.mawb ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.igm_number ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.flight_number ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.dest_port ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        c.current_status === "do_collected" || c.current_status === "closed"
                          ? "bg-emerald-100 text-emerald-700"
                          : c.current_status === "do_ready"
                          ? "bg-teal-100 text-teal-700"
                          : "bg-slate-100 text-slate-600"
                      }`}>
                        {c.current_status.replace(/_/g, " ")}
                      </span>
                      {c.tp_hold_status ? (
                        <span className="ml-1 inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                          HOLD
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {c.do_ready_at ? new Date(c.do_ready_at).toLocaleDateString("en-IN") : "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      {c.do_payment_status ? (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          c.do_payment_status === "paid"
                            ? "bg-emerald-100 text-emerald-700"
                            : c.do_payment_status === "overdue"
                            ? "bg-red-100 text-red-700"
                            : "bg-amber-100 text-amber-700"
                        }`}>
                          {c.do_payment_status}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                      {c.do_amount ? (
                        <span className="ml-1 text-xs text-muted-foreground">₹{c.do_amount}</span>
                      ) : null}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground font-mono text-xs">
                      {c.utr_no ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-border p-12 text-center">
          <BarChart3 className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">No post-arrival cases yet</p>
          <p className="text-xs text-muted-foreground/60 mt-1">
            Create a Post-Arrival batch to start tracking cargo arrivals.
          </p>
        </div>
      )}
    </div>
  );
}
