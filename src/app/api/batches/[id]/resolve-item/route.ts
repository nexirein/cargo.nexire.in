import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { handleRouteError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/log";

const VALID_TYPES = ["nfbrk", "febrk-jeena", "febrk-sunimpex", "febrk", "calling", "hold"];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = requireRole(await getCurrentAppUser(), "admin", "lead", "operator");
    const { id } = await params;
    const body = await request.json();
    const { batchItemId, clearanceType } = body;

    if (!batchItemId || !clearanceType) {
      return NextResponse.json({ error: "batchItemId and clearanceType are required." }, { status: 400 });
    }
    if (!VALID_TYPES.includes(clearanceType)) {
      return NextResponse.json({ error: `Invalid clearance type "${clearanceType}".` }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: item, error: itemError } = await admin
      .from("batch_items")
      .select("id, awb, clearance_type, batch_run_id")
      .eq("id", batchItemId)
      .eq("batch_run_id", id)
      .single();

    if (itemError || !item) {
      return NextResponse.json({ error: "Batch item not found." }, { status: 404 });
    }

    const { error: updateError } = await admin
      .from("batch_items")
      .update({
        clearance_type: clearanceType,
        updated_at: new Date().toISOString(),
      })
      .eq("id", batchItemId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await logAudit({
      actorUserId: user.id,
      entityType: "batch_items",
      entityId: batchItemId,
      action: "resolve_item",
      metadata: {
        awb: item.awb,
        previousClearanceType: item.clearance_type,
        newClearanceType: clearanceType,
        resolvedBy: "manual",
      },
    });

    return NextResponse.json({ success: true, awb: item.awb, clearanceType });
  } catch (error) {
    return handleRouteError(error);
  }
}
