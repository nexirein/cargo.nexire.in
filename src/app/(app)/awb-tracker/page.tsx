import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function AwbTrackerPage() {
  const supabase = await createClient();

  const { data: cases } = await supabase
    .from("awb_cases")
    .select("id, awb, current_status, clearance_type, created_at, tp_hold_status")
    .contains("shipment_phase", ["pre_alert"])
    .not("shipment_phase", "cs", "{post_arrival}")
    .is("igm_number", null)
    .is("tp_hold_status", null)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = cases ?? [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">AWB Tracker</h1>
        <p className="mt-1 text-sm text-slate-500">
          Pre-alerted AWBs that have not yet received IGM or TP hold update.
          Once IGM is recorded or a hold is placed, the AWB automatically
          leaves this list.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center">
          <p className="text-sm text-slate-500">
            All pre-alerted AWBs have been updated with IGM data.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">AWB</th>
                <th className="px-4 py-3">Clearance Type</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Pre-alerted</th>
                <th className="px-4 py-3">Days Since</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((c) => {
                const daysSince = Math.floor(
                  (Date.now() - new Date(c.created_at).getTime()) / 86400000,
                );
                return (
                  <tr key={c.id}>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {c.awb}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {c.clearance_type ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                        {c.current_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(c.created_at).toLocaleDateString("en-IN")}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {daysSince}d
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/cases/${c.id}`}
                        className="text-xs font-medium text-slate-600 hover:text-slate-900"
                      >
                        View case →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length >= 100 && (
            <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-400">
              Showing 100 of {rows.length}+ — refine your filters.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
