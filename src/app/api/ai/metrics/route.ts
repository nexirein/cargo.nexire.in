import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleRouteError } from "@/lib/api/handler";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = createAdminClient();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    // Total classifications
    const { count: totalClassifications } = await admin
      .from("ai_classifications")
      .select("*", { count: "exact", head: true });

    const { count: todayClassifications } = await admin
      .from("ai_classifications")
      .select("*", { count: "exact", head: true })
      .gte("created_at", todayStart);

    // Route distribution
    const { data: routeCounts } = await admin
      .from("ai_classifications")
      .select("route, count:route.count()", { head: false })
      .not("route", "is", null)
      .order("route");

    const routeDistribution: Record<string, number> = {};
    for (const r of routeCounts ?? []) {
      routeDistribution[r.route] = Number(r.count);
    }

    // Clearance type distribution
    const { data: ctCounts } = await admin
      .from("ai_classifications")
      .select("clearance_type, count:clearance_type.count()", { head: false })
      .not("clearance_type", "is", null)
      .order("clearance_type");

    const clearanceTypeDist: Record<string, number> = {};
    for (const c of ctCounts ?? []) {
      clearanceTypeDist[c.clearance_type] = Number(c.count);
    }

    // Corrections count
    const { count: totalCorrections } = await admin
      .from("correction_log")
      .select("*", { count: "exact", head: true });

    const { count: newCorrections } = await admin
      .from("correction_log")
      .select("*", { count: "exact", head: true })
      .gte("created_at", weekAgo);

    // Inference log stats
    const { data: inferenceAccuracy } = await admin
      .from("inference_log")
      .select("predicted_clearance_type, actual_clearance_type, confidence, latency_ms")
      .gte("created_at", monthAgo);

    let correctCount = 0;
    let totalInference = 0;
    let totalLatency = 0;
    let latencyCount = 0;
    const confusionMatrix: Record<string, Record<string, number>> = {};

    for (const inf of inferenceAccuracy ?? []) {
      totalInference++;
      if (inf.latency_ms != null) {
        totalLatency += inf.latency_ms;
        latencyCount++;
      }
      if (inf.predicted_clearance_type && inf.actual_clearance_type) {
        if (!confusionMatrix[inf.predicted_clearance_type]) {
          confusionMatrix[inf.predicted_clearance_type] = {};
        }
        confusionMatrix[inf.predicted_clearance_type][inf.actual_clearance_type] =
          (confusionMatrix[inf.predicted_clearance_type][inf.actual_clearance_type] ?? 0) + 1;
        if (inf.predicted_clearance_type === inf.actual_clearance_type) {
          correctCount++;
        }
      }
    }

    const accuracy = totalInference > 0 ? Math.round((correctCount / totalInference) * 10000) / 100 : 0;
    const avgLatency = latencyCount > 0 ? Math.round(totalLatency / latencyCount) : 0;

    // Daily accuracy trend (gracefully handle missing RPC)
    let dailyAccuracy: { date: string; total: number; correct: number; accuracy: number }[] = [];
    try {
      const result = await admin.rpc("get_daily_accuracy");
      if (result.data) dailyAccuracy = result.data as any;
    } catch {
      // RPC not yet created — derive from inference_log
      const { data: accFromLog } = await admin
        .from("inference_log")
        .select("created_at, predicted_clearance_type, actual_clearance_type")
        .gte("created_at", monthAgo)
        .not("predicted_clearance_type", "is", null)
        .not("actual_clearance_type", "is", null);

      const dayMap = new Map<string, { total: number; correct: number }>();
      for (const row of accFromLog ?? []) {
        const day = new Date(row.created_at).toISOString().slice(0, 10);
        const entry = dayMap.get(day) ?? { total: 0, correct: 0 };
        entry.total++;
        if (row.predicted_clearance_type === row.actual_clearance_type) entry.correct++;
        dayMap.set(day, entry);
      }
      dailyAccuracy = Array.from(dayMap.entries())
        .map(([date, { total, correct }]) => ({
          date,
          total,
          correct,
          accuracy: total > 0 ? Math.round((correct / total) * 10000) / 100 : 0,
        }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }

    // Daily volume trend — fetch all and group by day
    const { data: allVolume } = await admin
      .from("ai_classifications")
      .select("created_at")
      .gte("created_at", monthAgo);

    const volumeMap = new Map<string, number>();
    for (const row of allVolume ?? []) {
      const day = new Date(row.created_at).toISOString().slice(0, 10);
      volumeMap.set(day, (volumeMap.get(day) ?? 0) + 1);
    }
    const dailyVolume = Array.from(volumeMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // AI drafts stats
    const { count: pendingDrafts } = await admin
      .from("ai_drafts")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    const { count: approvedDrafts } = await admin
      .from("ai_drafts")
      .select("*", { count: "exact", head: true })
      .in("status", ["approved", "sent"]);

    const { count: rejectedDrafts } = await admin
      .from("ai_drafts")
      .select("*", { count: "exact", head: true })
      .eq("status", "rejected");

    // Follow-up stats
    const { count: pendingFollowups } = await admin
      .from("followup_schedules")
      .select("*", { count: "exact", head: true })
      .eq("status", "draft_ready");

    const { count: sentFollowups } = await admin
      .from("followup_schedules")
      .select("*", { count: "exact", head: true })
      .eq("status", "sent");

    // Check if retraining is available
    const { data: appConfig } = await admin
      .from("app_config")
      .select("key, value")
      .in("key", ["classifier_version", "ai_enabled", "auto_send_enabled", "followup_enabled"]);

    const configMap: Record<string, unknown> = {};
    for (const c of appConfig ?? []) {
      configMap[c.key] = c.value;
    }

    return NextResponse.json({
      totals: {
        totalClassifications,
        todayClassifications,
        totalCorrections,
        newCorrections,
      },
      routes: routeDistribution,
      clearanceTypes: clearanceTypeDist,
      accuracy: {
        overall: accuracy,
        correctCount,
        totalInference,
        avgLatencyMs: avgLatency,
      },
      confusionMatrix,
      dailyAccuracy: dailyAccuracy ?? [],
      dailyVolume: dailyVolume ?? [],
      drafts: {
        pending: pendingDrafts,
        approved: approvedDrafts,
        rejected: rejectedDrafts,
      },
      followups: {
        pending: pendingFollowups,
        sent: sentFollowups,
      },
      config: configMap,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
