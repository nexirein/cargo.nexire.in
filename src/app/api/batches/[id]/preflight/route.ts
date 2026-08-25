import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleRouteError } from "@/lib/api/handler";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const admin = createAdminClient();

    const { data: batch } = await admin
      .from("batch_runs")
      .select("id, total_rows, metadata, phase")
      .eq("id", id)
      .single();

    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    const { data: items } = await admin
      .from("batch_items")
      .select("id, awb, consignee_name, consignee_email, clearance_type, template_id, attachment_status, send_status")
      .eq("batch_run_id", id);

    const allItems = items ?? [];
    const checks: {
      check: string;
      status: "passed" | "warning" | "failed";
      message: string;
      details?: string;
    }[] = [];

    // 1. Clearance type resolution
    const noClearance = allItems.filter((i) => !i.clearance_type);
    checks.push({
      check: "clearance_types",
      status: noClearance.length === 0 ? "passed" : "failed",
      message: noClearance.length === 0
        ? "All items have clearance type resolved"
        : `${noClearance.length} item(s) missing clearance type`,
      details: noClearance.length > 0
        ? noClearance.map((i) => `AWB ${i.awb} (${i.consignee_name ?? "unknown"})`).join(", ")
        : undefined,
    });

    // 2. Consignee emails
    const noEmail = allItems.filter((i) => !i.consignee_email);
    checks.push({
      check: "consignee_emails",
      status: noEmail.length === 0 ? "passed" : "failed",
      message: noEmail.length === 0
        ? "All items have recipient emails"
        : `${noEmail.length} item(s) missing recipient email`,
      details: noEmail.length > 0
        ? noEmail.map((i) => `AWB ${i.awb}`).join(", ")
        : undefined,
    });

    // 3. Template assignment
    const noTemplate = allItems.filter((i) => !i.template_id);
    checks.push({
      check: "templates",
      status: noTemplate.length === 0 ? "passed" : "failed",
      message: noTemplate.length === 0
        ? "Templates are properly assigned"
        : `${noTemplate.length} item(s) missing template`,
      details: noTemplate.length > 0
        ? noTemplate.map((i) => `AWB ${i.awb}`).join(", ")
        : undefined,
    });

    // 4. Duplicate AWB check
    const awbCounts = new Map<string, number>();
    for (const item of allItems) {
      awbCounts.set(item.awb, (awbCounts.get(item.awb) ?? 0) + 1);
    }
    const duplicates = Array.from(awbCounts.entries()).filter(([, count]) => count > 1);
    checks.push({
      check: "duplicates",
      status: duplicates.length === 0 ? "passed" : "warning",
      message: duplicates.length === 0
        ? "No duplicate AWB numbers"
        : `${duplicates.length} AWB(s) appear multiple times`,
      details: duplicates.length > 0
        ? duplicates.map(([awb, count]) => `AWB ${awb} (${count}x)`).join(", ")
        : undefined,
    });

    return NextResponse.json({ checks, totalItems: allItems.length });
  } catch (error) {
    return handleRouteError(error);
  }
}
