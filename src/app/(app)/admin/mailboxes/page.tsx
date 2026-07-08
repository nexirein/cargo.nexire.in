import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

export default async function AdminMailboxesPage() {
  const user = await getCurrentAppUser();
  if (user?.role !== "admin") {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data: mailboxes } = await supabase
    .from("mailbox_configs")
    .select(
      "id, display_name, operational_mailbox, tagged_mailbox, timezone, is_active, app_users(full_name, email)",
    )
    .order("created_at", { ascending: true });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Mailboxes</h1>
      <p className="mt-1 text-sm text-slate-500">
        Every operational mailbox configured across the team.
      </p>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Display name</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Sends from</th>
              <th className="px-4 py-3">Tagged/CC mailbox</th>
              <th className="px-4 py-3">Timezone</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(mailboxes ?? []).map((row) => {
              const owner = Array.isArray(row.app_users)
                ? row.app_users[0]
                : row.app_users;
              return (
                <tr key={row.id}>
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {row.display_name}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {owner?.full_name ?? owner?.email ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {row.operational_mailbox}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {row.tagged_mailbox}
                  </td>
                  <td className="px-4 py-3 text-slate-500">{row.timezone}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        row.is_active
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {row.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                </tr>
              );
            })}
            {(mailboxes ?? []).length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-sm text-slate-400"
                >
                  No mailboxes configured yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
