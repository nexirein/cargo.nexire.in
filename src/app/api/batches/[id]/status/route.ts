import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { handleRouteError } from "@/lib/api/handler";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireRole(
      await getCurrentAppUser(),
      "admin",
      "lead",
      "operator",
      "viewer",
    );
    const { id } = await params;
    const supabase = await createClient();

    const [{ data: batchRun }, { data: items }, { data: subBatches }] =
      await Promise.all([
        supabase
          .from("batch_runs")
          .select(
            "id, run_name, status, total_rows, total_sub_batches, sent_count, failed_count",
          )
          .eq("id", id)
          .maybeSingle(),
        supabase
          .from("batch_items")
          .select(
            "id, awb, consignee_name, consignee_email, attachment_status, send_status, failure_reason",
          )
          .eq("batch_run_id", id)
          .order("awb"),
        supabase
          .from("sub_batches")
          .select("id, sub_batch_index, status, total_items, sent_count, failed_count")
          .eq("batch_run_id", id)
          .order("sub_batch_index"),
      ]);

    if (!batchRun) {
      return NextResponse.json({ error: "Batch not found." }, { status: 404 });
    }

    return NextResponse.json({
      batchRun,
      items: items ?? [],
      subBatches: subBatches ?? [],
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
