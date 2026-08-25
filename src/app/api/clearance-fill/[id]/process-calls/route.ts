import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { handleRouteError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { startBolnaCall } from "@/lib/bolna/start-call";
import pLimit from "p-limit";

const MAX_CONCURRENT_CALLS = 3;
const MAX_CALLS_PER_REQUEST = 10;

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

    // Find pending call_tasks for this batch run
    const { data: callTasks } = await admin
      .from("call_tasks")
      .select("id, awb, consignee_name, consignee_email, customer_phone, call_type, missing_fields, shipment_data, result_data")
      .eq("status", "pending")
      .limit(MAX_CALLS_PER_REQUEST);

    if (!callTasks || callTasks.length === 0) {
      return NextResponse.json({ message: "No pending calls to process." });
    }

    const limit = pLimit(MAX_CONCURRENT_CALLS);
    let started = 0;
    let failed = 0;

    const results = await Promise.allSettled(
      callTasks.map((task) =>
        limit(async () => {
          const itemId = task.id;
          const awb = task.awb;

          if (!task.customer_phone) {
            await admin
              .from("call_tasks")
              .update({ status: "skipped", reason: "No phone number available" })
              .eq("id", itemId);
            return { awb, status: "skipped" };
          }

          await admin
            .from("call_tasks")
            .update({ status: "in_progress" })
            .eq("id", itemId);

          const result = await startBolnaCall({
            id: itemId,
            awb,
            consignee_name: task.consignee_name,
            consignee_email: task.consignee_email,
            customer_phone: task.customer_phone,
            call_type: task.call_type ?? "clearance_enrichment",
            shipment_data: task.shipment_data as Record<string, string> | undefined,
            result_data: task.result_data as Record<string, string> | undefined,
            missing_fields: task.missing_fields as string[] | undefined,
          });

          await admin
            .from("call_tasks")
            .update({ vapi_call_id: result.executionId })
            .eq("id", itemId);

          return { awb, executionId: result.executionId, status: result.status };
        }),
      ),
    );

    for (const result of results) {
      if (result.status === "fulfilled") {
        started++;
      } else {
        failed++;
        console.warn("[process-calls] Call failed:", result.reason);
      }
    }

    return NextResponse.json({
      processed: callTasks.length,
      started,
      failed,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
