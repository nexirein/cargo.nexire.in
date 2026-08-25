import "server-only";
import { embedText } from "@/lib/ai/embed";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ClearanceType, Intent, RAGContext } from "@/lib/ai/types";

const MAX_RETRIEVAL_EMAILS = 5;
const SIMILARITY_THRESHOLD = 0.75;

export async function retrieveContext(
  subject: string,
  body: string,
  clearanceType?: ClearanceType,
  intent?: Intent,
): Promise<RAGContext> {
  const supabase = createAdminClient();
  const combinedText = subject + " " + body;

  let embedding: number[] | null = null;
  try {
    embedding = await embedText(combinedText);
  } catch (err) {
    console.warn("[ai/rag] Embedding failed, skipping vector search:", err);
  }

  const similarEmails: RAGContext["similarEmails"] = [];

  if (embedding) {
    try {
      const { data, error } = await supabase.rpc("match_similar_emails", {
        query_embedding: embedding,
        match_threshold: SIMILARITY_THRESHOLD,
        match_count: MAX_RETRIEVAL_EMAILS,
        filter_clearance_type: clearanceType ?? null,
        filter_intent: intent ?? null,
      });

      if (!error && data) {
        for (const row of data) {
          similarEmails.push({
            id: row.id,
            subject: row.subject ?? "",
            bodyClean: row.body_clean ?? "",
            actualReply: row.actual_reply ?? "",
            similarity: row.similarity ?? 0,
          });
        }
      }
    } catch (err) {
      console.warn("[ai/rag] Similar email retrieval failed:", err);
    }
  }

  let bestTemplate: RAGContext["bestTemplate"] = null;
  try {
    let query = supabase
      .from("templates")
      .select("id, subject_template, body_html, variables, type")
      .eq("is_active", true);

    if (clearanceType) {
      query = query.eq("type", clearanceType);
    }

    const { data, error } = await query.order("version", { ascending: false }).limit(1);

    if (!error && data && data.length > 0) {
      const tpl = data[0];
      bestTemplate = {
        id: tpl.id,
        subjectTemplate: tpl.subject_template,
        bodyTemplate: tpl.body_html,
        variables: tpl.variables ?? [],
      };
    }
  } catch (err) {
    console.warn("[ai/rag] Template retrieval failed:", err);
  }

  return {
    similarEmails,
    bestTemplate,
    currentCase: {
      clearanceType,
      intent,
    },
  };
}
