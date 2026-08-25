import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface ThreadSuggestion {
  caseId: string;
  awb: string;
  subject: string;
  lastActiveAt: string;
  emailCount: number;
  matchType: "awb" | "consignee" | "broker" | "do_number";
  matchConfidence: number;
}

export interface ThreadLinkInput {
  awb?: string;
  consigneeName?: string;
  broker?: string;
  doNumber?: string;
}

export async function findMatchingThreads(input: ThreadLinkInput): Promise<ThreadSuggestion[]> {
  const supabase = createAdminClient();
  const suggestions: ThreadSuggestion[] = [];
  const seenCaseIds = new Set<string>();

  if (input.awb) {
    const { data } = await supabase
      .from("awb_cases")
      .select("id, awb, created_at")
      .eq("awb", input.awb)
      .neq("current_status", "closed")
      .order("created_at", { ascending: false })
      .limit(3);

    if (data) {
      for (const row of data) {
        if (!seenCaseIds.has(row.id)) {
          seenCaseIds.add(row.id);
          suggestions.push({
            caseId: row.id,
            awb: row.awb ?? input.awb,
            subject: `AWB ${row.awb}`,
            lastActiveAt: row.created_at,
            emailCount: 1,
            matchType: "awb",
            matchConfidence: 1.0,
          });
        }
      }
    }
  }

  return suggestions;
}

export async function linkCallToThread(
  callTaskId: string,
  caseId: string,
): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("call_tasks")
      .update({ case_id: caseId })
      .eq("id", callTaskId);

    if (error) {
      console.warn("[ai/thread-linker] Failed to link call to thread:", error.message);
      return false;
    }

    return true;
  } catch (err) {
    console.warn("[ai/thread-linker] Error linking call:", err);
    return false;
  }
}
