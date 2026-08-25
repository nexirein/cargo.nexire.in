import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { handleRouteError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/log";

const VALID_CALL_TYPES = ["confirmation", "broker_lookup"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireRole(await getCurrentAppUser(), "admin", "lead", "operator");
    const { id: batchRunId } = await params;
    const body = await request.json();
    const { batchItemId, callType } = body;

    if (!batchItemId || !callType) {
      return NextResponse.json({ error: "batchItemId and callType are required." }, { status: 400 });
    }
    if (!VALID_CALL_TYPES.includes(callType)) {
      return NextResponse.json({ error: `Invalid call type "${callType}".` }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: item, error: itemError } = await admin
      .from("batch_items")
      .select("id, awb, consignee_name, consignee_email, clearance_type, batch_run_id")
      .eq("id", batchItemId)
      .eq("batch_run_id", batchRunId)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: "Batch item not found." }, { status: 404 });
    }

    // Find or create awb_cases record
    const { data: existingCase } = await admin
      .from("awb_cases")
      .select("id")
      .eq("awb", item.awb)
      .maybeSingle();

    let caseId: string;
    if (existingCase) {
      caseId = existingCase.id;
    } else {
      const { data: newCase } = await admin
        .from("awb_cases")
        .insert({
          awb: item.awb,
          current_status: "awaiting_reply",
          call_required: true,
        })
        .select("id")
        .single();
      if (!newCase) {
        return NextResponse.json({ error: "Could not create case." }, { status: 500 });
      }
      caseId = newCase.id;
    }

    // Create call_task
    const { error: callError } = await admin
      .from("call_tasks")
      .insert({
        case_id: caseId,
        batch_item_id: item.id,
        awb: item.awb,
        consignee_name: item.consignee_name,
        consignee_email: item.consignee_email,
        call_type: callType,
        status: "pending",
        reason: callType === "confirmation"
          ? "Confirm clearance type (NFBRK or FEBRK)"
          : "Confirm broker (Jeena or Sunimpex)",
      });

    if (callError) {
      return NextResponse.json({ error: callError.message }, { status: 500 });
    }

    await logAudit({
      actorUserId: null,
      entityType: "batch_items",
      entityId: batchItemId,
      action: "assign_call",
      metadata: {
        awb: item.awb,
        callType,
        caseId,
      },
    });

    return NextResponse.json({ success: true, awb: item.awb, callType });
  } catch (error) {
    return handleRouteError(error);
  }
}
