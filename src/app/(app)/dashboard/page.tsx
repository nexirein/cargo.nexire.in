import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  LayoutDashboard,
  BarChart3,
  ArrowRight, CheckCircle, Phone, Send,
} from "lucide-react";

async function getLandingCounts() {
  const supabase = await createClient();
  const [priorCount, postCount, holdCount, callsCount, confirmedCount, sentCount] = await Promise.all([
    supabase
      .from("awb_cases")
      .select("*", { count: "exact", head: true })
      .or("shipment_phase.is.null,shipment_phase.cs.{pre_alert}"),
    supabase
      .from("awb_cases")
      .select("*", { count: "exact", head: true })
      .contains("shipment_phase", ["post_arrival"]),
    supabase
      .from("awb_cases")
      .select("*", { count: "exact", head: true })
      .not("tp_hold_status", "is", null),
    supabase
      .from("call_tasks")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("awb_cases")
      .select("*", { count: "exact", head: true })
      .or("shipment_phase.is.null,shipment_phase.cs.{pre_alert}")
      .not("clearance_type", "is", null)
      .neq("clearance_type", "calling")
      .neq("clearance_type", "hold"),
    supabase
      .from("batch_items")
      .select("*", { count: "exact", head: true })
      .eq("send_status", "sent"),
  ]);
  return {
    priorActive: priorCount.count ?? 0,
    postActive: postCount.count ?? 0,
    holdCount: holdCount.count ?? 0,
    pendingCalls: callsCount.count ?? 0,
    confirmedCount: confirmedCount.count ?? 0,
    sentCount: sentCount.count ?? 0,
  };
}

export default async function DashboardLandingPage() {
  const counts = await getLandingCounts();

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh]">
      <h1 className="text-3xl font-bold text-foreground mb-2">Operations Dashboard</h1>
      <p className="text-sm text-muted-foreground mb-12 text-center max-w-md">
        Select a workflow to view its operational metrics, pipeline, and key
        indicators.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-3xl">
        {/* Prior Operations Card */}
        <Link
          href="/dashboard/prior"
          className="group relative rounded-2xl border-2 border-sky-200 bg-gradient-to-br from-sky-50 to-white p-8 transition-all hover:shadow-xl hover:-translate-y-1 hover:border-sky-400"
        >
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-sky-500 text-white shadow-sm">
            <LayoutDashboard className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-sky-900 mb-2">Pre-alert Operations</h2>
          <p className="text-sm text-sky-700/70 mb-4">
            Pre-alert clearance notifications, pipeline tracking, penalty
            exposure, and AI impact metrics.
          </p>
          <div className="flex items-center gap-3 text-xs text-sky-600 mb-4">
            <span className="font-semibold text-sky-800">{counts.priorActive} active cases</span>
            <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3" />{counts.confirmedCount} confirmed</span>
            <span className="flex items-center gap-1"><Send className="h-3 w-3" />{counts.sentCount} sent</span>
          </div>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-sky-600 group-hover:text-sky-700">
            Open Dashboard <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>

        {/* Post Operations Card */}
        <Link
          href="/dashboard/post"
          className="group relative rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-8 transition-all hover:shadow-xl hover:-translate-y-1 hover:border-emerald-400"
        >
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-emerald-500 text-white shadow-sm">
            <BarChart3 className="h-7 w-7" />
          </div>
          <h2 className="text-xl font-bold text-emerald-900 mb-2">Arrival & Clearance</h2>
          <p className="text-sm text-emerald-700/70 mb-4">
            Cargo arrival notices, DO collection tracking, IGM status, and
            TP hold case management.
          </p>
          <div className="flex items-center gap-4 text-xs text-emerald-600 mb-4">
            <span className="font-semibold text-emerald-800">{counts.postActive} post-arrival cases</span>
            <span>{counts.holdCount} on hold</span>
            {counts.pendingCalls > 0 && (
              <span className="text-amber-600"><Phone className="mr-0.5 inline h-3 w-3" />{counts.pendingCalls} pending calls</span>
            )}
          </div>
          <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 group-hover:text-emerald-700">
            Open Dashboard <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </Link>
      </div>
    </div>
  );
}
