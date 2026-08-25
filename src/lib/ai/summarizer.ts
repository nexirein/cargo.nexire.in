import "server-only";
import { geminiChat } from "@/lib/ai/gemini";

export interface CallSummaryInput {
  rawNotes: string;
  awb?: string;
  consigneeName?: string;
}

export interface CallSummaryResult {
  company: string;
  contact: string;
  purpose: string;
  keyPoints: string[];
  followUp: string;
  actionItems: Array<{
    action: string;
    scheduledFor: string;
    priority: "low" | "normal" | "high";
  }>;
  urgency: "low" | "normal" | "high" | "critical";
}

export async function summarizeCall(input: CallSummaryInput): Promise<CallSummaryResult | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  try {
    const content = await geminiChat({
      system: `You summarize FedEx operations call notes into structured JSON.
Extract: company name, contact person, call purpose, key points, follow-up actions, urgency.
Return valid JSON only.`,
      prompt: `Summarize these call notes:\n\n${input.rawNotes}\n\nAWB: ${input.awb ?? "N/A"}\nConsignee: ${input.consigneeName ?? "N/A"}`,
      temperature: 0.2,
      jsonMode: true,
    });
    if (!content) return null;

    return JSON.parse(content) as CallSummaryResult;
  } catch (err) {
    console.warn("[ai/summarizer] Call summarization failed:", err);
    return null;
  }
}

export function extractActionItems(summary: CallSummaryResult): Array<{
  action: string;
  scheduledHours: number;
  priority: "low" | "normal" | "high";
}> {
  const items: Array<{ action: string; scheduledHours: number; priority: "low" | "normal" | "high" }> = [];

  for (const item of summary.actionItems) {
    let hours = 24;
    const text = item.action.toLowerCase();

    if (text.includes("urgent") || text.includes("asap") || text.includes("immediately")) {
      hours = 2;
    } else if (text.includes("today") || text.includes("eod")) {
      hours = 4;
    } else if (text.includes("tomorrow")) {
      hours = 24;
    } else if (text.includes("week")) {
      hours = 72;
    }

    items.push({ action: item.action, scheduledHours: hours, priority: item.priority });
  }

  return items;
}
