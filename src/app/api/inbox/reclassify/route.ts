import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { classify } from "@/lib/ai/classify";

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

  const admin = createAdminClient();

  const { data: events } = await admin
    .from("email_events")
    .select("id, awb, subject, body_clean, sender_email, raw_payload, received_at")
    .not("awb", "is", null)
    .order("received_at", { ascending: false })
    .limit(200);

  if (!events || events.length === 0) {
    return NextResponse.json({ status: "ok", reclassified: 0 });
  }

  const results = [];

  for (const event of events) {
    try {
      const textBody = event.body_clean ?? "";
      const from = event.sender_email ?? "";

      const classification = await classify({
        subject: event.subject ?? "",
        body: textBody,
        sender: from,
        awb: event.awb ?? undefined,
      });

      const { data: existingCase } = await admin
        .from("awb_cases")
        .select("id, issue_type, classification_id")
        .eq("awb", event.awb)
        .maybeSingle();

      if (!existingCase) {
        results.push({
          eventId: event.id,
          awb: event.awb,
          classified: true,
          caseFound: false,
          classification: classification.clearanceType,
        });
        continue;
      }

      if (existingCase.issue_type) {
        results.push({
          eventId: event.id,
          awb: event.awb,
          classified: true,
          skipped: "already_classified",
          existing: existingCase.issue_type,
          new: classification.clearanceType,
        });
        continue;
      }

      const { error: updateErr } = await admin
        .from("awb_cases")
        .update({
          issue_type: classification.clearanceType,
          urgency: classification.urgency,
          human_review_required: classification.humanReviewRequired,
          auto_classified: true,
          ai_classification_id: existingCase.classification_id ?? undefined,
        })
        .eq("id", existingCase.id);

      if (!updateErr) {
        await admin.rpc("increment_case_counter", {
          p_case_id: existingCase.id,
          p_column: "ai_actions_count",
        });

        await admin
          .from("case_updates")
          .insert({
            case_id: existingCase.id,
            updated_by: null,
            actor_type: "ai",
            update_type: "reclassify",
            remarks: `Reclassified as "${classification.clearanceType}" (${classification.route})`,
            new_values: {
              clearance_type: classification.clearanceType,
              intent: classification.intent,
              route: classification.route,
              confidence: classification.confidence,
            },
          })
          .maybeSingle();
      }

      const { error: aiErr } = await admin
        .from("ai_classifications")
        .insert({
          case_id: existingCase.id,
          email_event_id: event.id,
          classifier_version: classification.classifierVersion,
          model_used: "ensemble-v1",
          clearance_type: classification.clearanceType,
          intent: classification.intent,
          urgency: classification.urgency,
          response_type: classification.responseType,
          confidence: classification.confidence,
          route: classification.route,
          human_review_required: classification.humanReviewRequired,
          explanation: classification.explanation,
          raw_output: JSON.parse(JSON.stringify(classification)),
        })
        .maybeSingle();

      results.push({
        eventId: event.id,
        awb: event.awb,
        classified: true,
        caseId: existingCase.id,
        clearanceType: classification.clearanceType,
        route: classification.route,
        updated: !updateErr,
        aiRecorded: !aiErr,
      });
    } catch (err) {
      results.push({
        eventId: event.id,
        error: err instanceof Error ? err.message : "Error",
      });
    }
  }

  return NextResponse.json({
    status: "ok",
    total: events.length,
    reclassified: results.filter((r) => r.classified && r.updated !== false).length,
    results,
  });
}
