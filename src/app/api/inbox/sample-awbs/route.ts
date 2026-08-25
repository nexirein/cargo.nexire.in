import "server-only";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

export async function GET() {
  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from("batch_items")
      .select(
        "awb, consignee_name, consignee_email, clearance_type, created_at",
      )
      .not("awb", "is", null)
      .order("created_at", { ascending: false })
      .limit(15);

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, awbs: data ?? [] });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Failed to load AWBs" },
      { status: 500 },
    );
  }
}
