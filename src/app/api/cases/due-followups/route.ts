import "server-only";
import { NextResponse } from "next/server";
import { getCasesDueForFollowUp } from "@/lib/reminders/scheduler";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobs = await getCasesDueForFollowUp();

  return NextResponse.json({
    count: jobs.length,
    jobs: jobs.map((j) => {
      const caseData = Array.isArray(j.awb_cases) ? j.awb_cases[0] : j.awb_cases;
      return {
        jobId: j.id,
        reminderLevel: j.reminder_level,
        dueAt: j.due_at,
        caseId: j.case_id,
        awb: caseData?.awb ?? null,
        currentStatus: caseData?.current_status ?? null,
      };
    }),
  });
}
