"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { createAdminClient } from "@/lib/supabase/admin";

export async function markCallCompleted(callId: string) {
  const user = await getCurrentAppUser();
  requireRole(user, "admin", "lead", "operator");

  const admin = createAdminClient();
  await admin
    .from("call_tasks")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", callId);

  revalidatePath("/calls");
}

export async function skipCall(callId: string) {
  const user = await getCurrentAppUser();
  requireRole(user, "admin", "lead", "operator");

  const admin = createAdminClient();
  await admin
    .from("call_tasks")
    .update({
      status: "skipped",
      completed_at: new Date().toISOString(),
    })
    .eq("id", callId);

  revalidatePath("/calls");
}
