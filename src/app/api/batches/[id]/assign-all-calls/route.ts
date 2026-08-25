import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { handleRouteError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/log";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = requireRole(await getCurrentAppUser(), "admin", "lead", "operator");
    const { id: batchRunId } = await params;
    const body = await request.json();
    const { batchItemIds } = body;

    if (!Array.isArray(batchItemIds) || batchItemIds.length === 0) {
      return NextResponse.json({ error: "batchItemIds array is required." }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: items } = await admin
      .from("batch_items")
      .select("id, awb, consignee_name, consignee_email, clearance_type")
      .in("id", batchItemIds)
      .eq("batch_run_id", batchRunId);

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No items found." }, { status: 404 });
    }

    const callTasksToInsert = [];
    for (const item of items) {
      const callType = item.clearance_type === "calling" ? "confirmation" : "broker_lookup";

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
        if (!newCase) continue;
        caseId = newCase.id;
      }

      callTasksToInsert.push({
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
    }

    if (callTasksToInsert.length > 0) {
      const { error: insertError } = await admin
        .from("call_tasks")
        .insert(callTasksToInsert);

      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }

    await logAudit({
      actorUserId: user.id,
      entityType: "batch_runs",
      entityId: batchRunId,
      action: "assign_all_calls",
      metadata: {
        count: callTasksToInsert.length,
        totalItems: items.length,
      },
    });

    return NextResponse.json({
      success: true,
      assigned: callTasksToInsert.length,
      total: items.length,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
