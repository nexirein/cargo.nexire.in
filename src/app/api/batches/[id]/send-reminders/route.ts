import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentAppUser } from "@/lib/auth/session";
import { sendMailViaSmtp } from "@/lib/email/smtp";
import { logAudit } from "@/lib/audit/log";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentAppUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: batchRunId } = await params;
  const admin = createAdminClient();

  const { data: batchRun } = await admin
    .from("batch_runs")
    .select("id, mailbox_configs(operational_mailbox, tagged_mailbox, signature_html, display_name)")
    .eq("id", batchRunId)
    .single();

  if (!batchRun) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  const mailbox = Array.isArray(batchRun.mailbox_configs)
    ? batchRun.mailbox_configs[0]
    : batchRun?.mailbox_configs;

  if (!mailbox) {
    return NextResponse.json({ error: "Batch has no mailbox config" }, { status: 400 });
  }

  const { data: items } = await admin
    .from("batch_items")
    .select("id, awb, consignee_email, consignee_name, awb_cases!awb(id, current_status, reminder_count, issue_type)")
    .eq("batch_run_id", batchRunId);

  const awaitingItems = (items ?? []).filter((item) => {
    const c = Array.isArray(item.awb_cases) ? item.awb_cases[0] : item.awb_cases;
    return c && c.current_status === "awaiting_reply";
  });

  const results: { awb: string; status: string; error?: string }[] = [];

  for (const item of awaitingItems) {
    const caseRow = Array.isArray(item.awb_cases) ? item.awb_cases[0] : item.awb_cases;
    if (!caseRow) {
      results.push({ awb: item.awb, status: "skipped", error: "No case found" });
      continue;
    }

    const subject = "Reminder - Pre Alert " + item.awb + " / " + (item.consignee_name ?? "Consignee");
    const html = [
      '<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">',
      "  <p>Dear " + (item.consignee_name ?? "Customer") + ",</p>",
      '  <p>This is a reminder regarding our earlier pre-alert for <strong>AWB ' + item.awb + '</strong>.</p>',
      "  <p>We have not yet received your confirmation or required documents for this shipment. Kindly respond at the earliest to avoid any delays in customs clearance.</p>",
      "  <p>If you have already submitted the documents, please ignore this message.</p>",
      "  <p>Thank you,<br/>" + (mailbox.display_name ?? "Cargo Operations") + "</p>",
      "</div>",
    ].join("\n");

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
        .eq("id", caseRow.id);

      await logAudit({
        actorUserId: user.id,
        entityType: "awb_cases",
        entityId: caseRow.id,
        action: "reminder_sent",
        metadata: { awb: item.awb, batchRunId, reminderLevel: 1 },
      });

      results.push({ awb: item.awb, status: "sent" });
    } catch (err) {
      results.push({
        awb: item.awb,
        status: "failed",
        error: err instanceof Error ? err.message : "Send failed",
      });
    }
  }

  return NextResponse.json({
    total: awaitingItems.length,
    sent: results.filter((r) => r.status === "sent").length,
    failed: results.filter((r) => r.status === "failed").length,
    results,
  });
}
