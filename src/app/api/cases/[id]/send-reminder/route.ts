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
  const { reminderLevel = 1 } = await request.json().catch(() => ({}));

  const admin = createAdminClient();

  const { data: caseRow } = await admin
    .from("awb_cases")
    .select(
      "id, awb, latest_batch_run_id, current_status, owner_user_id, issue_type, reminder_count",
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
  const label = reminderLevel === 1 ? "Reminder" : "Final Reminder";

  const subject = `${label} - Pre Alert ${caseRow.awb} / ${item.consignee_name ?? "Consignee"}`;
  const html = `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <p>Dear ${item.consignee_name ?? "Customer"},</p>
  <p>This is a ${label.toLowerCase()} regarding our earlier pre-alert for <strong>AWB ${caseRow.awb}</strong>.</p>
  <p>We have not yet received your confirmation or required documents for this shipment. Kindly respond at the earliest to avoid any delays in customs clearance.</p>
  ${reminderLevel === 2 ? '<p><strong>This is the final reminder.</strong> Please take immediate action to prevent penalties or shipment delays.</p>' : ""}
  <p>If you have already submitted the documents, please ignore this message.</p>
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
        reminder_count: (caseRow.reminder_count ?? 0) + 1,
        last_human_action_at: new Date().toISOString(),
      })
      .eq("id", id);

    await logAudit({
      actorUserId: user.id,
      entityType: "awb_cases",
      entityId: id,
      action: reminderLevel === 1 ? "reminder_sent" : "final_reminder_sent",
      metadata: { awb: caseRow.awb, reminderLevel },
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
