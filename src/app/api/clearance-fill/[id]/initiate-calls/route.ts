import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { handleRouteError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
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

    // Find all items needing AI calls (items with non-empty call_reasons and a phone number)
    const { data: items } = await admin
      .from("batch_items")
      .select("id, awb, consignee_name, consignee_email, clearance_type, fedex_broker, contact_phone, call_reasons, shipment_data")
      .eq("batch_run_id", id)
      .neq("call_reasons", "[]")
      .not("call_reasons", "is", null)
      .limit(100);

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No items needing AI calls found." }, { status: 400 });
    }

    // Create call_tasks for items with phone numbers
    const callTasks = items.map((item) => {
      const reasons: string[] = item.call_reasons as string[] ?? [];
      const missingFieldsText = reasons.join(", ");

      return {
        case_id: null,
        batch_item_id: item.id,
        awb: item.awb,
        consignee_name: item.consignee_name,
        consignee_email: item.consignee_email,
        customer_phone: item.contact_phone,
        call_type: "clearance_enrichment" as const,
        missing_fields: item.call_reasons ?? [],
        shipment_data: item.shipment_data,
        status: "pending" as const,
        reason: `Missing fields for AWB ${item.awb}: ${missingFieldsText}`,
        script_prompt: `Call the consignee for AWB ${item.awb}. Missing info: ${missingFieldsText}. Ask about only what's missing.`,
        result_data: {
          known_clearance_type: item.clearance_type ?? item.shipment_data?.clearance_type ?? "unknown",
          known_fedex_broker: item.fedex_broker ?? item.shipment_data?.fedex_broker ?? "unknown",
          known_consignee_email: item.consignee_email ?? item.shipment_data?.consignee_email ?? "unknown",
        },
      };
    });

    const { data: inserted, error } = await admin
      .from("call_tasks")
      .insert(callTasks)
      .select("id, awb, customer_phone, missing_fields");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await admin
      .from("batch_runs")
      .update({
        status: "queued",
        metadata: {
          type: "clearance_fill",
          calls_initiated: true,
          call_count: inserted?.length ?? 0,
          initiated_at: new Date().toISOString(),
        },
      })
      .eq("id", id);

    // Report items with no phone separately
    const noPhoneItems = items.filter((i) => !i.contact_phone);

    return NextResponse.json({
      initiated: inserted?.length ?? 0,
      noPhoneCount: noPhoneItems.length,
      calls: inserted?.map((c) => ({
        id: c.id,
        awb: c.awb,
        phone: c.customer_phone,
        missingFields: c.missing_fields,
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
