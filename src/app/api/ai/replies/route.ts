import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function parseInboundId(messageId: string | null): string | null {
  const match = messageId?.match(/^auto-send-([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})-\d+$/i);
  return match?.[1] ?? null;
}

/**
 * Lists every AI auto-send: the outbound email_events row (auto-send-*)
 * joined with the inbound customer query (via the embedded event id in the
 * message id) and the case state — so anyone can see what the AI replied to
 * whom, with what classification and confidence.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") ?? "50");

    const admin = createAdminClient();

    const { data: replies, error } = await admin
      .from("email_events")
      .select("id, message_id, awb, subject, body_clean, recipient_emails, raw_payload, created_at")
      .eq("direction", "outbound")
      .like("message_id", "auto-send-%")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const inboundIds = new Set<string>();
    const awbs = new Set<string>();
    for (const r of replies ?? []) {
      const inboundId = parseInboundId(r.message_id);
      if (inboundId) inboundIds.add(inboundId);
      if (r.awb) awbs.add(r.awb);
    }

    const [inboundRows, caseRows] = await Promise.all([
      inboundIds.size > 0
        ? admin
            .from("email_events")
            .select("id, subject, body_clean, sender_email, received_at")
            .in("id", [...inboundIds])
        : Promise.resolve({ data: null }),
      awbs.size > 0
        ? admin
            .from("awb_cases")
            .select("id, awb, current_status, issue_type, urgency, auto_replied, auto_closed, updated_at")
            .in("awb", [...awbs])
        : Promise.resolve({ data: null }),
    ]);

    const inboundMap = new Map((inboundRows.data ?? []).map((ev) => [ev.id, ev]));
    const caseMap = new Map((caseRows.data ?? []).map((c) => [c.awb, c]));

    const enriched = (replies ?? []).map((r) => {
      const inboundId = parseInboundId(r.message_id);
      const inbound = inboundId ? (inboundMap.get(inboundId) ?? null) : null;
      return {
        id: r.id,
        awb: r.awb,
        subject: r.subject,
        body: r.body_clean,
        recipient: r.recipient_emails?.[0] ?? null,
        classification: r.raw_payload?.classification ?? null,
        route: r.raw_payload?.route ?? "ai_auto_send",
        createdAt: r.created_at,
        inbound: inbound
          ? {
              subject: inbound.subject,
              body: inbound.body_clean,
              sender: inbound.sender_email,
              receivedAt: inbound.received_at,
            }
          : null,
        caseInfo: r.awb ? (caseMap.get(r.awb) ?? null) : null,
      };
    });

    return NextResponse.json(enriched);
  } catch (err) {
    console.error("[api/ai/replies] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load AI replies" },
      { status: 500 },
    );
  }
}