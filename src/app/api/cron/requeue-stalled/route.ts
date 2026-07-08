import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enqueueSend } from "@/lib/queue/enqueue-send";

const STALLED_THRESHOLD_MINUTES = 10;

/**
 * Reliability backstop, not the M8 reminder/slip scheduler: sweeps
 * batch_items stuck in processing/queued past a generous threshold
 * (a lost QStash message, a crashed inline run) and republishes them.
 * Scheduled via vercel.json; protected by Vercel's CRON_SECRET convention.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const admin = createAdminClient();
  const cutoff = new Date(
    Date.now() - STALLED_THRESHOLD_MINUTES * 60 * 1000,
  ).toISOString();

  const { data: stalledItems } = await admin
    .from("batch_items")
    .select("id, batch_run_id, batch_runs(mailbox_config_id)")
    .in("send_status", ["processing", "queued"])
    .lt("updated_at", cutoff);

  let requeued = 0;
  for (const item of stalledItems ?? []) {
    const batchRun = Array.isArray(item.batch_runs)
      ? item.batch_runs[0]
      : item.batch_runs;

    await admin
      .from("batch_items")
      .update({ send_status: "pending" })
      .eq("id", item.id);

    await enqueueSend(item.id, batchRun?.mailbox_config_id ?? item.batch_run_id);
    requeued += 1;
  }

  return NextResponse.json({ requeued });
}
