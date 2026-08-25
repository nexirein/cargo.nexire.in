import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAppUser } from "@/lib/auth/session";
import { sendMailViaSmtp } from "@/lib/email/smtp";
import { logAudit } from "@/lib/audit/log";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const admin = createAdminClient();

  const { data: caseRow } = await admin
    .from("awb_cases")
    .select(
      "id, awb, latest_batch_run_id, current_status, owner_user_id, issue_type",
    )
    .eq("id", id)
    .single();

  if (!caseRow) {
    return NextResponse.json({ error: "Case not found" }, { status: 404 });
  }

  const [batchRunResult, itemResult] = await Promise.all([
    admin
      .from("batch_runs")
      .select(
        "id, mailbox_configs(operational_mailbox, tagged_mailbox, signature_html, display_name)",
      )
      .eq("id", caseRow.latest_batch_run_id)
      .single(),
    admin
      .from("batch_items")
      .select("consignee_email, consignee_name")
      .eq("batch_run_id", caseRow.latest_batch_run_id)
      .eq("awb", caseRow.awb)
      .maybeSingle(),
  ]);

  const batchRun = batchRunResult.data;
  const item = itemResult.data;

  const mailbox = Array.isArray(batchRun?.mailbox_configs)
    ? batchRun.mailbox_configs[0]
    : batchRun?.mailbox_configs;

  if (!mailbox || !item) {
    return NextResponse.json(
      { error: "Could not determine recipient or mailbox" },
      { status: 400 },
    );
  }

  const subject = `FINAL REMINDER - Pre Alert ${caseRow.awb} / ${item.consignee_name ?? "Consignee"}`;
  const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <p>Dear ${item.consignee_name ?? "Customer"},</p>
  <p><strong>FINAL REMINDER</strong> regarding AWB <strong>${caseRow.awb}</strong>.</p>
  <p>This is our final follow-up on the pre-alert sent earlier. We have not received any response or required documentation for this shipment.</p>
  <p>Please note that failure to respond immediately may result in:</p>
  <ul>
    <li>Delays in customs clearance</li>
    <li>Late BOE filing penalties (₹5,000-10,000 per day)</li>
    <li>Storage/demurrage charges at the airport</li>
  </ul>
  <p>Kindly respond at the earliest to avoid the above consequences.</p>
  <p>Thank you,<br/>${mailbox.display_name ?? "Cargo Operations"}</p>
</div>`;

  try {
    await sendMailViaSmtp({
      to: [item.consignee_email],
      cc: mailbox.tagged_mailbox ? [mailbox.tagged_mailbox] : [],
      subject,
      htmlBody: html,
    });

    await admin
      .from("awb_cases")
      .update({
        final_reminder_sent: true,
        last_human_action_at: new Date().toISOString(),
      })
      .eq("id", id);

    await logAudit({
      actorUserId: user.id,
      entityType: "awb_cases",
      entityId: id,
      action: "final_reminder_sent",
      metadata: { awb: caseRow.awb },
    });

    return NextResponse.json({ status: "sent" });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Send failed",
      },
      { status: 500 },
    );
  }
}
