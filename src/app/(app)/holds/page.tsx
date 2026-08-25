import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { Lock, Search } from "lucide-react";
import { ReleaseHoldButton } from "./release-button";
import { HoldUploadForm } from "./hold-upload-form";

interface HoldCase {
  id: string;
  awb: string;
  consignee_name: string | null;
  tp_hold_reason: string | null;
  tp_hold_status: string | null;
  tp_hold_arrival_source: string | null;
  tp_hold_updated_at: string | null;
  tp_hold_clear_remarks: string | null;
  tp_hold_cleared_at: string | null;
  current_status: string;
}

async function getHoldCases(search?: string, filter?: string) {
  const supabase = await createClient();
  let q = supabase
    .from("awb_cases")
    .select("id, awb, consignee_name, tp_hold_reason, tp_hold_status, tp_hold_arrival_source, tp_hold_updated_at, tp_hold_clear_remarks, tp_hold_cleared_at, current_status")
    .not("tp_hold_status", "is", null)
    .order("tp_hold_updated_at", { ascending: false })
    .limit(200);

  if (filter === "active") {
    q = q.neq("tp_hold_status", "CLEARED");
  } else if (filter === "cleared") {
    q = q.eq("tp_hold_status", "CLEARED");
  }

  if (search) {
    q = q.or(`awb.ilike.%${search}%,tp_hold_reason.ilike.%${search}%,tp_hold_status.ilike.%${search}%`);
  }
  const { data } = await q;
  return (data ?? []) as HoldCase[];
}

export default async function HoldsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tab?: string; filter?: string }>;
}) {
  const user = await getCurrentAppUser();
  requireRole(user, "admin", "lead", "operator");
  const { q, tab, filter } = await searchParams;
  const activeTab = tab === "upload" ? "upload" : "view";
  const activeFilter = filter ?? "active";
  const cases = await getHoldCases(q, activeFilter);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Hold Tracker</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          TP hold cases from IGM team sheets
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex items-center gap-1.5">
        <Link
          href={`/holds${activeFilter !== "active" ? `?filter=${activeFilter}` : ""}`}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
            activeTab === "view"
              ? "bg-sidebar-primary text-white shadow-sm"
              : "bg-card border border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          View Holds
        </Link>
        <Link
          href={`/holds?tab=upload${activeFilter !== "active" ? `&filter=${activeFilter}` : ""}`}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
            activeTab === "upload"
              ? "bg-sidebar-primary text-white shadow-sm"
              : "bg-card border border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          Upload Hold Data
        </Link>
      </div>

      {activeTab === "view" ? (
        <>
          {/* Search + Filter */}
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <form className="flex items-center gap-2">
              {activeFilter !== "active" ? <input type="hidden" name="filter" value={activeFilter} /> : null}
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  name="q"
                  type="text"
                  defaultValue={q ?? ""}
                  placeholder="Search AWB, reason, or status…"
                  className="w-full rounded-md border border-border bg-card pl-9 pr-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                />
              </div>
              <button
                type="submit"
                className="rounded-md bg-sidebar-primary px-3 py-2 text-xs font-medium text-white transition hover:bg-sidebar-primary/90"
              >
                Search
              </button>
              {q ? (
                <Link href={`/holds?filter=${activeFilter}`} className="text-xs text-muted-foreground hover:text-foreground">
                  Clear
                </Link>
              ) : null}
            </form>

            <div className="flex items-center gap-1.5 ml-auto">
              <span className="text-xs text-muted-foreground">Show:</span>
              {(["active", "cleared", "all"] as const).map((f) => {
                const active = f === activeFilter;
                const params = new URLSearchParams();
                if (q) params.set("q", q);
                if (f !== "active") params.set("filter", f);
                const href = `/holds${params.toString() ? `?${params.toString()}` : ""}`;
                return (
                  <Link
                    key={f}
                    href={href}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                      active
                        ? "bg-sidebar-primary text-white shadow-sm"
                        : "bg-card border border-border text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f === "active" ? "Active" : f === "cleared" ? "Cleared" : "All"}
                  </Link>
                );
              })}
            </div>
          </div>

          {cases.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed border-border p-12 text-center">
              <Lock className="mx-auto h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No hold cases</p>
              <p className="text-xs text-muted-foreground/60 mt-1">
                Import a TP Hold sheet to track held AWBs here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">AWB</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Consignee</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Hold Reason</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Arrival Source</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Last Updated</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Case</th>
                    <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Clear Remarks</th>
                    <th className="px-4 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {cases.map((c) => {
                    const isCleared = c.tp_hold_status === "CLEARED";
                    return (
                      <tr key={c.id} className={`hover:bg-muted/30 transition-colors ${isCleared ? "opacity-60" : ""}`}>
                        <td className="px-4 py-2.5 font-medium">
                          <Link href={`/cases/${c.id}`} className="text-sidebar-primary hover:underline">
                            {c.awb}
                          </Link>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{c.consignee_name ?? "—"}</td>
                        <td className="px-4 py-2.5 max-w-[200px] truncate text-muted-foreground" title={c.tp_hold_reason ?? ""}>
                          {c.tp_hold_reason ?? "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            isCleared
                              ? "bg-emerald-100 text-emerald-700"
                              : c.tp_hold_status === "IMPORTED"
                              ? "bg-sky-100 text-sky-700"
                              : "bg-red-100 text-red-700"
                          }`}>
                            {c.tp_hold_status ?? "HOLD"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground">{c.tp_hold_arrival_source ?? "—"}</td>
                        <td className="px-4 py-2.5 text-muted-foreground">
                          {c.tp_hold_updated_at ? new Date(c.tp_hold_updated_at).toLocaleDateString("en-IN") : "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            {c.current_status.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="max-w-[160px] truncate px-4 py-2.5 text-xs text-muted-foreground" title={c.tp_hold_clear_remarks ?? ""}>
                          {c.tp_hold_clear_remarks ?? "—"}
                        </td>
                        <td className="px-4 py-2.5">
                          {isCleared ? (
                            <span className="text-xs text-muted-foreground">Done</span>
                          ) : (
                            <ReleaseHoldButton caseId={c.id} awb={c.awb} />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <HoldUploadForm />
      )}
    </div>
  );
}
