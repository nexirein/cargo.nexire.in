import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { acquireLock, releaseLock } from "@/lib/redis/locks";
import { sendMailViaGraph } from "@/lib/graph/send-mail";
import { sendMailViaSmtp } from "@/lib/email/smtp";
import {
  fetchTemplateById,
  buildRenderVariables,
  renderTemplate,
} from "@/lib/email/render";
import { resolveTemplateIdForItem } from "./select-template";
import { finalizeSendSuccess, finalizeSendFailure } from "./finalize-send";

export interface ProcessSendResult {
  status: "sent" | "already_sent" | "failed" | "retrying" | "processing";
  reason?: string;
}

function mailDriver(): "smtp" | "graph" {
  return (process.env.MAIL_DRIVER as "smtp" | "graph") ?? "smtp";
}

/**
 * The single implementation of "send one AWB's pre-alert," shared by the
 * local `inline` queue driver and the QStash-invoked webhook route — so
 * there is exactly one code path for the actual send logic regardless of
 * which queue driver dispatched it.
 *
 * MAIL_DRIVER=smtp uses the SMTP driver (Gmail App Password, any SMTP).
 * MAIL_DRIVER=graph uses Microsoft Graph API (needs Azure AD setup).
 */
export async function processSendJob(
  batchItemId: string,
): Promise<ProcessSendResult> {
  const admin = createAdminClient();

  const { data: item } = await admin
    .from("batch_items")
    .select(
      "id, batch_run_id, sub_batch_id, awb, consignee_name, consignee_email, shipment_data, template_id, clearance_type, send_status, attempt_count, max_attempts",
    )
    .eq("id", batchItemId)
    .single();

  if (!item) {
    return { status: "failed", reason: "Batch item not found." };
  }

  // Postgres is the idempotency source of truth (spec 14): a job that has
  // already succeeded — possibly via a duplicate/retried QStash delivery —
  // is a harmless no-op here, regardless of the Redis lock below.
  if (item.send_status === "sent" || item.send_status === "skipped") {
    return { status: "already_sent" };
  }

  const lockKey = `lock:send:${batchItemId}`;
  const gotLock = await acquireLock(lockKey, 30_000);
  if (!gotLock) {
    return {
      status: "retrying",
      reason: "Another worker is currently processing this item.",
    };
  }

  try {
    const { data: batchRun } = await admin
      .from("batch_runs")
      .select(
        "id, phase, pre_alert_type, mailbox_configs(operational_mailbox, tagged_mailbox, signature_html)",
      )
      .eq("id", item.batch_run_id)
      .single();

    const phase = batchRun?.phase ?? "pre_alert";
    const preAlertType = batchRun?.pre_alert_type ?? "u_bond";

    // Consol dedup: skip items already sent in a uBond batch
    if (phase === "pre_alert" && preAlertType === "consol") {
      const { data: existing } = await admin
        .from("batch_items")
        .select("id, batch_runs!inner(pre_alert_type)")
        .eq("awb", item.awb)
        .neq("batch_run_id", item.batch_run_id)
        .eq("send_status", "sent")
        .eq("batch_runs.phase", "pre_alert")
        .eq("batch_runs.pre_alert_type", "u_bond")
        .limit(1);

      if (existing && existing.length > 0) {
        await admin
          .from("batch_items")
          .update({ send_status: "skipped", send_completed_at: new Date().toISOString(), failure_reason: "Already sent in uBond batch" })
          .eq("id", item.id);
        return { status: "sent" };
      }
    }

    // TP Hold: no email sent, just update the case with hold info
    if (phase === "tp_hold") {
      await admin
        .from("batch_items")
        .update({ send_status: "sent", send_completed_at: new Date().toISOString() })
        .eq("id", item.id);

      const holdData = (item.shipment_data ?? {}) as Record<string, string>;
      await admin
        .from("awb_cases")
        .update({
          tp_hold_reason: holdData.tpReason ?? holdData.reason ?? holdData.remarks ?? null,
          tp_hold_status: holdData.tpStatus ?? null,
          tp_hold_arrival_source: holdData.tpArrivalSource ?? null,
          tp_hold_updated_at: new Date().toISOString(),
        })
        .eq("awb", item.awb);

      return { status: "sent" };
    }

    // Calling: skip email, create call_task
    if (item.clearance_type === "calling") {
      await admin
        .from("batch_items")
        .update({ send_status: "skipped", send_completed_at: new Date().toISOString() })
        .eq("id", item.id);

      const { data: existingCase } = await admin
        .from("awb_cases")
        .select("id")
        .eq("awb", item.awb)
        .maybeSingle();

      if (existingCase) {
        await admin.from("call_tasks").insert({
          case_id: existingCase.id,
          batch_item_id: item.id,
          awb: item.awb,
          consignee_name: item.consignee_name,
          consignee_email: item.consignee_email,
          call_type: "confirmation",
          status: "pending",
        });
      } else {
        // Create case + call_task for new calling items
        const { data: newCase } = await admin
          .from("awb_cases")
          .upsert({
            awb: item.awb,
            latest_batch_run_id: item.batch_run_id,
            current_status: "awaiting_reply",
            clearance_type: "calling",
            call_required: true,
          })
          .select("id")
          .single();

        if (newCase) {
          await admin.from("call_tasks").insert({
            case_id: newCase.id,
            batch_item_id: item.id,
            awb: item.awb,
            consignee_name: item.consignee_name,
            consignee_email: item.consignee_email,
            call_type: "confirmation",
            status: "pending",
          });
        }
      }

      return { status: "sent" };
    }

    const mailbox = Array.isArray(batchRun?.mailbox_configs)
      ? batchRun.mailbox_configs[0]
      : batchRun?.mailbox_configs;

    if (!mailbox) {
      const reason = "No mailbox is configured for this batch.";
      await finalizeSendFailure(admin, item, reason);
      return { status: "failed", reason };
    }

    const { data: assets } = await admin
      .from("file_assets")
      .select("original_name, content, derived_format, source_format")
      .eq("batch_item_id", item.id);

    const attachments = [];
    for (const asset of assets ?? []) {
      if (!asset.content) continue;
      const isPdf = (asset.derived_format ?? asset.source_format) === "pdf";
      attachments.push({
        name: asset.original_name.replace(/\.(tif|tiff)$/i, ".pdf"),
        contentType: isPdf ? "application/pdf" : "application/octet-stream",
        contentBytes: asset.content,
      });
    }

    let template = item.template_id
      ? await fetchTemplateById(item.template_id)
      : null;

    // Auto-select guard: if the sheet/batch didn't set a template (or the
    // configured template is missing), fall back to the template for the
    // confirmed clearance path so NFBRK / FEBRK items always get the right
    // pre-alert without manual selection.
    if (!template) {
      const resolved = await resolveTemplateIdForItem({
        clearanceType: item.clearance_type,
        phase,
      });
      if (resolved) {
        template = await fetchTemplateById(resolved.templateId);
        if (template) {
          await admin
            .from("batch_items")
            .update({ template_id: resolved.templateId })
            .eq("id", item.id);
        }
      }
    }

    if (!template) {
      const reason = `Template for item "${item.template_id ?? item.clearance_type ?? phase}" not found.`;
      await finalizeSendFailure(admin, item, reason);
      return { status: "failed", reason };
    }

    // Attach fixed template files (DO FORMAT.docx, BANK DETAILS.docx, etc.)
    for (const filePath of template.fixed_attachment_paths ?? []) {
      if (!filePath) continue;
      const { data: fileBlob, error: downloadError } = await admin.storage
        .from("template-attachments")
        .download(filePath);
      if (downloadError || !fileBlob) continue;

      const bytes = new Uint8Array(await fileBlob.arrayBuffer());
      const fileName = filePath.split("/").pop() ?? filePath;
      const ext = fileName.split(".").pop()?.toLowerCase();
      const contentTypeMap: Record<string, string> = {
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        doc: "application/msword",
        pdf: "application/pdf",
        xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        xls: "application/vnd.ms-excel",
        txt: "text/plain",
        csv: "text/csv",
        png: "image/png",
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
      };
      attachments.push({
        name: fileName,
        contentType: contentTypeMap[ext ?? ""] ?? "application/octet-stream",
        contentBytes: Buffer.from(bytes).toString("base64"),
      });
    }

    const rawShipmentData = (item.shipment_data ?? {}) as Record<string, string>;

    // For post-arrival, normalize Excel column names to template variable names
    let extraVars: Record<string, string> = {};
    if (phase === "post_arrival") {
      const normalized = new Map<string, string>();
      for (const [key, val] of Object.entries(rawShipmentData)) {
        const nk = key.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
        normalized.set(nk, val);
      }
      const postVarMap: [string, string[]][] = [
        ["MAWB", ["mawb", "mawb no", "master awb", "master airwaybill", "mawb number"]],
        ["IGM_NUMBER", ["igm", "igm no", "igm number", "igm no.", "igm number"]],
        ["IGM_DATE", ["igm date", "igm dt", "igm_date"]],
        ["FLIGHT_NUMBER", ["flight", "flight no", "flight number", "flight no.", "flight no"]],
        ["ORIGIN_PORT", ["origin", "port of origin", "pol", "org", "origin port"]],
        ["DEST_PORT", ["destination", "port of discharge", "pod", "dest", "dest port"]],
        ["HSN_CODE", ["hsn", "hsn code", "hsn number", "tariff", "hsn no", "hsn code"]],
        ["INVOICE_VALUE", ["value", "invoice value", "cif value", "cif", "inv value"]],
        ["FREIGHT", ["freight", "freight amount", "freight charges"]],
        ["CURRENCY", ["currency", "curr", "cur"]],
        ["PIECES", ["pieces", "pcs", "pcs arrived", "pcs code", "pieceqty"]],
        ["WEIGHT", ["weight", "wt", "kg", "kilos", "kilowgt", "kgs", "gross wt"]],
      ];
      for (const [varName, synonyms] of postVarMap) {
        for (const s of synonyms) {
          if (normalized.has(s)) {
            extraVars[varName] = normalized.get(s)!;
            break;
          }
        }
      }
    }

    const variables = buildRenderVariables(
      item.awb,
      item.consignee_name,
      item.consignee_email,
      { ...rawShipmentData, ...extraVars },
    );

    const { subject, html, ccEmails } = renderTemplate(
      template,
      variables,
      mailbox.signature_html,
    );

    const allCc = [...new Set([...ccEmails, mailbox.tagged_mailbox].filter(Boolean))] as string[];

    await admin
      .from("batch_items")
      .update({
        send_status: "processing",
        send_started_at: new Date().toISOString(),
      })
      .eq("id", item.id);

    const driver = mailDriver();

    if (driver === "smtp") {
      const smtpAttachments = attachments.map((a) => ({
        filename: a.name,
        content: Buffer.from(a.contentBytes, "base64"),
        contentType: a.contentType,
      }));

      const result = await sendMailViaSmtp({
        to: [item.consignee_email],
        cc: allCc,
        subject,
        htmlBody: html,
        attachments: smtpAttachments,
      });

      await finalizeSendSuccess(admin, item, {
        subject,
        html,
        senderMailbox: process.env.SMTP_FROM ?? process.env.SMTP_USER ?? "",
        recipientEmails: [item.consignee_email, ...allCc],
        messageId: result.messageId,
        internetMessageId: result.messageId,
        conversationId: null,
      }, phase);

      return { status: "sent" };
    }

    const result = await sendMailViaGraph({
      fromMailbox: mailbox.operational_mailbox,
      to: [item.consignee_email],
      cc: allCc,
      subject,
      htmlBody: html,
      attachments,
    });

    await finalizeSendSuccess(admin, item, {
      subject,
      html,
      senderMailbox: mailbox.operational_mailbox,
      recipientEmails: [item.consignee_email, ...allCc],
      messageId: result.messageId,
      internetMessageId: result.internetMessageId,
      conversationId: result.conversationId,
    }, phase);

    return { status: "sent" };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown send error.";
    const attemptCount = (item.attempt_count ?? 0) + 1;
    const maxAttempts = item.max_attempts ?? 5;

    if (attemptCount >= maxAttempts) {
      await finalizeSendFailure(admin, item, message, attemptCount);
      return { status: "failed", reason: message };
    }

    await admin
      .from("batch_items")
      .update({
        send_status: "retrying",
        attempt_count: attemptCount,
        failure_reason: message,
      })
      .eq("id", item.id);

    return { status: "retrying", reason: message };
  } finally {
    await releaseLock(lockKey);
  }
}
