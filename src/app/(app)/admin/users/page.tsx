import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import type { AppRole } from "@/lib/auth/session";
import { updateUserRole, toggleUserActive } from "./actions";
import { RoleSelect } from "./role-select";

export default async function AdminUsersPage() {
  const user = await getCurrentAppUser();
  if (user?.role !== "admin") {
    redirect("/dashboard");
  }

  const supabase = await createClient();
  const { data: users } = await supabase
    .from("app_users")
    .select("id, email, full_name, role, team_name, is_active, created_at")
    .order("created_at", { ascending: true });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Team</h1>
      <p className="mt-1 text-sm text-slate-500">
        Manage roles and access for everyone on the platform.
      </p>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Team</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(users ?? []).map((row) => (
              <tr key={row.id}>
                <td className="px-4 py-3 font-medium text-slate-900">
                  {row.full_name ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-500">{row.email}</td>
                <td className="px-4 py-3 text-slate-500">
                  {row.team_name ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <RoleSelect
                    action={updateUserRole.bind(null, row.id)}
                    defaultValue={row.role as AppRole}
                  />
                </td>
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
                <td className="px-4 py-3 text-right">
                  <form
                    action={toggleUserActive.bind(
                      null,
                      row.id,
                      !row.is_active,
                    )}
                  >
                    <button
                      type="submit"
                      className="text-xs font-medium text-slate-500 hover:text-slate-900"
                    >
                      {row.is_active ? "Deactivate" : "Activate"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
