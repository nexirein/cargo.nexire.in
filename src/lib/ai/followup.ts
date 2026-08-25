import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { geminiChat } from "@/lib/ai/gemini";
import type { FollowUpInput, FollowUpResult, TriggerRule, ClearanceType } from "@/lib/ai/types";

const TRIGGER_TEMPLATES: Record<TriggerRule, { delayHours: number; maxAttempts: number; subject: string }> = {
  nfbrk_24h: { delayHours: 24, maxAttempts: 3, subject: "Gentle Reminder — Documents for AWB {awb}" },
  febrk_48h: { delayHours: 48, maxAttempts: 5, subject: "Escalation — Broker Confirmation AWB {awb}" },
  calling_4h: { delayHours: 4, maxAttempts: 3, subject: "Callback Reminder — AWB {awb}" },
  hold_daily: { delayHours: 24, maxAttempts: 999, subject: "Status Check — AWB {awb} on Hold" },
  inactive_7d: { delayHours: 168, maxAttempts: 2, subject: "Check-In — AWB {awb}" },
  escalation_2h: { delayHours: 2, maxAttempts: 3, subject: "URGENT — Escalation Pending AWB {awb}" },
};

export async function scheduleFollowUp(input: FollowUpInput): Promise<void> {
  const template = TRIGGER_TEMPLATES[input.triggerRule];
  if (!template) throw new Error(`Unknown trigger rule: ${input.triggerRule}`);

  const scheduledAt = new Date(Date.now() + template.delayHours * 60 * 60 * 1000);

  try {
    const supabase = createAdminClient();
    await supabase.from("followup_schedules").insert({
      case_id: input.caseId,
      awb: input.awb,
      clearance_type: input.clearanceType,
      trigger_rule: input.triggerRule,
      scheduled_at: scheduledAt.toISOString(),
      attempt_number: input.attemptNumber,
      max_attempts: template.maxAttempts,
      status: "scheduled",
    });
  } catch (err) {
    console.warn("[ai/followup] Failed to schedule follow-up:", err);
  }
}

export async function generateFollowUpDraft(input: FollowUpInput): Promise<FollowUpResult> {
  const template = TRIGGER_TEMPLATES[input.triggerRule];
  const scheduledAt = new Date(Date.now());

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return {
      subject: template.subject.replace("{awb}", input.awb),
      bodyHtml: `<p>Follow-up for AWB ${input.awb} (${input.triggerRule}, attempt ${input.attemptNumber}/${input.maxAttempts}).</p>`,
      bodyText: `Follow-up for AWB ${input.awb} (${input.triggerRule}, attempt ${input.attemptNumber}/${input.maxAttempts}).`,
      scheduledAt,
      attemptNumber: input.attemptNumber,
      confidence: 0.5,
    };
  }

  try {
    const content = await geminiChat({
      system: "You are a FedEx cargo pre-alert operations specialist. Write a professional, concise follow-up email. Return JSON with subject, body_html, body_text.",
      prompt: getPromptForRule(input),
      temperature: 0.3,
      jsonMode: true,
    });

    if (content) {
      const parsed = JSON.parse(content);
      return {
        subject: parsed.subject ?? template.subject.replace("{awb}", input.awb),
        bodyHtml: parsed.body_html ?? "",
        bodyText: parsed.body_text ?? "",
        scheduledAt,
        attemptNumber: input.attemptNumber,
        confidence: parsed.confidence ?? 0.8,
      };
    }
  } catch (err) {
    console.warn("[ai/followup] Draft generation failed:", err);
  }

  return {
    subject: template.subject.replace("{awb}", input.awb),
    bodyHtml: `<p>Follow-up for AWB ${input.awb} (${input.triggerRule}, attempt ${input.attemptNumber}/${input.maxAttempts}).</p>`,
    bodyText: `Follow-up for AWB ${input.awb} (${input.triggerRule}, attempt ${input.attemptNumber}/${input.maxAttempts}).`,
    scheduledAt,
    attemptNumber: input.attemptNumber,
    confidence: 0.5,
  };
}

function getPromptForRule(input: FollowUpInput): string {
  const base = `AWB: ${input.awb}\nClearance Type: ${input.clearanceType}\nAttempt: ${input.attemptNumber}/${input.maxAttempts}`;

  switch (input.triggerRule) {
    case "nfbrk_24h":
      return `Generate a gentle reminder for AWB ${input.awb} regarding pending clearance documents.\n\n${base}\n\nTone: polite, gentle. Mention that documents are still pending.`;
    case "febrk_48h":
      return `Generate a broker confirmation escalation for AWB ${input.awb}.\n\n${base}\n\nTone: professional, firm. Broker confirmation is overdue. CC ops team.`;
    case "calling_4h":
      return `Generate a callback reminder for AWB ${input.awb}.\n\n${base}\n\nThe customer was expecting a callback. Remind the operator to follow up.`;
    case "hold_daily":
      return `Generate a daily status check for AWB ${input.awb}.\n\n${base}\n\nAsk if the hold can be resolved or if escalation is needed.`;
    case "inactive_7d":
      return `Generate a check-in email for AWB ${input.awb}.\n\n${base}\n\nAsk if there are any updates. If no response, suggest closure.`;
    case "escalation_2h":
      return `Generate an urgent escalation notification for AWB ${input.awb}.\n\n${base}\n\nThis is URGENT. No action taken on escalation. Notify supervisor.`;
  }
}

export async function processDueFollowUps(): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { data: dueItems, error } = await supabase
      .from("followup_schedules")
      .select("id, case_id, awb, clearance_type, trigger_rule, attempt_number, max_attempts")
      .eq("status", "scheduled")
      .lte("scheduled_at", new Date().toISOString())
      .limit(20);

    if (error || !dueItems) {
      console.warn("[ai/followup] Failed to fetch due follow-ups:", error?.message);
      return;
    }

    for (const item of dueItems) {
      try {
        const followUpInput: FollowUpInput = {
          caseId: item.case_id,
          awb: item.awb,
          clearanceType: item.clearance_type as ClearanceType,
          triggerRule: item.trigger_rule as TriggerRule,
          attemptNumber: item.attempt_number ?? 1,
          maxAttempts: item.max_attempts ?? 3,
        };

        await supabase
          .from("followup_schedules")
          .update({ status: "draft_ready" })
          .eq("id", item.id);
      } catch (err) {
        console.warn(`[ai/followup] Failed to process follow-up ${item.id}:`, err);
      }
    }
  } catch (err) {
    console.warn("[ai/followup] Error in processDueFollowUps:", err);
  }
}

export function getTriggerRuleForClearance(clearanceType: ClearanceType): TriggerRule | null {
  switch (clearanceType) {
    case "nfbrk": return "nfbrk_24h";
    case "febrk": case "febrk-sunimpex": case "febrk-jeena": return "febrk_48h";
    case "calling": return "calling_4h";
    case "hold": return "hold_daily";
  }
}
