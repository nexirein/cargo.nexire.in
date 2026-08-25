import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AppConfig, AutoSendPattern } from "@/lib/ai/types";

const DEFAULT_CONFIG: AppConfig = {
  aiEnabled: true,
  autoSendEnabled: false,
  followupEnabled: true,
  callAiEnabled: true,
  classifierVersion: "v1.0.0",
  draftHoldMinThreshold: 0.8,
  vipDomains: [],
  vipSenders: [],
  legalKeywords: ["attorney", "lawsuit", "compliance", "legal notice", "litigation", "regulatory"],
  autoSendPatterns: [],
  autoSendRoutineEnabled: true,
  autoSendRoutineMinConfidence: 0.8,
};

let cachedConfig: AppConfig | null = null;
let lastFetchAt = 0;
const CACHE_TTL_MS = 60_000;

function parseJsonArray(val: unknown): string[] {
  if (Array.isArray(val)) return val.map(String);
  return [];
}

function parseJsonNumber(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const n = parseFloat(val);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

function parsePatterns(val: unknown): AutoSendPattern[] {
  if (Array.isArray(val)) return val as AutoSendPattern[];
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed as AutoSendPattern[];
    } catch { /* ignore */ }
  }
  return [];
}

function parseJsonBoolean(val: unknown): boolean {
  if (typeof val === "boolean") return val;
  if (typeof val === "string") return val === "true";
  return false;
}

export async function getAppConfig(forceRefresh = false): Promise<AppConfig> {
  const now = Date.now();
  if (!forceRefresh && cachedConfig && now - lastFetchAt < CACHE_TTL_MS) {
    return cachedConfig;
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.from("app_config").select("key, value");

    if (error || !data) {
      console.warn("[ai/config] Failed to fetch app_config:", error?.message);
      return DEFAULT_CONFIG;
    }

    const map = new Map<string, unknown>();
    for (const row of data) {
      map.set(row.key, row.value);
    }

    cachedConfig = {
      aiEnabled: parseJsonBoolean(map.get("ai_enabled") ?? DEFAULT_CONFIG.aiEnabled),
      autoSendEnabled: parseJsonBoolean(map.get("auto_send_enabled") ?? DEFAULT_CONFIG.autoSendEnabled),
      followupEnabled: parseJsonBoolean(map.get("followup_enabled") ?? DEFAULT_CONFIG.followupEnabled),
      callAiEnabled: parseJsonBoolean(map.get("call_ai_enabled") ?? DEFAULT_CONFIG.callAiEnabled),
      classifierVersion: String(map.get("classifier_version") ?? DEFAULT_CONFIG.classifierVersion),
      draftHoldMinThreshold: parseJsonNumber(map.get("draft_hold_min_threshold") ?? DEFAULT_CONFIG.draftHoldMinThreshold),
      vipDomains: parseJsonArray(map.get("vip_domains") ?? DEFAULT_CONFIG.vipDomains),
      vipSenders: parseJsonArray(map.get("vip_senders") ?? DEFAULT_CONFIG.vipSenders),
      legalKeywords: parseJsonArray(map.get("legal_keywords") ?? DEFAULT_CONFIG.legalKeywords),
      autoSendPatterns: parsePatterns(map.get("auto_send_patterns") ?? DEFAULT_CONFIG.autoSendPatterns),
      autoSendRoutineEnabled: parseJsonBoolean(map.get("auto_send_routine_enabled") ?? DEFAULT_CONFIG.autoSendRoutineEnabled),
      autoSendRoutineMinConfidence: parseJsonNumber(map.get("auto_send_routine_min_confidence") ?? DEFAULT_CONFIG.autoSendRoutineMinConfidence),
    };

    lastFetchAt = now;
    return cachedConfig;
  } catch (err) {
    console.warn("[ai/config] Exception fetching app_config:", err);
    return DEFAULT_CONFIG;
  }
}

export function getCachedConfig(): AppConfig | null {
  return cachedConfig;
}
