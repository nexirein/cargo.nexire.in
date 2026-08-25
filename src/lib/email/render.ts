import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TemplateRow } from "./render-shared";

export type { RenderVariables, RenderedTemplate } from "./render-shared";
export { buildRenderVariables, renderTemplate } from "./render-shared";

export async function fetchTemplateById(
  templateId: string,
): Promise<TemplateRow | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("templates")
    .select("*")
    .eq("id", templateId)
    .single();
  return data;
}

export async function fetchAllTemplates(): Promise<TemplateRow[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("templates")
    .select("*")
    .eq("is_active", true)
    .order("name");
  return data ?? [];
}
