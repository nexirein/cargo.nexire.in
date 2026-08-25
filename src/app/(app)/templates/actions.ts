"use server";

import { revalidatePath } from "next/cache";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/log";

const ATTACHMENT_BUCKET = "template-attachments";

export async function createTemplate(formData: FormData) {
  requireRole(await getCurrentAppUser(), "admin", "lead");

  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "custom").trim();
  const subjectTemplate = String(formData.get("subjectTemplate") ?? "").trim();
  const bodyHtml = String(formData.get("bodyHtml") ?? "").trim();
  const ccRaw = String(formData.get("ccEmails") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();

  if (!name || !subjectTemplate || !bodyHtml) {
    return { error: "Name, subject template, and body HTML are required." };
  }

  const ccEmails = ccRaw
    ? ccRaw.split("\n").map((s) => s.trim()).filter(Boolean)
    : [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("templates")
    .insert({
      name,
      type,
      subject_template: subjectTemplate,
      body_html: bodyHtml,
      cc_emails: ccEmails,
      description: description || null,
      notes: notes || null,
    })
    .select("id")
    .single();

  if (error) {
    return { error: error.message };
  }

  await logAudit({
    actorUserId: (await getCurrentAppUser())!.id,
    entityType: "templates",
    entityId: data.id,
    action: "create",
    metadata: { name },
  });

  revalidatePath("/templates");
  return { success: true, id: data.id };
}

export async function updateTemplate(templateId: string, formData: FormData) {
  requireRole(await getCurrentAppUser(), "admin", "lead");

  const name = String(formData.get("name") ?? "").trim();
  const subjectTemplate = String(formData.get("subjectTemplate") ?? "").trim();
  const bodyHtml = String(formData.get("bodyHtml") ?? "").trim();
  const ccRaw = String(formData.get("ccEmails") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const attachmentPathsRaw = String(formData.get("fixedAttachmentPaths") ?? "").trim();

  if (!name || !subjectTemplate || !bodyHtml) {
    return { error: "Name, subject template, and body HTML are required." };
  }

  const ccEmails = ccRaw
    ? ccRaw.split("\n").map((s) => s.trim()).filter(Boolean)
    : [];
  const fixedAttachmentPaths = attachmentPathsRaw
    ? attachmentPathsRaw.split("\n").map((s) => s.trim()).filter(Boolean)
    : [];

  const admin = createAdminClient();
  const { error } = await admin
    .from("templates")
    .update({
      name,
      subject_template: subjectTemplate,
      body_html: bodyHtml,
      cc_emails: ccEmails,
      fixed_attachment_paths: fixedAttachmentPaths,
      description: description || null,
      notes: notes || null,
    })
    .eq("id", templateId);

  if (error) {
    return { error: error.message };
  }

  await logAudit({
    actorUserId: (await getCurrentAppUser())!.id,
    entityType: "templates",
    entityId: templateId,
    action: "update",
    metadata: { name },
  });

  revalidatePath("/templates");
  return { success: true };
}

export async function toggleTemplateActive(
  templateId: string,
  isActive: boolean,
  _formData: FormData,
) {
  requireRole(await getCurrentAppUser(), "admin");

  const admin = createAdminClient();
  const { error } = await admin
    .from("templates")
    .update({ is_active: isActive })
    .eq("id", templateId);

  if (!error) {
    await logAudit({
      actorUserId: (await getCurrentAppUser())!.id,
      entityType: "templates",
      entityId: templateId,
      action: isActive ? "activate" : "deactivate",
      metadata: {},
    });
  }

  revalidatePath("/templates");
}

export async function uploadTemplateAttachment(templateId: string, formData: FormData) {
  const user = requireRole(await getCurrentAppUser(), "admin", "lead");

  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) {
    return { error: "No file selected." };
  }

  const path = `${templateId}/${file.name}`;
  const admin = createAdminClient();

  const { error: uploadError } = await admin.storage
    .from(ATTACHMENT_BUCKET)
    .upload(path, file, { upsert: true });

  if (uploadError) {
    return { error: uploadError.message };
  }

  // Get current paths and append the new one
  const { data: tpl } = await admin
    .from("templates")
    .select("fixed_attachment_paths")
    .eq("id", templateId)
    .single();

  const current = (tpl?.fixed_attachment_paths ?? []) as string[];
  if (!current.includes(path)) {
    await admin
      .from("templates")
      .update({ fixed_attachment_paths: [...current, path] })
      .eq("id", templateId);
  }

  await logAudit({
    actorUserId: user.id,
    entityType: "templates",
    entityId: templateId,
    action: "upload_attachment",
    metadata: { fileName: file.name, path },
  });

  revalidatePath("/templates");
  return { success: true, fileName: file.name };
}

export async function deleteTemplateAttachment(templateId: string, path: string) {
  const user = requireRole(await getCurrentAppUser(), "admin");

  const admin = createAdminClient();

  await admin.storage.from(ATTACHMENT_BUCKET).remove([path]);

  const { data: tpl } = await admin
    .from("templates")
    .select("fixed_attachment_paths")
    .eq("id", templateId)
    .single();

  const current = (tpl?.fixed_attachment_paths ?? []) as string[];
  await admin
    .from("templates")
    .update({
      fixed_attachment_paths: current.filter((p: string) => p !== path),
    })
    .eq("id", templateId);

  await logAudit({
    actorUserId: user.id,
    entityType: "templates",
    entityId: templateId,
    action: "delete_attachment",
    metadata: { path },
  });

  revalidatePath("/templates");
}
