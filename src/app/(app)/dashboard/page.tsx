import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/auth/session";

async function getCounts() {
  const supabase = await createClient();
  const [batchRuns, openCases, slippedCases, sentToday] = await Promise.all([
    supabase.from("batch_runs").select("id", { count: "exact", head: true }),
    supabase
      .from("awb_cases")
      .select("id", { count: "exact", head: true })
      .neq("current_status", "closed"),
    supabase
      .from("awb_cases")
      .select("id", { count: "exact", head: true })
      .eq("slipped", true),
    supabase
      .from("batch_items")
      .select("id", { count: "exact", head: true })
      .eq("send_status", "sent")
      .gte("send_completed_at", new Date().toISOString().slice(0, 10)),
  ]);

  return {
    totalBatches: batchRuns.count ?? 0,
    openCases: openCases.count ?? 0,
    slippedCases: slippedCases.count ?? 0,
    sentToday: sentToday.count ?? 0,
  };
}

export default async function DashboardPage() {
  const user = await getCurrentAppUser();
  const counts = await getCounts();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">
        Welcome back{user?.fullName ? `, ${user.fullName}` : ""}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Here&apos;s what&apos;s happening across pre-alert operations today.
      </p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pre-alerts sent today" value={counts.sentToday} />
        <StatCard label="Batch runs" value={counts.totalBatches} />
        <StatCard label="Open cases" value={counts.openCases} />
        <StatCard label="Slipped cases" value={counts.slippedCases} />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
