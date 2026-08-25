import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { handleRouteError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit/log";

const DO_AMOUNT_DAY_OF = 3068;
const DO_AMOUNT_NEXT_DAY = 4248;
const OVERDUE_WINDOW_MS = 24 * 3600000;

const schema = z.object({
  utrNo: z.string().min(1, "UTR / payment reference is required"),
  amount: z.number().positive().optional(),
  notes: z.string().optional(),
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
      .select("id, awb, owner_user_id, current_status, do_ready_at, do_number, do_payment_status")
      .eq("id", id)
      .maybeSingle();

    if (!caseRow) {
      return NextResponse.json({ error: "Case not found." }, { status: 404 });
    }

    if (caseRow.owner_user_id !== user.id && user.role !== "admin") {
      return NextResponse.json(
        { error: "You can only mark DO payments on your own claimed cases." },
        { status: 403 },
      );
    }

    if (caseRow.do_payment_status === "paid") {
      return NextResponse.json(
        { error: "DO payment already marked as paid for this case." },
        { status: 400 },
      );
    }

    // Amount: ₹3068 if paid within 24h of DO being ready, ₹4248 otherwise.
    // Trace can override via `amount`.
    let amount = DO_AMOUNT_DAY_OF;
    if (caseRow.do_ready_at) {
      const ageMs = Date.now() - new Date(caseRow.do_ready_at).getTime();
      if (ageMs > OVERDUE_WINDOW_MS) amount = DO_AMOUNT_NEXT_DAY;
    }
    if (parsed.data.amount) amount = parsed.data.amount;

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      do_payment_status: "paid",
      utr_no: parsed.data.utrNo,
      do_amount: amount,
      payment_received_at: now,
      payment_confirmed_by: user.id,
      do_payment_notes: parsed.data.notes ?? null,
      last_human_action_at: now,
    };

    // Collecting the DO is implied once payment is confirmed.
    if (caseRow.current_status !== "do_collected" && caseRow.current_status !== "closed") {
      patch.current_status = "do_collected";
      patch.do_collected_at = now;
    }

    const { error: updateErr } = await admin
      .from("awb_cases")
      .update(patch)
      .eq("id", id);

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    await admin.from("case_updates").insert({
      case_id: id,
      updated_by: user.id,
      update_type: "do_payment",
      new_values: { ...patch, do_number: caseRow.do_number ?? null },
    });

    await logAudit({
      actorUserId: user.id,
      entityType: "awb_cases",
      entityId: id,
      action: "do_payment_marked",
      metadata: {
        awb: caseRow.awb,
        utrNo: parsed.data.utrNo,
        amount,
        current_status: patch.current_status,
      },
    });

    return NextResponse.json({ ok: true, amount, current_status: patch.current_status });
  } catch (error) {
    return handleRouteError(error);
  }
}
