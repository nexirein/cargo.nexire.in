import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/log";
import { summarizeCall, extractActionItems } from "@/lib/ai/summarizer";
import { linkCallToThread, findMatchingThreads } from "@/lib/ai/thread-linker";
import {
  pickTemplateType,
  fetchTemplateByType,
} from "@/lib/send/select-template";

async function verifyVapiSignature(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  if (!signatureHeader) return false;
  const secret = process.env.VAPI_WEBHOOK_SECRET;
  if (!secret) return true;
  try {
    const encoder = new TextEncoder();
    const cryptoKey = await crypto.subtle.importKey(
      "raw", encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(rawBody));
    const expected = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return expected === signatureHeader;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get("x-vapi-signature");
    if (!(await verifyVapiSignature(rawBody, signature))) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const body = JSON.parse(rawBody);
    const call = body.call ?? body.message?.call;
    if (!call) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    const { id: vapiCallId, metadata, transcript, summary, recordingUrl, analysis } = call;
    const callTaskId = metadata?.callTaskId;
    const awb = metadata?.awb;
    const callType = metadata?.callType;
    const missingFields: string[] = metadata?.missingFields ?? [];

    if (!callTaskId || !awb) {
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    const admin = createAdminClient();

    // Update call_task with Vapi results
    const updateData: Record<string, unknown> = {
      vapi_call_id: vapiCallId,
      vapi_transcript: transcript ?? null,
      vapi_summary: summary ?? null,
      vapi_recording_url: recordingUrl ?? null,
      status: "done",
      completed_at: new Date().toISOString(),
    };

    // Extract structured data from analysis
    const structuredData = analysis?.structuredData;
    let resolvedClearanceType: string | null = null;
    let resolvedBroker: string | null = null;
    let resolvedEmail: string | null = null;

    if (structuredData?.clearanceType) {
      const ct = structuredData.clearanceType.toLowerCase();
      if (ct === "nfbrk") resolvedClearanceType = "nfbrk";
      else if (ct === "febrk-jeena" || ct === "febrk_sunimpex" || ct === "febrk-sunimpex") {
        resolvedClearanceType = ct.replace(/_/g, "-");
      } else if (ct === "febrk") {
        resolvedClearanceType = "febrk";
      }
    }

    if (structuredData?.fedexBroker) {
      resolvedBroker = structuredData.fedexBroker;
    }

    if (structuredData?.consigneeEmail) {
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
      const match = structuredData.consigneeEmail.match(emailRegex);
      if (match) resolvedEmail = match[0];
    }

    // If callType was the old format, map it
    if (!resolvedClearanceType && callType === "confirmation" && structuredData?.clearanceType) {
      const ct = structuredData.clearanceType.toLowerCase();
      if (["nfbrk", "febrk-jeena", "febrk-sunimpex"].includes(ct)) {
        resolvedClearanceType = ct;
      }
    }

    if (!resolvedClearanceType && callType === "broker_lookup" && structuredData?.brokerType) {
      const bt = structuredData.brokerType.toLowerCase();
      if (["febrk-jeena", "febrk-sunimpex"].includes(bt)) {
        resolvedClearanceType = bt;
      }
    }

    await admin.from("call_tasks").update(updateData).eq("id", callTaskId);

    // Phase 7: AI call summarization
    if (transcript || summary) {
      try {
        const { data: callTask } = await admin
          .from("call_tasks")
          .select("consignee_name")
          .eq("id", callTaskId)
          .single();

        await admin
          .from("call_tasks")
          .update({ ai_summary_status: "processing" })
          .eq("id", callTaskId);

        const summaryResult = await summarizeCall({
          rawNotes: summary ?? transcript ?? "",
          awb,
          consigneeName: callTask?.consignee_name ?? undefined,
        });

        if (summaryResult) {
          const actions = extractActionItems(summaryResult);
          await admin
            .from("call_tasks")
            .update({
              call_summary: summaryResult as any,
              action_items: actions as any,
              ai_summary_status: "completed",
            })
            .eq("id", callTaskId);
        } else {
          await admin
            .from("call_tasks")
            .update({ ai_summary_status: "failed" })
            .eq("id", callTaskId);
        }

        // Thread linking
        if (awb) {
          const threads = await findMatchingThreads({ awb });
          if (threads.length > 0) {
            const bestMatch = threads[0];
            await linkCallToThread(callTaskId, bestMatch.caseId);
            await admin
              .from("call_tasks")
              .update({ thread_links: threads as any })
              .eq("id", callTaskId);
          }
        }
      } catch (err) {
        console.warn("[vapi/webhook] AI processing failed:", err);
        await admin
          .from("call_tasks")
          .update({ ai_summary_status: "failed" })
          .eq("id", callTaskId);
      }
    }

    // Update batch_items with resolved fields from the call
    const { data: callTask } = await admin
      .from("call_tasks")
      .select("batch_item_id, consignee_name")
      .eq("id", callTaskId)
      .single();

    if (callTask?.batch_item_id) {
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
        // Also clear resolved call_reasons
        let updatedReasons: string[] = missingFields;
        if (resolvedClearanceType) updatedReasons = updatedReasons.filter((r) => r !== "clearance_type");
        if (resolvedBroker) updatedReasons = updatedReasons.filter((r) => r !== "broker");
        if (resolvedEmail) updatedReasons = updatedReasons.filter((r) => r !== "email");
        batchUpdate.call_reasons = updatedReasons;

        await admin
          .from("batch_items")
          .update(batchUpdate)
          .eq("id", callTask.batch_item_id);

        // Trigger send for this item if clearance_type is now resolved
        if (resolvedClearanceType) {
          try {
            const { processSendJob } = await import("@/lib/send/process-send-job");
            await processSendJob(callTask.batch_item_id);
          } catch {
            // Send will be retried
          }
        }
      }
    }

    // Update master data (company_clearance_master + broker_master) with call results
    const companyName = structuredData?.companyName ?? callTask?.consignee_name;
    if (companyName && resolvedClearanceType) {
      const normalized = companyName
        .toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

      // Update broker_master
      if (resolvedBroker || structuredData?.fedexBroker) {
        const brokerName = resolvedBroker ?? structuredData.fedexBroker;
        const brokerType = resolvedClearanceType === "febrk-jeena" ? "febrk-jeena" :
          resolvedClearanceType === "febrk-sunimpex" ? "febrk-sunimpex" : null;
        if (brokerType) {
          await admin.from("broker_master").upsert(
            {
              company_name: companyName,
              company_name_normalized: normalized,
              broker_type: brokerType,
              broker_name: brokerName ?? null,
              source: "call_confirmation",
              last_used_at: new Date().toISOString(),
            },
            { onConflict: "company_name_normalized, broker_type" },
          );
        }
      }

      // Update company_clearance_master
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
      action: "vapi_call_completed",
      metadata: {
        awb,
        vapiCallId,
        callType,
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
