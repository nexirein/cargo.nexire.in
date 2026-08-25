import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendMailViaSmtp } from "@/lib/email/smtp";
import { checkDraftApproval } from "@/lib/ai/safety";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") ?? "pending";
    const limit = parseInt(searchParams.get("limit") ?? "50");

    const admin = createAdminClient();
    const { data, error } = await admin
      .from("ai_drafts")
      .select(`
        id, case_id, email_event_id, trigger_type, trigger_reason,
        subject, body_html, body_text, confidence, flags, status, created_at
      `)
      .eq("status", status)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: countRows, error: countError } = await admin
      .from("ai_drafts")
      .select("status");

    if (countError) {
      return NextResponse.json({ error: countError.message }, { status: 500 });
    }

    const counts: Record<string, number> = {
      pending: 0,
      edited: 0,
      approved: 0,
      rejected: 0,
      sent: 0,
    };
    for (const row of countRows ?? []) {
      if (row.status in counts) counts[row.status] += 1;
    }

    const enriched = await Promise.all(
      (data ?? []).map(async (draft) => {
        let senderEmail = null;
        let inboundSubject = null;
        let inboundBody = null;
        let receivedAt = null;
        if (draft.email_event_id) {
          const { data: ev } = await admin
            .from("email_events")
            .select("sender_email, subject, body_clean, received_at")
            .eq("id", draft.email_event_id)
            .maybeSingle();
          senderEmail = ev?.sender_email ?? null;
          inboundSubject = ev?.subject ?? null;
          inboundBody = ev?.body_clean ?? null;
          receivedAt = ev?.received_at ?? null;
        }

        let awb = null;
        let caseStatus = null;
        let consigneeEmail = null;
        if (draft.case_id) {
          const { data: c } = await admin
            .from("awb_cases")
            .select("awb, current_status")
            .eq("id", draft.case_id)
            .maybeSingle();
          awb = c?.awb ?? null;
          caseStatus = c?.current_status ?? null;
        }
        if (!senderEmail && awb) {
          const { data: item } = await admin
            .from("batch_items")
            .select("consignee_email")
            .eq("awb", awb)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          consigneeEmail = item?.consignee_email ?? null;
        }

        let classification = null;
        if (draft.email_event_id) {
          const { data: cls } = await admin
            .from("ai_classifications")
            .select(
              "route, confidence, clearance_type, intent, urgency, explanation",
            )
            .eq("email_event_id", draft.email_event_id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          classification = cls ?? null;
        }

        return {
          ...draft,
          sender_email: senderEmail,
          consignee_email: consigneeEmail,
          inbound_subject: inboundSubject,
          inbound_body: inboundBody,
          inbound_received_at: receivedAt,
          awb,
          case_status: caseStatus,
          classification,
        };
      }),
    );

    return NextResponse.json({ drafts: enriched, counts });
  } catch (err) {
    console.error("[api/ai/drafts] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch drafts" },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { draftId, action, editedSubject, editedBody, reason } = body;

    if (!draftId || !action) {
      return NextResponse.json({ error: "draftId and action are required" }, { status: 400 });
    }

    if (!["approve", "reject", "edit"].includes(action)) {
      return NextResponse.json({ error: "action must be approve, reject, or edit" }, { status: 400 });
    }

    const admin = createAdminClient();
    const now = new Date().toISOString();

    const { data: draft, error: fetchError } = await admin
      .from("ai_drafts")
      .select("id, case_id, subject, body_html, status, email_event_id")
      .eq("id", draftId)
      .single();

    if (fetchError || !draft) {
      return NextResponse.json({ error: "Draft not found" }, { status: 404 });
    }

    if (draft.status === "sent") {
      return NextResponse.json({ error: "Draft already sent" }, { status: 400 });
    }

    const caseId = draft.case_id;
    const { data: caseData } = caseId
      ? await admin.from("awb_cases").select("awb").eq("id", caseId).maybeSingle()
      : { data: null };

    const { data: emailEvent } = draft.email_event_id
      ? await admin.from("email_events").select("sender_email, message_id, raw_payload").eq("id", draft.email_event_id).maybeSingle()
      : { data: null };

    // Recover CC recipients from the inbound email's raw_payload
    const inboundCc: string[] = emailEvent?.raw_payload?.cc ?? [];

    // Resolve the customer's email as robustly as possible: the inbound
    // email sender first, then the case's shipment consignee email.
    let recipient: string | null = emailEvent?.sender_email ?? null;
    if (!recipient && caseData?.awb) {
      const { data: item } = await admin
        .from("batch_items")
        .select("consignee_email")
        .eq("awb", caseData.awb)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      recipient = item?.consignee_email ?? null;
    }

    if (action === "reject") {
      await admin
        .from("ai_drafts")
        .update({ status: "rejected", rejection_reason: reason ?? "Rejected by operator", reviewed_at: now })
        .eq("id", draftId);

      if (reason && caseId) {
        await admin.from("correction_log").insert({
          case_id: caseId,
          field_name: "draft_rejection",
          corrected_value: reason,
          source_context: "draft_rejection",
        });
      }

      return NextResponse.json({ status: "rejected" });
    }

    if (action === "edit") {
      await admin
        .from("ai_drafts")
        .update({
          status: "edited",
          edited_subject: editedSubject ?? draft.subject,
          edited_body: editedBody ?? draft.body_html,
          reviewed_at: now,
        })
        .eq("id", draftId);

      return NextResponse.json({ status: "edited", message: "Saved as edited. Approve to send." });
    }

    if (action === "approve") {
      const subject = editedSubject ?? draft.subject;
      const bodyHtml = editedBody ?? draft.body_html;

      if (!recipient) {
        return NextResponse.json(
          {
            error:
              "No recipient found for this draft — the inbound email sender could not be resolved. Check the draft's email_event_id / case linkage.",
          },
          { status: 400 },
        );
      }

      const safetyCheck = checkDraftApproval("approved");
      if (!safetyCheck.passed) {
        return NextResponse.json({ error: safetyCheck.reason }, { status: 403 });
      }

      const result = await sendMailViaSmtp({
        to: [recipient],
        cc: inboundCc.length > 0 ? inboundCc : undefined,
        subject,
        htmlBody: bodyHtml,
        inReplyTo: emailEvent?.message_id ? emailEvent.message_id.replace(/[<>]/g, "") : undefined,
        references: emailEvent?.message_id ? [emailEvent.message_id.replace(/[<>]/g, "")] : undefined,
      });

      await admin
        .from("ai_drafts")
        .update({ status: "sent", reviewed_at: now, sent_at: now })
        .eq("id", draftId);

      await admin.from("email_events").insert({
        direction: "outbound",
        message_id: result.messageId?.replace(/[<>]/g, "").trim() ?? `draft-sent-${draftId}-${Date.now()}`,
        awb: caseData?.awb ?? null,
        subject,
        body_clean: bodyHtml.replace(/<[^>]*>/g, ""),
        sender_email: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "",
        recipient_emails: [recipient],
        in_reply_to: emailEvent?.message_id ? emailEvent.message_id.replace(/[<>]/g, "").trim() : null,
        raw_payload: { draftId, approved: true },
        received_at: now,
      });

      if (caseId) {
        await admin.from("case_updates").insert({
          case_id: caseId,
          updated_by: null,
          actor_type: "ai",
          update_type: "draft_approved_sent",
          remarks: `Draft approved and sent to ${recipient}`,
          new_values: { draft_id: draftId, smtp_message_id: result.messageId },
        });
      }

      return NextResponse.json({ status: "sent", messageId: result.messageId });
    }
  } catch (err) {
    console.error("[api/ai/drafts] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Draft operation failed" },
      { status: 500 },
    );
  }
}
