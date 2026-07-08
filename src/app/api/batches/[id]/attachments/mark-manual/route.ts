import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { handleRouteError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ awb: z.string().min(1) });

// Used when an operator skips a TIFF that failed conversion — flags the
// AWB so the rest of the team knows the invoice needs to be attached by
// hand rather than assuming it was silently dropped.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireRole(await getCurrentAppUser(), "admin", "lead", "operator");
    const { id } = await params;
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "AWB is required." }, { status: 400 });
    }

    const admin = createAdminClient();
    await admin
      .from("batch_items")
      .update({ attachment_status: "manual_needed" })
      .eq("batch_run_id", id)
      .eq("awb", parsed.data.awb);

    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
