import { NextResponse } from "next/server";
import { handleRouteError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/log";

export async function POST(request: Request) {
  try {
    const { companyName, batchId, rowNumber, userId, clearanceType } = await request.json();
    if (!companyName) {
      return NextResponse.json({ error: "companyName is required" }, { status: 400 });
    }

    const admin = createAdminClient();

    if (clearanceType) {
      const normalizedName = companyName.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      await admin.from("company_clearance_master").upsert(
        {
          company_name: companyName,
          company_name_normalized: normalizedName,
          clearance_type: clearanceType,
          source: "manual_research",
        },
        { onConflict: "company_name_normalized" },
      );

      if (rowNumber && batchId) {
        const { data: items } = await admin
          .from("batch_items")
          .update({ clearance_type: clearanceType })
          .eq("batch_run_id", batchId)
          .eq("id", rowNumber)
          .select("id");
        if (items && items.length > 0) {
          for (const item of items) {
            const { processSendJob } = await import("@/lib/send/process-send-job");
            await processSendJob(item.id).catch(() => {});
          }
        }
      }

      await logAudit({
        actorUserId: userId ?? null,
        entityType: "company_clearance_master",
        entityId: null,
        action: "clearance_resolved",
        metadata: { companyName, clearanceType, source: "manual_research" },
      });

      return NextResponse.json({ resolved: true, clearanceType });
    }

    // Create a call_task for AI-assisted resolution
    const { data: existing } = await admin
      .from("company_clearance_master")
      .select("company_name, clearance_type")
      .ilike("company_name", companyName)
      .maybeSingle();

    if (existing?.clearance_type) {
      return NextResponse.json({ resolved: true, clearanceType: existing.clearance_type, source: "master" });
    }

    const { data: callTask, error: createError } = await admin
      .from("call_tasks")
      .insert({
        awb: `UNRESOLVED-${rowNumber ?? "0"}`,
        consignee_name: companyName,
        reason: `Resolve clearance type for company: ${companyName}`,
        call_type: "broker_lookup",
        status: "open",
        batch_item_id: null,
        assigned_to: userId ?? null,
      })
      .select("id")
      .single();

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    return NextResponse.json({
      resolved: false,
      callTaskId: callTask?.id,
      message: "Call task created. AI will attempt to resolve clearance type.",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
