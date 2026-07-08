import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { handleRouteError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseExcelBuffer } from "@/lib/excel/parse";
import { guessColumnMapping } from "@/lib/excel/map-rows";
import { batchSourcePath } from "@/lib/batches/storage-paths";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireRole(await getCurrentAppUser(), "admin", "lead", "operator");
    const { id } = await params;

    const admin = createAdminClient();
    const { data: file, error: downloadError } = await admin.storage
      .from("batch-sources")
      .download(batchSourcePath(id));

    if (downloadError || !file) {
      return NextResponse.json(
        { error: "Could not read the uploaded file. Upload it again." },
        { status: 400 },
      );
    }

    const parsed = await parseExcelBuffer(await file.arrayBuffer());

    if (parsed.rows.length === 0) {
      return NextResponse.json(
        { error: "The uploaded sheet has no data rows." },
        { status: 400 },
      );
    }

    await admin
      .from("batch_runs")
      .update({ status: "validating", total_rows: parsed.rows.length })
      .eq("id", id);

    return NextResponse.json({
      headers: parsed.headers,
      guessedMapping: guessColumnMapping(parsed.headers),
      totalRows: parsed.rows.length,
      previewRows: parsed.rows.slice(0, 10).map((r) => r.values),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
