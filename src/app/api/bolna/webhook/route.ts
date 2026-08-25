import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/log";
import {
  pickTemplateType,
  fetchTemplateByType,
} from "@/lib/send/select-template";

const BOLNA_WHITELIST_IP = "13.203.39.153";

function extractFromTranscript(transcript: string): { clearanceType?: string; fedexBroker?: string; consigneeEmail?: string } {
  const lower = transcript.toLowerCase();
  const result: { clearanceType?: string; fedexBroker?: string; consigneeEmail?: string } = {};

  const ctMatch = lower.match(/clearancetype[:\s]+([a-z0-9_-]+)/i);
  if (ctMatch) {
    const ct = ctMatch[1].toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (["nfbrk", "febrk-jeena", "febrk-sunimpex", "febrk"].includes(ct)) {
      result.clearanceType = ct;
    }
  }

  if (!result.clearanceType) {
    if (/\bself\s*clearance\b|\bself[- ]?handled\b|khud/i.test(lower)) {
      result.clearanceType = "nfbrk";
    } else if (/\bjeena\b/i.test(lower)) {
      result.clearanceType = "febrk-jeena";
      if (!result.fedexBroker) result.fedexBroker = "Jeena & Co.";
    } else if (/\bsunimpex\b/i.test(lower)) {
      result.clearanceType = "febrk-sunimpex";
      if (!result.fedexBroker) result.fedexBroker = "Sunimpex";
    }
  }

  const brokerMatch = transcript.match(/fedex[bB]roker[:\s]+([^\n,.]+)/);
  if (brokerMatch) {
    result.fedexBroker = brokerMatch[1].trim();
  }

  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
  const emailInTranscript = transcript.match(emailRegex);
  if (emailInTranscript) {
    result.consigneeEmail = emailInTranscript[0];
  }

  return result;
}

function extractFromBolnaExtractions(extractedData: Record<string, any> | null): { clearanceType?: string; fedexBroker?: string; consigneeEmail?: string } {
  const result: { clearanceType?: string; fedexBroker?: string; consigneeEmail?: string } = {};

  if (!extractedData) return result;

  for (const category of Object.values(extractedData)) {
    const cat = category as Record<string, any>;

    if (cat.clearanceType?.subjective) {
      const ct = cat.clearanceType.subjective.toLowerCase().replace(/[^a-z0-9_-]/g, "");
      if (["nfbrk", "febrk-jeena", "febrk-sunimpex", "febrk"].includes(ct)) {
        result.clearanceType = ct;
      }
    }
    if (cat.fedexBroker?.subjective) {
      result.fedexBroker = cat.fedexBroker.subjective;
    }
    if (cat.consigneeEmail?.subjective) {
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
      const match = cat.consigneeEmail.subjective.match(emailRegex);
      if (match) result.consigneeEmail = match[0];
    }
    if (cat.customerEmail?.subjective) {
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
      const match = cat.customerEmail.subjective.match(emailRegex);
      if (match) result.consigneeEmail = match[0];
    }
  }

  return result;
}

export async function POST(request: Request) {
  try {
    const ip = request.headers.get("x-forwarded-for") ?? request.headers.get("x-real-ip") ?? "";
    if (ip && !ip.includes(BOLNA_WHITELIST_IP)) {
      console.warn(`[bolna/webhook] Unexpected source IP: ${ip}`);
    }

    const body = await request.json();

    const executionId: string = body.id;
    const status: string = body.status ?? "";

    if (!executionId || status !== "completed") {
      return NextResponse.json({ received: true });
    }

    const transcript: string = body.transcript ?? "";
    const recordingUrl: string | null = body.telephony_data?.recording_url ?? null;
    const extractedData: Record<string, any> | null = body.extracted_data ?? null;

    const admin = createAdminClient();

    const { data: callTask } = await admin
      .from("call_tasks")
      .select("id, awb, batch_item_id, missing_fields, consignee_name, call_type")
      .eq("vapi_call_id", executionId)
      .maybeSingle();

    if (!callTask) {
      console.warn(`[bolna/webhook] No call_task found for execution ${executionId}`);
      return NextResponse.json({ received: true });
    }

    const callTaskId = callTask.id;
    const awb = callTask.awb;
    const missingFields: string[] = (callTask.missing_fields as string[]) ?? [];

    const updateData: Record<string, unknown> = {
      vapi_call_id: executionId,
      vapi_transcript: transcript || null,
      vapi_recording_url: recordingUrl,
      status: "done",
      completed_at: new Date().toISOString(),
    };

    let structuredData: { clearanceType?: string; fedexBroker?: string; consigneeEmail?: string } = {};

    const fromExtractions = extractFromBolnaExtractions(extractedData);
    const fromTranscript = extractFromTranscript(transcript);

    structuredData = Object.keys(fromExtractions).length > 0 ? fromExtractions : fromTranscript;

    if (Object.keys(structuredData).length === 0 && transcript) {
      structuredData = fromTranscript;
    }

    let resolvedClearanceType: string | null = null;
    let resolvedBroker: string | null = null;
    let resolvedEmail: string | null = null;

    if (structuredData.clearanceType) {
      const ct = structuredData.clearanceType.toLowerCase();
      if (ct === "nfbrk") resolvedClearanceType = "nfbrk";
      else if (ct === "febrk-jeena" || ct === "febrk-sunimpex") {
        resolvedClearanceType = ct;
      } else if (ct === "febrk") {
        resolvedClearanceType = "febrk";
      }
    }

    if (structuredData.fedexBroker) {
      resolvedBroker = structuredData.fedexBroker;
    }

    if (structuredData.consigneeEmail) {
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
      const match = structuredData.consigneeEmail.match(emailRegex);
      if (match) resolvedEmail = match[0];
    }

    await admin.from("call_tasks").update(updateData).eq("id", callTaskId);

    if (transcript) {
      try {
        await admin
          .from("call_tasks")
          .update({
            vapi_summary: transcript.slice(0, 500),
            ai_summary_status: "completed",
          })
          .eq("id", callTaskId);
      } catch {
        await admin
          .from("call_tasks")
          .update({ ai_summary_status: "failed" })
          .eq("id", callTaskId);
      }
    }

    if (callTask.batch_item_id) {
      const batchUpdate: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };

      if (resolvedClearanceType) {
        batchUpdate.clearance_type = resolvedClearanceType;
        // Auto-select the send template from the confirmed clearance path and
        // record that this item was confirmed by an AI call.
        const templateType = pickTemplateType(resolvedClearanceType, "pre_alert");
        const template = await fetchTemplateByType(templateType);
        if (template) batchUpdate.template_id = template.id;
        batchUpdate.confirmation_source = "ai_call";
        batchUpdate.confirmed_at = new Date().toISOString();
      }
      if (resolvedBroker) {
        batchUpdate.fedex_broker = resolvedBroker;
      }
      if (resolvedEmail) {
        batchUpdate.consignee_email = resolvedEmail;
      }

      if (Object.keys(batchUpdate).length > 1) {
        let updatedReasons: string[] = [...missingFields];
        if (resolvedClearanceType) updatedReasons = updatedReasons.filter((r) => r !== "clearance_type");
        if (resolvedBroker) updatedReasons = updatedReasons.filter((r) => r !== "broker");
        if (resolvedEmail) updatedReasons = updatedReasons.filter((r) => r !== "email");
        batchUpdate.call_reasons = updatedReasons;

        await admin
          .from("batch_items")
          .update(batchUpdate)
          .eq("id", callTask.batch_item_id);

        if (resolvedClearanceType) {
          try {
            const { processSendJob } = await import("@/lib/send/process-send-job");
            await processSendJob(callTask.batch_item_id);
          } catch {
          }
        }
      }
    }

    const companyName = callTask.consignee_name;
    if (companyName && resolvedClearanceType) {
      const normalized = companyName
        .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

      if (resolvedBroker) {
        const brokerType = resolvedClearanceType === "febrk-jeena" ? "febrk-jeena" :
          resolvedClearanceType === "febrk-sunimpex" ? "febrk-sunimpex" : null;
        if (brokerType) {
          await admin.from("broker_master").upsert(
            {
              company_name: companyName,
              company_name_normalized: normalized,
              broker_type: brokerType,
              broker_name: resolvedBroker,
              source: "call_confirmation",
              last_used_at: new Date().toISOString(),
            },
            { onConflict: "company_name_normalized, broker_type" },
          );
        }
      }

      const { data: existing } = await admin
        .from("company_clearance_master")
        .select("id, times_seen")
        .eq("company_name", companyName)
        .maybeSingle();

      if (existing) {
        await admin
          .from("company_clearance_master")
          .update({
            clearance_type: resolvedClearanceType,
            times_seen: (existing.times_seen ?? 0) + 1,
            last_seen_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await admin
          .from("company_clearance_master")
          .insert({
            company_name: companyName,
            clearance_type: resolvedClearanceType,
            source: "ai_call",
            last_seen_at: new Date().toISOString(),
            times_seen: 1,
          });
      }
    }

    await logAudit({
      actorUserId: null,
      entityType: "call_tasks",
      entityId: callTaskId,
      action: "bolna_call_completed",
      metadata: {
        awb,
        executionId,
        callType: callTask.call_type,
        resolvedClearanceType,
        resolvedBroker,
        resolvedEmail,
        hasTranscript: !!transcript,
        hasRecording: !!recordingUrl,
      },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
