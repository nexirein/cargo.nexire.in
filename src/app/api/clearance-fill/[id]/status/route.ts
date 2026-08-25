import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { handleRouteError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = requireRole(
      await getCurrentAppUser(),
      "admin",
      "lead",
      "operator",
    );
    const { id } = await params;
    const admin = createAdminClient();

    // Get batch items with their call status
    const { data: items } = await admin
      .from("batch_items")
      .select("id, awb, consignee_name, consignee_email, clearance_type, fedex_broker, contact_phone, call_reasons, updated_at, shipment_data")
      .eq("batch_run_id", id)
      .order("awb");

    if (!items) {
      return NextResponse.json({ error: "No items found." }, { status: 404 });
    }

    // Get call_tasks for these items
    const itemIds = items.map((i) => i.id);
    const { data: callTasks } = await admin
      .from("call_tasks")
      .select("batch_item_id, status, call_type, customer_phone, missing_fields, vapi_call_id, completed_at, vapi_transcript, vapi_summary, vapi_recording_url, result_data, call_summary, action_items, reason")
      .in("batch_item_id", itemIds);

    // Build call status map
    const callStatusMap = new Map<string, any>();
    for (const ct of callTasks ?? []) {
      callStatusMap.set(ct.batch_item_id, ct);
    }

    const enrichedItems = items.map((item) => {
      const callTask = callStatusMap.get(item.id);
      const reasons: string[] = (item.call_reasons as string[]) ?? [];
      const sd = (item.shipment_data as Record<string, unknown>) ?? {};
      return {
        id: item.id,
        awb: item.awb,
        companyName: item.consignee_name,
        email: item.consignee_email,
        clearanceType: item.clearance_type,
        fedexBroker: item.fedex_broker,
        contactPhone: item.contact_phone,
        callReasons: reasons,
        source: (sd.source as string) ?? "",
        callStatus: callTask?.status ?? null,
        callType: callTask?.call_type ?? null,
        vapiCallId: callTask?.vapi_call_id ?? null,
        completedAt: callTask?.completed_at ?? null,
        lastUpdated: item.updated_at,
        // Call details for dashboard
        vapiTranscript: callTask?.vapi_transcript ?? null,
        vapiSummary: callTask?.vapi_summary ?? null,
        vapiRecordingUrl: callTask?.vapi_recording_url ?? null,
        resultData: callTask?.result_data ?? null,
        callSummary: callTask?.call_summary ?? null,
        actionItems: callTask?.action_items ?? null,
        callReason: callTask?.reason ?? null,
        missingFields: callTask?.missing_fields ?? null,
      };
    });

    // Compute summary stats
    const stats = {
      total: items.length,
      resolved: items.filter((i) => i.clearance_type).length,
      pending: items.filter((i) => {
        const reasons: string[] = (i.call_reasons as string[]) ?? [];
        return reasons.length > 0 && !callStatusMap.get(i.id);
      }).length,
      calling: items.filter((i) => {
        const ct = callStatusMap.get(i.id);
        return ct && ct.status === "in_progress";
      }).length,
      done: items.filter((i) => {
        const ct = callStatusMap.get(i.id);
        return ct && ct.status === "done";
      }).length,
      noPhone: items.filter((i) => {
        if (i.contact_phone) return false;
        const reasons: string[] = (i.call_reasons as string[]) ?? [];
        return reasons.length > 0;
      }).length,
    };

    return NextResponse.json({ items: enrichedItems, stats });
  } catch (error) {
    return handleRouteError(error);
  }
}
