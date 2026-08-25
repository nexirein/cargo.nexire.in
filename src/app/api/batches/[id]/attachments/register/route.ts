import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { handleRouteError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";

const registerSchema = z.object({
  awb: z.string().min(1),
  originalName: z.string().min(1),
  sourceFormat: z.string().min(1),
  derivedFormat: z.string().optional(),
  checksum: z.string().optional(),
  content: z.string().min(1),
});

// Used by both the plain-attachment upload step (M2) and the TIFF->PDF
// conversion handoff (M3) — one registration path for every attachment
// type, regardless of whether it needed conversion first.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireRole(await getCurrentAppUser(), "admin", "lead", "operator");
    const { id } = await params;
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid input." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    const { data: batchItem } = await admin
      .from("batch_items")
      .select("id")
      .eq("batch_run_id", id)
      .eq("awb", parsed.data.awb)
      .maybeSingle();

    const { error: insertError } = await admin.from("file_assets").insert({
      batch_run_id: id,
      batch_item_id: batchItem?.id ?? null,
      awb: parsed.data.awb,
      original_name: parsed.data.originalName,
      source_format: parsed.data.sourceFormat,
      derived_format: parsed.data.derivedFormat ?? null,
      content: parsed.data.content,
      checksum: parsed.data.checksum ?? null,
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    if (batchItem) {
      await admin
        .from("batch_items")
        .update({
          attachment_status: parsed.data.derivedFormat ? "converted" : "matched",
        })
        .eq("id", batchItem.id);
    }

    return NextResponse.json({ ok: true, matchedBatchItem: Boolean(batchItem) });
  } catch (error) {
    return handleRouteError(error);
  }
}
