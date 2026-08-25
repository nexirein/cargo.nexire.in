import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { handleRouteError } from "@/lib/api/handler";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const callType = searchParams.get("call_type");
    const limit = parseInt(searchParams.get("limit") ?? "50");

    const admin = createAdminClient();
    let q = admin
      .from("call_tasks")
      .select(`
        id, awb, consignee_name, call_type, status, created_at, completed_at,
        notes, vapi_transcript, vapi_summary, vapi_recording_url,
        call_summary, action_items, thread_links, ai_summary_status,
        case_id, batch_item_id
      `)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (status) q = q.eq("status", status);
    if (callType) q = q.eq("call_type", callType);

    const { data: calls, error } = await q;

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(calls ?? []);
  } catch (error) {
    return handleRouteError(error);
  }
}
