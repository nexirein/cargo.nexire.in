import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { handleRouteError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/log";

const schema = z.object({
  doNumber: z.string().min(1, "DO number is required"),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = requireRole(await getCurrentAppUser(), "admin", "lead", "operator");
    const { id } = await params;
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid request." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    const { data: caseRow } = await admin
      .from("awb_cases")
      .select("id, awb, owner_user_id, current_status")
      .eq("id", id)
      .maybeSingle();

    if (!caseRow) {
      return NextResponse.json({ error: "Case not found." }, { status: 404 });
    }

    if (caseRow.owner_user_id !== user.id && user.role !== "admin") {
      return NextResponse.json(
        { error: "You can only mark DO collected on your own claimed cases." },
        { status: 403 },
      );
    }

    if (caseRow.current_status === "do_collected") {
      return NextResponse.json(
        { error: "DO already collected for this case." },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();

    const { error: updateErr } = await admin
      .from("awb_cases")
      .update({
        do_number: parsed.data.doNumber,
        do_collected_at: now,
        current_status: "do_collected",
        last_human_action_at: now,
      })
      .eq("id", id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    await admin.from("case_updates").insert({
      case_id: id,
      updated_by: user.id,
      update_type: "do_collected",
      new_values: { do_number: parsed.data.doNumber, current_status: "do_collected" },
    });

    await logAudit({
      actorUserId: user.id,
      entityType: "awb_cases",
      entityId: id,
      action: "do_collected",
      metadata: { do_number: parsed.data.doNumber, awb: caseRow.awb },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
