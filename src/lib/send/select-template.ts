import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Auto-send pipeline (NFBRK-first): one shared mapping from an item's
 * AI-confirmed clearance type to the email template that should be sent.
 * Both NFBRK and FEBRK route through this, so the engine is dual-ready by
 * construction — only DO payment tracking is gated to NFBRK downstream.
 */

// clearance_type (from AI confirmation / master data / sheet) -> templates.type
const PRE_ALERT_TEMPLATE_BY_CLEARANCE: Record<string, string> = {
  nfbrk: "nfbrk",
  "febrk-jeena": "febrk-jeena",
  "febrk-sunimpex": "febrk-sunimpex",
};

const PHASE_FALLBACK: Record<string, string> = {
  pre_alert: "nfbrk",
  post_arrival: "cargo_arrival_notice",
  tp_hold: "hold",
};

export interface TemplateChoice {
  templateId: string;
  templateType: string;
}

/** Pick the templates.type for a confirmed clearance path + batch phase. */
export function pickTemplateType(
  clearanceType: string | null,
  phase: string,
): string {
  if (clearanceType) {
    const mapped = PRE_ALERT_TEMPLATE_BY_CLEARANCE[clearanceType];
    if (mapped) return mapped;
    // Known clearance types without a dedicated template (generic 'febrk'
    // with unresolved broker, 'calling', 'hold') must NOT silently fall back
    // to the NFBRK email — those need human handling.
    if (["febrk", "calling", "hold"].includes(clearanceType)) {
      return "";
    }
  }
  return PHASE_FALLBACK[phase] ?? "nfbrk";
}

export async function fetchTemplateByType(
  type: string,
): Promise<{ id: string; type: string } | null> {
  if (!type) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("templates")
    .select("id, type")
    .eq("type", type)
    .eq("is_active", true)
    .maybeSingle();
  return data;
}

/**
 * Resolve the template id to attach to an item given its confirmed
 * clearance type + phase. Returns null if no matching active template
 * (e.g. unresolved generic 'febrk', or the phase default is missing).
 */
export async function resolveTemplateIdForItem(input: {
  clearanceType: string | null;
  phase: string;
}): Promise<TemplateChoice | null> {
  const type = pickTemplateType(input.clearanceType, input.phase);
  if (!type) return null;
  const template = await fetchTemplateByType(type);
  if (!template) return null;
  return { templateId: template.id, templateType: template.type };
}
