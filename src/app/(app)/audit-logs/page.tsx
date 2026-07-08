import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function AuditLogsPage() {
  const user = await getCurrentAppUser();
  if (user?.role !== "admin" && user?.role !== "lead") {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("audit_logs")
    .select("id, entity_type, entity_id, action, metadata, created_at, app_users(full_name, email)")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Audit logs</h1>
      <p className="mt-1 text-sm text-slate-500">
        The most recent 100 actions across the platform.
      </p>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(logs ?? []).map((row) => {
              const actor = Array.isArray(row.app_users)
                ? row.app_users[0]
                : row.app_users;
              return (
                <tr key={row.id}>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-slate-900">
                    {actor?.full_name ?? actor?.email ?? "System"}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {row.action}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {row.entity_type}
                    {row.entity_id ? ` · ${row.entity_id.slice(0, 8)}` : ""}
                  </td>
                  <td className="max-w-xs truncate px-4 py-3 text-slate-400">
                    {row.metadata && Object.keys(row.metadata).length > 0
                      ? JSON.stringify(row.metadata)
                      : "—"}
                  </td>
                </tr>
              );
            })}
            {(logs ?? []).length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-sm text-slate-400"
                >
                  No activity yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
