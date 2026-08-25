import "server-only";
import { NextResponse } from "next/server";
import { getCasesDueForFollowUp, markJobAsSent, markJobAsSkipped, markJobAsFailed } from "@/lib/reminders/scheduler";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const cronKey = searchParams.get("cron_key");
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (authHeader !== expected && cronKey !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobs = await getCasesDueForFollowUp();
  const results = [];

  for (const job of jobs) {
    const caseData = Array.isArray(job.awb_cases) ? job.awb_cases[0] : job.awb_cases;
    if (!caseData) {
      await markJobAsSkipped(job.id);
      results.push({ jobId: job.id, status: "skipped", reason: "No case data" });
      continue;
    }

    if (caseData.current_status !== "awaiting_reply") {
      await markJobAsSkipped(job.id);
      results.push({ jobId: job.id, status: "skipped", reason: `Case ${caseData.current_status}` });
      continue;
    }

    try {
      const appBaseUrl = process.env.APP_BASE_URL ?? "http://localhost:3000";
      const endpoint = job.reminder_level === 2 ? "send-final-reminder" : "send-reminder";

      const response = await fetch(
        `${appBaseUrl}/api/cases/${job.case_id}/${endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${process.env.CRON_SECRET}`,
          },
          body: JSON.stringify({ reminderLevel: job.reminder_level }),
        },
      );

      if (response.ok) {
        await markJobAsSent(job.id);
        results.push({ jobId: job.id, reminderLevel: job.reminder_level, status: "sent" });
      } else {
        const errBody = await response.json().catch(() => ({}));
        await markJobAsFailed(job.id, errBody.error ?? "Send failed");
        results.push({ jobId: job.id, status: "failed", reason: errBody.error });
      }
    } catch (error) {
      await markJobAsFailed(job.id, error instanceof Error ? error.message : "Unknown error");
      results.push({ jobId: job.id, status: "failed", reason: "Network error" });
    }
  }

  return NextResponse.json({
    processed: results.length,
    sent: results.filter((r) => r.status === "sent").length,
    skipped: results.filter((r) => r.status === "skipped").length,
    failed: results.filter((r) => r.status === "failed").length,
    results,
  });
}
