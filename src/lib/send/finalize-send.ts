import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/log";
import { getTriggerRuleForClearance, scheduleFollowUp } from "@/lib/ai/followup";

type AdminClient = ReturnType<typeof createAdminClient>;

export interface BatchItemRef {
  id: string;
  batch_run_id: string;
  sub_batch_id: string | null;
  awb: string;
  clearance_type?: string | null;
  shipment_data?: Record<string, unknown> | null;
}

export interface SendSuccessInfo {
  subject: string;
  html: string;
  senderMailbox: string;
  recipientEmails: string[];
  /** Transport-specific identifiers, all optional — Power Automate has no
   * Graph-equivalent conversation/internet-message id, so these stay
   * nullable in `email_events` regardless of which driver sent the mail. */
  messageId?: string | null;
  internetMessageId?: string | null;
  conversationId?: string | null;
}

/**
 * Shared success finalization, used by both the synchronous Graph path
 * (process-send-job.ts) and the async Power Automate callback route —
 * one place that updates `batch_items`, writes `email_events`, upserts
 * the M5 `awb_cases` seam, bumps counters, and logs the audit trail.
 */
export async function finalizeSendSuccess(
  admin: AdminClient,
  item: BatchItemRef,
  info: SendSuccessInfo,
  phase: string = "pre_alert",
): Promise<void> {
  const now = new Date().toISOString();

  await admin
    .from("batch_items")
    .update({ send_status: "sent", send_completed_at: now })
    .eq("id", item.id);

  if (phase !== "tp_hold") {
    await admin.from("email_events").insert({
      batch_run_id: item.batch_run_id,
      batch_item_id: item.id,
      sub_batch_id: item.sub_batch_id,
      awb: item.awb,
      direction: "outbound",
      message_id: info.messageId ?? null,
      internet_message_id: info.internetMessageId ?? null,
      conversation_id: info.conversationId ?? null,
      subject: info.subject,
      body_clean: info.html,
      sender_email: info.senderMailbox,
      recipient_emails: info.recipientEmails,
      sent_at: now,
    });
  }

  if (phase === "post_arrival") {
    const postData = item.shipment_data ?? {};

    const { data: existing } = await admin
      .from("awb_cases")
      .select("id, shipment_phase")
      .eq("awb", item.awb)
      .maybeSingle();

    if (existing) {
      const existingPhases: string[] = existing.shipment_phase ?? ["pre_alert"];
      if (!existingPhases.includes("post_arrival")) {
        existingPhases.push("post_arrival");
      }

      const updatePayload: Record<string, unknown> = {
        latest_batch_run_id: item.batch_run_id,
        shipment_phase: existingPhases,
        pre_alert_type: "post_arrival",
      };
      if (postData.mawb) updatePayload.mawb = String(postData.mawb);
      if (postData.igm) updatePayload.igm_number = String(postData.igm);
      if (postData.igmDate) updatePayload.igm_date = String(postData.igmDate);
      if (postData.flight) updatePayload.flight_number = String(postData.flight);
      if (postData.origin) updatePayload.origin_port = String(postData.origin);
      if (postData.dest) updatePayload.dest_port = String(postData.dest);
      if (postData.hsn) updatePayload.hsn_code = String(postData.hsn);
      if (postData.invoiceValue) updatePayload.invoice_value = Number(postData.invoiceValue);
      if (item.clearance_type) updatePayload.clearance_type = item.clearance_type;

      await admin.from("awb_cases").update(updatePayload).eq("id", existing.id);
    }
  } else if (phase === "tp_hold") {
    const holdData = item.shipment_data ?? {};
    const updatePayload: Record<string, unknown> = {
      tp_hold_reason: holdData.tpReason ?? holdData.reason ?? holdData.remarks ?? null,
      tp_hold_status: holdData.tpStatus ?? null,
      tp_hold_arrival_source: holdData.tpArrivalSource ?? null,
      tp_hold_updated_at: now,
    };
    await admin
      .from("awb_cases")
      .update(updatePayload)
      .eq("awb", item.awb);
  } else if (phase === "pre_alert") {
    const preAlertType = (
      await admin
        .from("batch_runs")
        .select("pre_alert_type")
        .eq("id", item.batch_run_id)
        .single()
    )?.data?.pre_alert_type ?? "u_bond";

    if (preAlertType === "consol") {
      // Consol: update existing case with consol phase tracking
      const { data: existing } = await admin
        .from("awb_cases")
        .select("id, shipment_phase")
        .eq("awb", item.awb)
        .maybeSingle();

      if (existing) {
        const phases: string[] = existing.shipment_phase ?? ["pre_alert"];
        if (!phases.includes("consol")) {
          phases.push("consol");
        }
        await admin
          .from("awb_cases")
          .update({
            latest_batch_run_id: item.batch_run_id,
            shipment_phase: phases,
            pre_alert_type: "consol",
          })
          .eq("id", existing.id);
      } else {
        // Fallback: create case if somehow missing
        await admin.from("awb_cases").upsert(
          {
            awb: item.awb,
            latest_batch_run_id: item.batch_run_id,
            current_status: "awaiting_reply",
            shipment_phase: ["consol"],
            pre_alert_type: "consol",
          },
          { onConflict: "awb" },
        );
      }
    } else {
      // M5 seam for uBond
      const casePayload: Record<string, unknown> = {
        awb: item.awb,
        latest_batch_run_id: item.batch_run_id,
        current_status: "awaiting_reply",
        pre_alert_type: "u_bond",
        shipment_phase: ["pre_alert"],
      };
      if (item.clearance_type) {
        casePayload.clearance_type = item.clearance_type;
        if (item.clearance_type === "calling") {
          casePayload.call_required = true;
        }
      }
      await admin.from("awb_cases").upsert(
        casePayload,
        { onConflict: "awb" },
      );
    }
  }

  await Promise.all([
    item.sub_batch_id
      ? admin.rpc("increment_sub_batch_counter", {
          p_sub_batch_id: item.sub_batch_id,
          p_column: "sent_count",
        })
      : Promise.resolve(),
    admin.rpc("increment_batch_run_counter", {
      p_batch_run_id: item.batch_run_id,
      p_column: "sent_count",
    }),
  ]);

  // Schedule follow-up based on clearance type (NFBRK @24h, FEBRK @48h, etc.)
  if (item.clearance_type && phase !== "tp_hold") {
    const triggerRule = getTriggerRuleForClearance(item.clearance_type as any);
    if (triggerRule) {
      const { data: awbCase } = await admin
        .from("awb_cases")
        .select("id")
        .eq("awb", item.awb)
        .maybeSingle();

      await scheduleFollowUp({
        caseId: awbCase?.id ?? null,
        awb: item.awb,
        clearanceType: item.clearance_type as any,
        triggerRule,
        attemptNumber: 1,
        maxAttempts: triggerRule === "hold_daily" ? 999 : triggerRule === "febrk_48h" ? 5 : 3,
      }).catch(() => {});
    }
  }

  await logAudit({
    actorUserId: null,
    entityType: "batch_items",
    entityId: item.id,
    action: "sent",
    metadata: { awb: item.awb, phase },
  });
}

export interface FailItem {
  id: string;
  batch_run_id: string;
  sub_batch_id: string | null;
  awb: string;
}

/**
 * Shared terminal-failure finalization (attempts exhausted, or a
 * transport reported a non-retryable failure). Does not touch
 * `attempt_count` unless a value is passed — the caller decides whether
 * this failure counts toward the retry budget.
 */
export async function finalizeSendFailure(
  admin: AdminClient,
  item: FailItem,
  reason: string,
  attemptCount?: number,
): Promise<void> {
  await admin
    .from("batch_items")
    .update({
      send_status: "failed",
      failure_reason: reason,
      ...(attemptCount !== undefined ? { attempt_count: attemptCount } : {}),
    })
    .eq("id", item.id);

  await Promise.all([
    item.sub_batch_id
      ? admin.rpc("increment_sub_batch_counter", {
          p_sub_batch_id: item.sub_batch_id,
          p_column: "failed_count",
        })
      : Promise.resolve(),
    admin.rpc("increment_batch_run_counter", {
      p_batch_run_id: item.batch_run_id,
      p_column: "failed_count",
    }),
  ]);

  await logAudit({
    actorUserId: null,
    entityType: "batch_items",
    entityId: item.id,
    action: "send_failed",
    metadata: { awb: item.awb, reason },
  });
}
