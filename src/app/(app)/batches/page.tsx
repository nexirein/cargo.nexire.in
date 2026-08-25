import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/ui/status-badge";

const PHASE_TABS = [
  { value: "", label: "All" },
  { value: "pre_alert", label: "Pre-alert" },
  { value: "post_arrival", label: "Post-arrival" },
  { value: "tp_hold", label: "TP Hold" },
] as const;

const TYPE_TABS = [
  { value: "u_bond", label: "uBond" },
  { value: "consol", label: "Consol" },
] as const;

const TYPE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  u_bond: { bg: "bg-sky-100", text: "text-sky-700", label: "uBond" },
  consol: { bg: "bg-indigo-100", text: "text-indigo-700", label: "Consol" },
};

const PHASE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  pre_alert: { bg: "bg-sky-100", text: "text-sky-700", label: "Pre-alert" },
  post_arrival: { bg: "bg-emerald-100", text: "text-emerald-700", label: "Post-arrival" },
  tp_hold: { bg: "bg-slate-100", text: "text-slate-600", label: "TP Hold" },
};

export default async function BatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ phase?: string; type?: string }>;
}) {
  const { phase, type } = await searchParams;
  const activePhase = PHASE_TABS.find((t) => t.value === phase)?.value ?? "";
  const activeType = TYPE_TABS.find((t) => t.value === type)?.value ?? "";
  const showTypeTabs = activePhase === "pre_alert";

  const supabase = await createClient();
  let q = supabase
    .from("batch_runs")
    .select(
      "id, run_name, run_date, status, phase, pre_alert_type, total_rows, total_sub_batches, sent_count, failed_count, created_at, mailbox_configs(display_name)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (activePhase) {
    q = q.eq("phase", activePhase);
  }

  if (showTypeTabs && activeType) {
    q = q.eq("pre_alert_type", activeType);
  }

  const { data: batches } = await q;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Batches</h1>
          <p className="mt-1 text-sm text-slate-500">
            All batch runs across Pre-alert, Arrival, and TP Hold workflows.
          </p>
        </div>
        <Link
          href="/batches/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Create batch
        </Link>
      </div>

      {/* Phase filter tabs */}
      <div className="mb-2 flex items-center gap-1.5">
        {PHASE_TABS.map((tab) => {
          const active = tab.value === activePhase;
          return (
            <Link
              key={tab.value}
              href={tab.value ? `/batches?phase=${tab.value}` : "/batches"}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
                active
                  ? "bg-sidebar-primary text-white shadow-sm"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>

      {/* Pre-alert type sub-tabs */}
      {showTypeTabs && (
        <div className="mb-4 flex items-center gap-1.5 border-b border-slate-200 pb-2">
          {TYPE_TABS.map((tab) => {
            const active = tab.value === activeType;
            return (
              <Link
                key={tab.value}
                href={`/batches?phase=pre_alert&type=${tab.value}`}
                className={`rounded-md px-3 py-1 text-xs font-medium transition ${
                  active
                    ? "bg-slate-800 text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      )}

      <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Run name</th>
              <th className="px-4 py-3">Phase</th>
              <th className="px-4 py-3">Mailbox</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Rows</th>
              <th className="px-4 py-3">Sub-batches</th>
              <th className="px-4 py-3">Sent / Failed</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(batches ?? []).map((row) => {
              const mailbox = Array.isArray(row.mailbox_configs)
                ? row.mailbox_configs[0]
                : row.mailbox_configs;
              const phaseBadge = PHASE_BADGE[row.phase ?? "pre_alert"] ?? PHASE_BADGE.pre_alert;
              const typeBadge = row.pre_alert_type ? TYPE_BADGE[row.pre_alert_type] : null;
              return (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <Link href={`/batches/${row.id}`} className="hover:underline">
                      {row.run_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${phaseBadge.bg} ${phaseBadge.text}`}>
                        {phaseBadge.label}
                      </span>
                      {typeBadge && (
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${typeBadge.bg} ${typeBadge.text}`}>
                          {typeBadge.label}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {mailbox?.display_name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-500">{row.total_rows}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {row.total_sub_batches}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {row.sent_count} / {row.failed_count}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                </tr>
              );
            })}
            {(batches ?? []).length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-sm text-slate-400"
                >
                  No batches found for this phase.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
