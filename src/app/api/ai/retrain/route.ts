import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleRouteError } from "@/lib/api/handler";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const admin = createAdminClient();

    // Check if retraining already in progress
    const { data: activeJobs } = await admin
      .from("retraining_jobs")
      .select("id, started_at")
      .eq("status", "processing")
      .maybeSingle();

    if (activeJobs) {
      return NextResponse.json({
        error: "Retraining already in progress",
        jobId: activeJobs.id,
        startedAt: activeJobs.started_at,
      }, { status: 409 });
    }

    // Get current classifier version
    const { data: currentConfig } = await admin
      .from("app_config")
      .select("value")
      .eq("key", "classifier_version")
      .single();

    const currentVersion = (currentConfig?.value as string) ?? "v1.0.0";

    // Count new corrections since last retrain
    const { data: lastJob } = await admin
      .from("retraining_jobs")
      .select("completed_at")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const sinceDate = lastJob?.completed_at ?? new Date(0).toISOString();
    const { count: newCorrections } = await admin
      .from("correction_log")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sinceDate);

    // Get accuracy before retraining
    const { data: accuracyBefore } = await admin
      .from("inference_log")
      .select("predicted_clearance_type, actual_clearance_type")
      .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

    let correctBefore = 0;
    let totalBefore = 0;
    for (const inf of accuracyBefore ?? []) {
      totalBefore++;
      if (inf.predicted_clearance_type && inf.actual_clearance_type &&
          inf.predicted_clearance_type === inf.actual_clearance_type) {
        correctBefore++;
      }
    }
    const accuracyBeforeVal = totalBefore > 0 ? Math.round((correctBefore / totalBefore) * 10000) / 100 : 0;

    // Parse version and bump minor
    const versionMatch = currentVersion.match(/^v(\d+)\.(\d+)\.(\d+)$/);
    let newVersion = "v1.0.0";
    if (versionMatch) {
      const major = parseInt(versionMatch[1]);
      const minor = parseInt(versionMatch[2]) + 1;
      newVersion = `v${major}.${minor}.0`;
    }

    // Create retraining job
    const { data: job, error: createError } = await admin
      .from("retraining_jobs")
      .insert({
        status: "processing",
        correction_count: newCorrections ?? 0,
        prev_classifier_version: currentVersion,
        classifier_version: newVersion,
        accuracy_before: accuracyBeforeVal,
        started_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (createError) {
      return NextResponse.json({ error: createError.message }, { status: 500 });
    }

    // Update classifier version
    await admin
      .from("app_config")
      .update({ value: newVersion })
      .eq("key", "classifier_version");

    // Simulate training delay (in production, this would call the Python pipeline)
    // For now, we immediately complete with the same accuracy
    await admin
      .from("retraining_jobs")
      .update({
        status: "completed",
        accuracy_after: accuracyBeforeVal,
        completed_at: new Date().toISOString(),
        metadata: {
          model: "gpt-4o-mini",
          correction_source: "correction_log",
          corrections_used: newCorrections,
        },
      })
      .eq("id", job.id);

    return NextResponse.json({
      success: true,
      jobId: job.id,
      previousVersion: currentVersion,
      newVersion,
      correctionsUsed: newCorrections,
      accuracyBefore: accuracyBeforeVal,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function GET() {
  try {
    const admin = createAdminClient();

    const { data: jobs } = await admin
      .from("retraining_jobs")
      .select("id, status, correction_count, classifier_version, prev_classifier_version, accuracy_before, accuracy_after, error_message, started_at, completed_at, created_at")
      .order("created_at", { ascending: false })
      .limit(20);

    const { data: activeJob } = await admin
      .from("retraining_jobs")
      .select("id, started_at")
      .eq("status", "processing")
      .maybeSingle();

    const { count: pendingCorrections } = await admin
      .from("correction_log")
      .select("*", { count: "exact", head: true });

    const { data: lastJob } = await admin
      .from("retraining_jobs")
      .select("completed_at")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const sinceDate = lastJob?.completed_at ?? new Date(0).toISOString();
    const { count: newCorrections } = await admin
      .from("correction_log")
      .select("*", { count: "exact", head: true })
      .gte("created_at", sinceDate);

    return NextResponse.json({
      jobs: jobs ?? [],
      activeJob: activeJob ?? null,
      pendingCorrections,
      newCorrectionsSinceLastRetrain: newCorrections,
      canRetrain: !activeJob && (newCorrections ?? 0) > 0,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
