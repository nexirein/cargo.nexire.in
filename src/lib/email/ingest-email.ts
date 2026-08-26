import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractAwb } from "@/lib/email/awb-extract";
import { logAudit } from "@/lib/audit/log";
import { classify } from "@/lib/ai/classify";
import { generateDraft } from "@/lib/ai/draft";
import { checkSafety } from "@/lib/ai/safety";
import { getAppConfig } from "@/lib/ai/config";
import { getTriggerRuleForClearance, scheduleFollowUp } from "@/lib/ai/followup";
import { sendMailViaSmtp } from "@/lib/email/smtp";
import type { ClassificationResult } from "@/lib/ai/types";

export interface IngestInput {
  messageId: string;
  subject: string;
  from: string;
  to: string[];
  cc: string[];
  textBody: string;
  htmlBody?: string | null;
  receivedAt?: string;
  inReplyTo?: string | null;
  references?: string[];
}

export interface IngestResult {
  status: "ingested" | "duplicate" | "ignored";
  emailEventId: string | null;
  caseId: string | null;
  classification?: ClassificationResult;
  draftCreated?: boolean;
}

export async function ingestEmail(email: IngestInput): Promise<IngestResult> {
  const admin = createAdminClient();
  const normalizedId = email.messageId.replace(/[<>]/g, "").trim();

  // Ignore emails from our own system — the IMAP inbox may contain outbound
  // pre-alerts that were copied to INBOX. Processing them would create
  // spurious drafts and auto-replies to ourselves.
  const selfAddress = (process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "")
    .toLowerCase()
    .trim();
  if (selfAddress && email.from.toLowerCase().includes(selfAddress)) {
    return { status: "ignored", emailEventId: null, caseId: null };
  }

  const { data: existing } = await admin
    .from("email_events")
    .select("id")
    .eq("message_id", normalizedId)
    .maybeSingle();

  if (existing) {
    return { status: "duplicate", emailEventId: existing.id, caseId: null };
  }

  const searchText = [
    email.subject,
    email.textBody ?? "",
    email.htmlBody ? email.htmlBody.replace(/<[^>]*>/g, " ") : "",
  ].join(" ");
  const awb = extractAwb(searchText);

  // Strip quoted/reply thread from the body so the classifier only sees the
  // customer's actual message — not the pre-alert template or previous replies
  // which contain penalty amounts, dates, and other noise that inflates urgency.
  const rawBody = email.textBody || email.htmlBody || "";
  const customerMessage = stripQuotedText(rawBody);

  const { data: emailEvent, error: insertError } = await admin
    .from("email_events")
    .insert({
      direction: "inbound",
      message_id: normalizedId,
      awb,
      subject: email.subject,
      body_clean: email.textBody || email.htmlBody || "",
      sender_email: email.from,
      recipient_emails: [...new Set([...email.to, ...email.cc])],
      conversation_id: null,
      raw_payload: {
        ...email,
        inReplyTo: email.inReplyTo?.replace(/[<>]/g, "").trim() ?? null,
      },
      received_at: email.receivedAt ?? new Date().toISOString(),
    })
    .select("id, subject, sender_email, awb")
    .single();

  if (insertError) {
    console.error(`[ingest] insert failed: ${insertError.code} ${insertError.message} msgId=${normalizedId}`);
    return { status: "ignored", emailEventId: null, caseId: null };
  }

  if (!awb) {
    return { status: "ingested", emailEventId: emailEvent.id, caseId: null };
  }

  let caseId: string | null = null;
  const { data: existingCase } = await admin
    .from("awb_cases")
    .select("id, current_status, issue_type, urgency")
    .eq("awb", awb)
    .maybeSingle();

  const now = new Date().toISOString();

  if (existingCase) {
    caseId = existingCase.id;
    const changes: Record<string, unknown> = { last_human_action_at: now };
    if (existingCase.current_status === "awaiting_reply") {
      changes.current_status = "reply_received";
    }
    await admin.from("awb_cases").update(changes).eq("id", existingCase.id);
  } else {
    const { data: newCase } = await admin
      .from("awb_cases")
      .insert({
        awb,
        current_status: "reply_received",
        ownership_status: "unassigned",
      })
      .select("id")
      .single();

    if (newCase) caseId = newCase.id;
  }

  if (!caseId) {
    return { status: "ingested", emailEventId: emailEvent.id, caseId: null };
  }

  const safetyCheck = await checkSafety({
    subject: email.subject,
    body: email.textBody || email.htmlBody || "",
    sender: email.from,
    awb: awb ?? undefined,
  });

  if (!safetyCheck.passed) {
    await admin
      .from("awb_cases")
      .update({
        human_review_required: true,
        auto_classified: true,
        current_status: "human_review",
      })
      .eq("id", caseId);

    await admin.from("ai_classifications").insert({
      case_id: caseId,
      email_event_id: emailEvent.id,
      classifier_version: "ensemble-v1",
      model_used: "safety-gate",
      route: "human_review",
      human_review_required: true,
      confidence: 1.0,
      explanation: safetyCheck.reason ?? "Safety gate triggered",
    });

    await admin.from("case_updates").insert({
      case_id: caseId,
      updated_by: null,
      actor_type: "ai",
      update_type: "human_review_required",
      remarks: `Safety gate: ${safetyCheck.reason}`,
      new_values: { email_event_id: emailEvent.id, route: "human_review" },
    });

    return {
      status: "ingested",
      emailEventId: emailEvent.id,
      caseId,
    };
  }

  const classification = await classify({
    subject: email.subject,
    body: customerMessage,
    sender: email.from,
    awb: awb ?? undefined,
    emailEventId: emailEvent.id,
    caseId,
  });

  let draftCreated = false;

  if (classification.route === "ignore") {
    await admin.from("awb_cases").update({ auto_classified: true }).eq("id", caseId);
  } else if (classification.route === "human_review") {
    await admin
      .from("awb_cases")
      .update({
        issue_type: classification.clearanceType,
        urgency: classification.urgency,
        human_review_required: true,
        auto_classified: true,
        current_status: "human_review",
      })
      .eq("id", caseId);
  } else if (classification.route === "ai_draft_hold") {
    await admin
      .from("awb_cases")
      .update({
        issue_type: classification.clearanceType,
        urgency: classification.urgency,
        human_review_required: true,
        auto_classified: true,
        current_status: "reply_received",
      })
      .eq("id", caseId);

    const draft = await generateDraft({
      subject: email.subject,
      body: email.textBody || email.htmlBody || "",
      sender: email.from,
      awb: awb ?? undefined,
      clearanceType: classification.clearanceType,
      intent: classification.intent,
      urgency: classification.urgency,
    });

    if (draft) {
      const { data: draftRecord } = await admin
        .from("ai_drafts")
        .insert({
          case_id: caseId,
          email_event_id: emailEvent.id,
          trigger_type: "inbound_reply",
          trigger_reason: `${classification.clearanceType}_${classification.intent}`,
          subject: draft.subject,
          body_html: draft.bodyHtml,
          body_text: draft.bodyText,
          confidence: draft.confidence,
          flags: draft.flags,
          variables_used: draft.variablesUsed,
          template_id: draft.templateId ?? null,
          status: "pending",
        })
        .select("id")
        .single();

      draftCreated = true;

      await admin.from("case_updates").insert({
        case_id: caseId,
        updated_by: null,
        actor_type: "ai",
        update_type: "draft_created",
        remarks: `AI draft created (${classification.clearanceType}/${classification.intent}, conf: ${classification.confidence})`,
        new_values: { route: "ai_draft_hold", draft_id: draftRecord?.id ?? null },
      });
    }
  } else if (classification.route === "ai_auto_send") {
    const draft = await generateDraft({
      subject: email.subject,
      body: email.textBody || email.htmlBody || "",
      sender: email.from,
      awb: awb ?? undefined,
      clearanceType: classification.clearanceType,
      intent: classification.intent,
      urgency: classification.urgency,
    });

    if (draft && !draft.flags.includes("low_confidence_draft") && !draft.flags.includes("missing_variables")) {
      const sendResult = await sendMailViaSmtp({
        to: [email.from],
        cc: email.cc.length > 0 ? email.cc : undefined,
        subject: draft.subject,
        htmlBody: draft.bodyHtml,
        inReplyTo: normalizedId,
        references: [normalizedId],
      });

      await admin.from("email_events").insert({
        direction: "outbound",
        message_id: sendResult.messageId?.replace(/[<>]/g, "").trim() ?? `auto-send-${emailEvent.id}-${Date.now()}`,
        awb,
        subject: draft.subject,
        body_clean: draft.bodyText,
        sender_email: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "",
        recipient_emails: [email.from],
        raw_payload: { autoSend: true, route: "ai_auto_send", classification, inReplyTo: normalizedId },
        received_at: now,
      });

      await admin
        .from("awb_cases")
        .update({
          issue_type: classification.clearanceType,
          urgency: classification.urgency,
          auto_classified: true,
          auto_replied: true,
          auto_closed: false,
          human_review_required: false,
          current_status: "reply_sent",
        })
        .eq("id", caseId);

      await admin.from("case_updates").insert({
        case_id: caseId,
        updated_by: null,
        actor_type: "ai",
        update_type: "auto_reply_sent",
        remarks: `AI auto-sent: ${classification.clearanceType}/${classification.intent} (conf: ${classification.confidence})`,
        new_values: { route: "ai_auto_send", smtp_message_id: sendResult.messageId },
      });
    } else {
      // Auto-send was flagged but the draft isn't confident enough — fall back
      // to a reviewable draft instead of silently dropping the customer.
      if (draft) {
        try {
          await admin.from("ai_drafts").insert({
            case_id: caseId,
            email_event_id: emailEvent.id,
            trigger_type: "inbound_reply",
            trigger_reason: `${classification.clearanceType}_${classification.intent}`,
            subject: draft.subject,
            body_html: draft.bodyHtml,
            body_text: draft.bodyText,
            confidence: draft.confidence,
            flags: draft.flags,
            variables_used: draft.variablesUsed,
            template_id: draft.templateId ?? null,
            status: "pending",
          });
        } catch (err) {
          // ai_drafts may not exist yet (migrations pending) — never let a
          // reviewable-draft write break the ingest request.
          console.warn("[ingest-email] Could not persist ai_draft:", err);
        }
      }
      await admin
        .from("awb_cases")
        .update({
          issue_type: classification.clearanceType,
          urgency: classification.urgency,
          human_review_required: true,
          auto_classified: true,
          current_status: "reply_received",
        })
        .eq("id", caseId);
    }
  }

  await admin.rpc("increment_case_counter", {
    p_case_id: caseId,
    p_column: "ai_actions_count",
  });

  await admin.from("case_updates").insert({
    case_id: caseId,
    updated_by: null,
    actor_type: "ai",
    update_type: "reply_received",
    remarks: `Reply from ${email.from}: ${email.subject}`,
    new_values: { email_event_id: emailEvent.id },
  });

  await logAudit({
    actorUserId: null,
    entityType: "awb_cases",
    entityId: caseId,
    action: "reply_ingested",
    metadata: { awb, emailEventId: emailEvent.id, from: email.from, route: classification.route },
  });

  return {
    status: "ingested",
    emailEventId: emailEvent.id,
    caseId,
    classification,
    draftCreated,
  };
}

/**
 * Strip quoted/reply text from an email body so the classifier only sees the
 * customer's actual message. Removes:
 * - Lines starting with ">" (quoted reply markers)
 * - "On [date], [name] wrote:" patterns (Gmail/Outlook reply headers)
 * - "-----Original Message-----" separators (Outlook)
 * - Everything after these markers
 */
function stripQuotedText(body: string): string {
  if (!body) return "";

  const lines = body.split("\n");
  const cleaned: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    // Stop at reply/quote markers
    if (/^On\s+\w+,\s+\w+\s+\d+.*wrote:$/i.test(trimmed)) break;
    if (/^from:\s*/i.test(trimmed)) break;
    if (/^-{3,}\s*original message\s*-{3,}$/i.test(trimmed)) break;
    if (/^-{3,}\s*forwarded message\s*-{3,}$/i.test(trimmed)) break;

    // Skip quoted lines
    if (trimmed.startsWith(">")) continue;

    cleaned.push(line);
  }

  return cleaned.join("\n").trim();
}
