import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { handleRouteError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; awb: string }> },
) {
  try {
    const user = requireRole(
      await getCurrentAppUser(),
      "admin",
      "lead",
      "operator",
    );
    const { id, awb } = await params;
    const admin = createAdminClient();
    const body = await request.json();

    const { clearanceType, broker, email, phone } = body;

    const updateData: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };

    if (clearanceType !== undefined) updateData.clearance_type = clearanceType;
    if (broker !== undefined) updateData.fedex_broker = broker;
    if (email !== undefined) updateData.consignee_email = email;
    if (phone !== undefined) updateData.contact_phone = phone;

    // Clear resolved call_reasons
    if (clearanceType) {
      // Fetch current call_reasons and remove clearance_type
      const { data: current } = await admin
        .from("batch_items")
        .select("call_reasons")
        .eq("batch_run_id", id)
        .eq("awb", awb)
        .single();

      if (current?.call_reasons) {
        const reasons: string[] = current.call_reasons as string[];
        const updated = reasons.filter((r) => {
          if (clearanceType && r === "clearance_type") return false;
          if (broker !== undefined && r === "broker") return false;
          if (email !== undefined && r === "email") return false;
          return true;
        });
        updateData.call_reasons = updated;
      }
    }

    const { error } = await admin
      .from("batch_items")
      .update(updateData)
      .eq("batch_run_id", id)
      .eq("awb", awb);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
