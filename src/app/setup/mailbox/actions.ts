"use server";

import { redirect } from "next/navigation";
import { getCurrentAppUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/log";

export async function saveMailboxConfig(formData: FormData) {
  const user = await getCurrentAppUser();
  if (!user) {
    redirect("/login");
  }

  const displayName = String(formData.get("displayName") ?? "").trim();
  const operationalMailbox = String(
    formData.get("operationalMailbox") ?? "",
  ).trim();
  const taggedMailbox = String(formData.get("taggedMailbox") ?? "").trim();
  const signatureHtml = String(formData.get("signatureHtml") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "Asia/Kolkata").trim();

  if (!displayName || !operationalMailbox || !taggedMailbox) {
    redirect(
      `/setup/mailbox?error=${encodeURIComponent(
        "Display name, operational mailbox, and tagged mailbox are required.",
      )}`,
    );
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("mailbox_configs")
    .insert({
      owner_user_id: user!.id,
      display_name: displayName,
      operational_mailbox: operationalMailbox,
      tagged_mailbox: taggedMailbox,
      signature_html: signatureHtml || null,
      timezone,
    })
    .select("id")
    .single();

  if (error) {
    redirect(`/setup/mailbox?error=${encodeURIComponent(error.message)}`);
  }

  await logAudit({
    actorUserId: user!.id,
    entityType: "mailbox_configs",
    entityId: data?.id ?? null,
    action: "create",
    metadata: { operationalMailbox, taggedMailbox },
  });

  redirect("/dashboard");
}
