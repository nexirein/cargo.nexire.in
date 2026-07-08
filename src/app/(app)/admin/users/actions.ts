"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/log";
import type { AppRole } from "@/lib/auth/session";

const ROLES: AppRole[] = ["admin", "lead", "operator", "reviewer", "viewer"];

export async function updateUserRole(userId: string, formData: FormData) {
  const actor = requireRole(await getCurrentAppUser(), "admin");
  const role = String(formData.get("role") ?? "");
  if (!ROLES.includes(role as AppRole)) return;

  const admin = createAdminClient();
  const { data: before } = await admin
    .from("app_users")
    .select("role")
    .eq("id", userId)
    .single();

  const { error } = await admin
    .from("app_users")
    .update({ role })
    .eq("id", userId);

  if (!error) {
    await logAudit({
      actorUserId: actor.id,
      entityType: "app_users",
      entityId: userId,
      action: "role_change",
      metadata: { from: before?.role, to: role },
    });
  }

  revalidatePath("/admin/users");
}

export async function toggleUserActive(
  userId: string,
  isActive: boolean,
  _formData: FormData,
) {
  const actor = requireRole(await getCurrentAppUser(), "admin");
  const admin = createAdminClient();

  const { error } = await admin
    .from("app_users")
    .update({ is_active: isActive })
    .eq("id", userId);

  if (!error) {
    await logAudit({
      actorUserId: actor.id,
      entityType: "app_users",
      entityId: userId,
      action: isActive ? "activate" : "deactivate",
      metadata: {},
    });
  }

  revalidatePath("/admin/users");
}
