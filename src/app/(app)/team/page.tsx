import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { redirect } from "next/navigation";
import { Bot, UserCheck, Hand, CheckCircle2, ArrowLeftRight, Calendar, Bell, MessageSquareReply } from "lucide-react";

function timeAgo(date: string | null): string {
  if (!date) return "";
  const diff = Date.now() - new Date(date).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "just now";
  if (h < 48) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<{ member?: string; from?: string; to?: string }>;
}) {
  const user = await getCurrentAppUser();
  if (!user || user.role !== "admin") redirect("/dashboard");

  const { member: memberId, from: fromDate, to: toDate } = await searchParams;
  const supabase = await createClient();
  const now = new Date().toISOString();
  const defaultFrom = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const fDate = fromDate ?? defaultFrom;
  const tDate = toDate ?? now.slice(0, 10);

  // All team members
  const { data: members } = await supabase
    .from("app_users")
    .select("id, full_name, email, role, team_name, created_at")
    .order("full_name");

  if (!members || members.length === 0) {
    return <div className="p-8 text-center text-muted-foreground">No team members found.</div>;
  }

  // Per-member stats
  const stats: Record<string, {
    claimed: number; closed: number; transferred: number; assigned: number;
    reminders: number; repliesHandled: number;
  }> = {};

  for (const m of members) {
    const mid = m.id;
    // Claims
    const { count: claimed } = await supabase
      .from("awb_cases").select("*", { count: "exact", head: true })
      .eq("owner_user_id", mid).eq("ownership_status", "claimed")
      .gte("claimed_at", fDate).lte("claimed_at", `${tDate}T23:59:59`);

    // Closed
    const { count: closed } = await supabase
      .from("case_updates").select("*", { count: "exact", head: true })
      .eq("updated_by", mid).eq("update_type", "closed")
      .gte("created_at", fDate).lte("created_at", `${tDate}T23:59:59`);

    // Transferred (case_assignments where from_user_id = mid)
    const { count: transferred } = await supabase
      .from("case_assignments").select("*", { count: "exact", head: true })
      .eq("from_user_id", mid)
      .gte("created_at", fDate).lte("created_at", `${tDate}T23:59:59`);

    // Assigned to
    const { count: assigned } = await supabase
      .from("case_assignments").select("*", { count: "exact", head: true })
      .eq("to_user_id", mid)
      .gte("created_at", fDate).lte("created_at", `${tDate}T23:59:59`);

    // Reminders sent
    const { count: reminders } = await supabase
      .from("audit_logs").select("*", { count: "exact", head: true })
      .eq("actor_user_id", mid)
      .in("action", ["reminder_sent", "final_reminder_sent"])
      .gte("created_at", fDate).lte("created_at", `${tDate}T23:59:59`);

    // Replies handled (case_updates reply_received where they were the one who replied to the consignee)
    const { count: repliesHandled } = await supabase
      .from("case_updates").select("*", { count: "exact", head: true })
      .eq("updated_by", mid).eq("update_type", "reply_received")
      .gte("created_at", fDate).lte("created_at", `${tDate}T23:59:59`);

    stats[mid] = {
      claimed: claimed ?? 0, closed: closed ?? 0, transferred: transferred ?? 0,
      assigned: assigned ?? 0, reminders: reminders ?? 0, repliesHandled: repliesHandled ?? 0,
    };
  }

  // Selected member detail
  let selectedMember = null;
  let detailStats = null;
  let recentActivity: any[] = [];

  if (memberId && members.find((m) => m.id === memberId)) {
    selectedMember = members.find((m) => m.id === memberId);
    detailStats = stats[memberId];

    const { data: cases } = await supabase
      .from("awb_cases")
      .select("id, awb, current_status, issue_type, urgency, human_review_required, claimed_at, created_at")
      .eq("owner_user_id", memberId)
      .order("claimed_at", { ascending: false })
      .limit(20);

    recentActivity = cases ?? [];
  }

  // AI vs Human totals
  const { count: totalCasesAll } = await supabase
    .from("awb_cases").select("*", { count: "exact", head: true });
  const { count: aiHandledAll } = await supabase
    .from("awb_cases").select("*", { count: "exact", head: true })
    .eq("human_review_required", false).eq("current_status", "closed");
  const aiPct = totalCasesAll && totalCasesAll > 0
    ? Math.round(((aiHandledAll ?? 0) / totalCasesAll) * 100) : 0;

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Team Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Per-member performance &mdash; track claims, closes, transfers, and AI contribution.
        </p>
      </div>

      {/* AI hero bar */}
      <div className="mb-6 rounded-xl border-2 border-emerald-200 bg-emerald-50/50 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-emerald-500 p-2.5 text-white">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-emerald-800">AI Ownership: {aiPct}%</p>
              <p className="text-xs text-emerald-600">
                {aiHandledAll ?? 0} of {totalCasesAll ?? 0} cases handled automatically
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-emerald-700 font-medium">Target: 50%</span>
            <div className="w-32 h-2 overflow-hidden rounded-full bg-emerald-200">
              <div
                className={`h-full rounded-full transition-all ${
                  aiPct >= 50 ? "bg-emerald-500" : aiPct >= 30 ? "bg-amber-400" : "bg-red-400"
                }`}
                style={{ width: `${Math.min(aiPct, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Date filter */}
      <form method="get" className="mb-6 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <input type="date" name="from" defaultValue={fDate}
            className="h-9 rounded-lg border border-input bg-card px-3 text-sm" />
        </div>
        <span className="text-xs text-muted-foreground">to</span>
        <input type="date" name="to" defaultValue={tDate}
          className="h-9 rounded-lg border border-input bg-card px-3 text-sm" />
        {memberId ? <input type="hidden" name="member" value={memberId} /> : null}
        <button type="submit"
          className="h-9 rounded-lg bg-sidebar-primary px-4 text-sm font-medium text-white transition hover:bg-sidebar-primary/90">
          Apply
        </button>
      </form>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Member list */}
        <div className="lg:col-span-1">
          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">Team Members</h2>
            </div>
            <div className="divide-y divide-border">
              {members.map((m) => {
                const s = stats[m.id];
                const totalActions = s.claimed + s.closed + s.transferred + s.reminders;
                const isSelected = m.id === memberId;
                return (
                  <Link
                    key={m.id}
                    href={`/team?member=${m.id}&from=${fDate}&to=${tDate}`}
                    className={`block px-4 py-3 transition hover:bg-muted/50 ${isSelected ? "bg-muted/30 border-l-2 border-sidebar-primary" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">{m.full_name ?? m.email}</p>
                        <p className="text-xs text-muted-foreground">{m.role} &middot; {m.team_name ?? "—"}</p>
                      </div>
                      <span className="text-xs font-medium text-sidebar-primary">{totalActions}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Detail panel */}
        <div className="lg:col-span-2 space-y-4">
          {selectedMember ? (
            <>
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="text-base font-semibold text-foreground">{selectedMember.full_name ?? selectedMember.email}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{selectedMember.role} &middot; Joined {new Date(selectedMember.created_at).toLocaleDateString()}</p>

                {detailStats && (
                  <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <StatCard icon={<Hand className="h-4 w-4" />} label="Claims" value={detailStats.claimed} color="text-sky-600" bg="bg-sky-50" />
                    <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="Closed" value={detailStats.closed} color="text-emerald-600" bg="bg-emerald-50" />
                    <StatCard icon={<ArrowLeftRight className="h-4 w-4" />} label="Transferred out" value={detailStats.transferred} color="text-amber-600" bg="bg-amber-50" />
                    <StatCard icon={<ArrowLeftRight className="h-4 w-4" />} label="Assigned to" value={detailStats.assigned} color="text-purple-600" bg="bg-purple-50" />
                    <StatCard icon={<Bell className="h-4 w-4" />} label="Reminders sent" value={detailStats.reminders} color="text-red-600" bg="bg-red-50" />
                    <StatCard icon={<MessageSquareReply className="h-4 w-4" />} label="Replies handled" value={detailStats.repliesHandled} color="text-emerald-600" bg="bg-emerald-50" />
                  </div>
                )}
              </div>

              {/* Recent cases */}
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="border-b border-border px-4 py-3">
                  <h3 className="text-sm font-semibold text-foreground">Cases claimed ({recentActivity.length})</h3>
                </div>
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">AWB</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Issue</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">Claimed</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {recentActivity.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-4 py-6 text-center text-xs text-muted-foreground">
                          No cases claimed in this period.
                        </td>
                      </tr>
                    ) : (
                      recentActivity.map((c) => (
                        <tr key={c.id} className="hover:bg-muted/30">
                          <td className="px-4 py-3 font-mono text-sm font-medium">
                            <Link href={`/cases/${c.id}`} className="text-sidebar-primary hover:underline">{c.awb}</Link>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{c.current_status.replace(/_/g, " ")}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{c.issue_type ?? "\u2014"}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">{timeAgo(c.claimed_at)}</td>
                          <td className="px-4 py-3 text-right">
                            <Link href={`/cases/${c.id}`} className="text-xs font-medium text-sidebar-primary hover:underline">View</Link>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card p-12 text-center">
              <UserCheck className="h-10 w-10 text-muted-foreground/30" />
              <p className="mt-4 font-medium text-foreground">Select a team member</p>
              <p className="mt-1 text-xs text-muted-foreground">Click on a member from the left panel to view their analytics.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color, bg }: {
  icon: React.ReactNode; label: string; value: number; color: string; bg: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <div className={`rounded-md ${bg} p-1.5 ${color}`}>{icon}</div>
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={`mt-1.5 text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
