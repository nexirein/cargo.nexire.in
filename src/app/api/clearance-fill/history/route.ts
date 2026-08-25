import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { handleRouteError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const user = requireRole(
      await getCurrentAppUser(),
      "admin",
      "lead",
      "operator",
    );
    const admin = createAdminClient();

    // Get all clearance_fill batch_runs
    const { data: batches, error } = await admin
      .from("batch_runs")
      .select("id, run_name, run_date, created_by, total_rows, status, metadata, created_at")
      .eq("metadata->>type", "clearance_fill")
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!batches || batches.length === 0) {
      return NextResponse.json({ batches: [] });
    }

    // Get call stats for each batch
    const batchIds = batches.map((b) => b.id);
    const { data: callTasks } = await admin
      .from("call_tasks")
      .select("batch_item_id, status, call_type, missing_fields")
      .in("batch_item_id", (await admin
        .from("batch_items")
        .select("id")
        .in("batch_run_id", batchIds)).data?.map((i) => i.id) ?? []);

    // Count calls per batch via batch_items → batch_run_id
    const { data: allBatchItems } = await admin
      .from("batch_items")
      .select("id, batch_run_id, call_reasons, clearance_type, contact_phone")
      .in("batch_run_id", batchIds);

    const batchItemMap = new Map<string, typeof allBatchItems>();
    for (const bi of allBatchItems ?? []) {
      if (!batchItemMap.has(bi.batch_run_id)) batchItemMap.set(bi.batch_run_id, []);
      batchItemMap.get(bi.batch_run_id)!.push(bi);
    }

    // Count call tasks by batch
    const callTasksByBatch = new Map<string, { total: number; done: number; in_progress: number; pending: number; skipped: number; failed: number }>();
    for (const ct of callTasks ?? []) {
      // Find which batch this belongs to
      const bi = allBatchItems?.find((i) => i.id === ct.batch_item_id);
      if (!bi) continue;
      const batchId = bi.batch_run_id;
      if (!callTasksByBatch.has(batchId)) {
        callTasksByBatch.set(batchId, { total: 0, done: 0, in_progress: 0, pending: 0, skipped: 0, failed: 0 });
      }
      const stats = callTasksByBatch.get(batchId)!;
      stats.total++;
      if (ct.status === "done") stats.done++;
      else if (ct.status === "in_progress") stats.in_progress++;
      else if (ct.status === "pending") stats.pending++;
      else if (ct.status === "skipped") stats.skipped++;
      else if (ct.status === "failed") stats.failed++;
    }

    const enriched = batches.map((batch) => {
      const items = batchItemMap.get(batch.id) ?? [];
      const needingCall = items.filter((i) => {
        const reasons = i.call_reasons as string[] ?? [];
        return reasons.length > 0;
      }).length;
      const noPhone = items.filter((i) => {
        const reasons = i.call_reasons as string[] ?? [];
        return reasons.length > 0 && !i.contact_phone;
      }).length;
      const callStats = callTasksByBatch.get(batch.id) ?? {
        total: 0, done: 0, in_progress: 0, pending: 0, skipped: 0, failed: 0,
      };

      return {
        id: batch.id,
        name: batch.run_name,
        date: batch.run_date,
        createdAt: batch.created_at,
        totalItems: items.length,
        resolvedItems: items.filter((i) => i.clearance_type).length,
        needingCall,
        noPhone,
        totalCalls: callStats.total,
        callsDone: callStats.done,
        callsInProgress: callStats.in_progress,
        callsPending: callStats.pending,
        callsSkipped: callStats.skipped,
        callsFailed: callStats.failed,
        answerRate: callStats.total > 0 ? Math.round((callStats.done / callStats.total) * 100) : 0,
      };
    });

    // Overall stats
    const overall = {
      totalBatches: batches.length,
      totalItems: enriched.reduce((s, b) => s + b.totalItems, 0),
      totalCalls: enriched.reduce((s, b) => s + b.totalCalls, 0),
      totalCallsDone: enriched.reduce((s, b) => s + b.callsDone, 0),
      totalCallsFailed: enriched.reduce((s, b) => s + b.callsFailed, 0),
      overallAnswerRate: enriched.reduce((s, b) => s + b.totalCalls, 0) > 0
        ? Math.round(
            enriched.reduce((s, b) => s + b.callsDone, 0) /
            enriched.reduce((s, b) => s + b.totalCalls, 0) * 100
          )
        : 0,
    };

    return NextResponse.json({ batches: enriched, overall });
  } catch (error) {
    return handleRouteError(error);
  }
}
