import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleRouteError } from "@/lib/api/handler";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const admin = createAdminClient();

    const { data: batch } = await admin
      .from("batch_runs")
      .select("id, run_name, phase, pre_alert_type, metadata")
      .eq("id", id)
      .single();

    if (!batch) {
      return NextResponse.json({ error: "Batch not found" }, { status: 404 });
    }

    const { data: items } = await admin
      .from("batch_items")
      .select("id, awb, consignee_name, consignee_email, clearance_type, template_id, shipment_data")
      .eq("batch_run_id", id);

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No items in batch" }, { status: 400 });
    }

    const { data: existingDrafts } = await admin
      .from("ai_drafts")
      .select("id")
      .eq("batch_id", id)
      .eq("status", "pending");

    const existingCount = existingDrafts?.length ?? 0;
    if (existingCount > 10) {
      return NextResponse.json({
        warning: "Too many pending drafts",
        drafts: [],
        existingCount,
      });
    }

    const phase = batch.phase ?? "pre_alert";
    const preAlertType = batch.pre_alert_type ?? "u_bond";
    const isConsol = phase === "pre_alert" && preAlertType === "consol";

    const draftPromises = items.map(async (item) => {
      const summary = [
        `AWB: ${item.awb}`,
        `Consignee: ${item.consignee_name ?? "N/A"}`,
        `Clearance: ${item.clearance_type ?? "N/A"}`,
        `Phase: ${phase}`,
      ].join("\n");

      const bodyText = isConsol
        ? `Consolidated shipment review for AWB ${item.awb}.\n\n${summary}`
        : `Shipment update for AWB ${item.awb}.\n\n${summary}`;

      const subject = isConsol
        ? `Consolidated: ${item.awb} — ${item.consignee_name ?? "Shipment"}`
        : `Update: ${item.awb} — ${item.consignee_name ?? "Shipment"}`;

      const bodyHtml = `<p>${bodyText.replace(/\n/g, "<br/>")}</p>`;

      const { data: existing } = await admin
        .from("ai_drafts")
        .select("id")
        .eq("batch_id", id)
        .eq("id", item.id)
        .maybeSingle();

      if (existing) return null;

      const { data: draft } = await admin
        .from("ai_drafts")
        .insert({
          batch_id: id,
          trigger_type: "batch_review",
          trigger_reason: `Auto-generated draft for batch ${batch.run_name}`,
          subject,
          body_html: bodyHtml,
          body_text: bodyText,
          confidence: 0.85,
          flags: ["auto_generated"],
          status: "pending",
        })
        .select("id, subject, body_html, body_text, confidence, status, trigger_type, trigger_reason, created_at, template_id")
        .single();

      return draft ?? null;
    });

    const results = await Promise.allSettled(draftPromises);
    const drafts = results
      .filter((r) => r.status === "fulfilled" && r.value)
      .map((r) => (r as PromiseFulfilledResult<unknown>).value);

    return NextResponse.json({ drafts, generated: drafts.length });
  } catch (error) {
    return handleRouteError(error);
  }
}
