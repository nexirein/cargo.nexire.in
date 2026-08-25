import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { handleRouteError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/log";

const VALID_BROKER_TYPES = ["febrk-jeena", "febrk-sunimpex"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = requireRole(await getCurrentAppUser(), "admin", "lead", "operator");
    const { id } = await params;
    const body = await request.json();
    const { awb, brokerType } = body;

    if (!awb || !brokerType) {
      return NextResponse.json({ error: "awb and brokerType are required." }, { status: 400 });
    }
    if (!VALID_BROKER_TYPES.includes(brokerType as string)) {
      return NextResponse.json({ error: `Invalid broker type "${brokerType}". Use febrk-jeena or febrk-sunimpex.` }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: items, error: itemsError } = await admin
      .from("batch_items")
      .select("id, awb, clearance_type, consignee_name")
      .eq("batch_run_id", id)
      .eq("awb", awb);

    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    if (!items || items.length === 0) {
      return NextResponse.json({ error: `No batch item found with AWB ${awb}.` }, { status: 404 });
    }

    const results = [];
    for (const item of items) {
      const { error: updateError } = await admin
        .from("batch_items")
        .update({
          clearance_type: brokerType,
          needs_broker_resolution: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);

      if (updateError) {
        results.push({ awb: item.awb, id: item.id, error: updateError.message });
        continue;
      }

      await logAudit({
        actorUserId: user.id,
        entityType: "batch_items",
        entityId: item.id,
        action: "resolve_broker",
        metadata: {
          awb: item.awb,
          previousClearanceType: item.clearance_type,
          newClearanceType: brokerType,
          resolvedBy: "manual",
        },
      });

      results.push({ awb: item.awb, id: item.id, success: true });
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    return handleRouteError(error);
  }
}
