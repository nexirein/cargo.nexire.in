"use client";

import type { AppRole } from "@/lib/auth/session";
import { ROLE_LABELS } from "@/lib/auth/rbac";

const ROLES: AppRole[] = ["admin", "lead", "operator", "reviewer", "viewer"];

export function RoleSelect({
  action,
  defaultValue,
}: {
  action: (formData: FormData) => void;
  defaultValue: AppRole;
}) {
  return (
    <form action={action}>
      <select
        name="role"
        defaultValue={defaultValue}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {ROLE_LABELS[r]}
          </option>
        ))}
      </select>
    </form>
  );
}
