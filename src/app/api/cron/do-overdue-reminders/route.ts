import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (authHeader !== expected && searchParams.get("cron_key") !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const now = new Date().toISOString();

  // Find cases where DO is ready but not collected after 24h and payment
  // hasn't been confirmed (NFBRK DO tracking).
  const { data: overdueCases } = await admin
    .from("awb_cases")
    .select("id, awb, do_ready_at, do_number, owner_user_id")
    .not("do_ready_at", "is", null)
    .is("do_collected_at", null)
    .neq("current_status", "closed")
    .neq("do_payment_status", "paid")
    .lt("do_ready_at", new Date(Date.now() - 24 * 3600000).toISOString());

  const results: { id: string; awb: string; status: string }[] = [];

  for (const c of overdueCases ?? []) {
    const hoursOverdue = (Date.now() - new Date(c.do_ready_at).getTime()) / 3600000;
    const daysOverdue = Math.floor((hoursOverdue - 24) / 24) + 1;

    // Surface overdue on the case so dashboards can filter "who hasn't paid".
    await admin
      .from("awb_cases")
      .update({ do_payment_status: "overdue" })
      .eq("id", c.id);

    await admin
      .from("case_updates")
      .insert({
        case_id: c.id,
        updated_by: null,
        actor_type: "cron",
        update_type: "do_overdue_reminder",
        remarks: `DO overdue (${daysOverdue}d). ₹${daysOverdue * 1000} + GST penalty accruing.`,
        new_values: { do_ready_at: c.do_ready_at, days_overdue: daysOverdue },
      });

    results.push({ id: c.id, awb: c.awb, status: "reminded" });
  }

  return NextResponse.json({
    processed: results.length,
    results,
  });
}
