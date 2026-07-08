import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { StatusBadge } from "@/components/ui/status-badge";

const OWNERSHIP_STATUSES = [
  "unassigned",
  "claimed",
  "assigned",
  "review",
  "closed",
  "released",
];

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ ownership?: string; q?: string }>;
}) {
  const { ownership, q } = await searchParams;
  const user = await getCurrentAppUser();
  const supabase = await createClient();

  let query = supabase
    .from("awb_cases")
    .select(
      "id, awb, current_status, ownership_status, urgency, owner_user_id, slipped, created_at, app_users(full_name, email)",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  if (ownership) query = query.eq("ownership_status", ownership);
  if (q) query = query.ilike("awb", `%${q}%`);

  const { data: cases } = await query;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Cases</h1>
          <p className="mt-1 text-sm text-slate-500">
            AWB-level follow-up ownership.
          </p>
        </div>
        {user?.role === "admin" ? (
          <Link
            href="/cases/new"
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Create test case
          </Link>
        ) : null}
      </div>

      <form className="mt-6 flex flex-wrap gap-3" method="get">
        <input
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search AWB…"
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
        />
        <select
          name="ownership"
          defaultValue={ownership ?? ""}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm"
        >
          <option value="">Any ownership</option>
          {OWNERSHIP_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Filter
        </button>
      </form>

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">AWB</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Ownership</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Slipped</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(cases ?? []).map((row) => {
              const owner = Array.isArray(row.app_users)
                ? row.app_users[0]
                : row.app_users;
              return (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <Link
                      href={`/cases/${row.id}`}
                      className="hover:underline"
                    >
                      {row.awb}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {row.current_status}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.ownership_status} />
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {owner?.full_name ?? owner?.email ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {row.slipped ? (
                      <span className="text-amber-600">yes</span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              );
            })}
            {(cases ?? []).length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-10 text-center text-sm text-slate-400"
                >
                  No cases yet — cases are created automatically once a
                  batch is sent.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
