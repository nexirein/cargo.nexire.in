import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { handleRouteError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseExcelBuffer } from "@/lib/excel/parse";
import {
  guessColumnMapping,
  guessPostColumnMapping,
  guessTpHoldColumnMapping,
} from "@/lib/excel/map-rows";
import { resolveClearanceType } from "@/lib/cases/clearance-type";
import { batchSourcePath } from "@/lib/batches/storage-paths";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    requireRole(await getCurrentAppUser(), "admin", "lead", "operator");
    const { id } = await params;

    const admin = createAdminClient();

    const { data: batchRun } = await admin
      .from("batch_runs")
      .select("phase")
      .eq("id", id)
      .maybeSingle();

    const phase = batchRun?.phase ?? "pre_alert";

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

    let guessedMapping: Record<string, string>;
    if (phase === "post_arrival") {
      guessedMapping = guessPostColumnMapping(parsed.headers);
    } else if (phase === "tp_hold") {
      guessedMapping = guessTpHoldColumnMapping(parsed.headers);
    } else {
      guessedMapping = guessColumnMapping(parsed.headers) as Record<string, string>;
    }

    // Compute full clearance type counts from all rows
    const clearanceCounts: Record<string, number> = {};
    const templateCol = guessedMapping.templateType;
    if (templateCol && parsed.headers.includes(templateCol)) {
      for (const row of parsed.rows) {
        const val = (row.values[templateCol] ?? "").toString().trim();
        if (!val) continue;
        const ct = resolveClearanceType(val);
        const key = ct ?? `unresolved`;
        clearanceCounts[key] = (clearanceCounts[key] ?? 0) + 1;
      }
    }

    return NextResponse.json({
      headers: parsed.headers,
      guessedMapping,
      totalRows: parsed.rows.length,
      previewRows: parsed.rows.slice(0, 10).map((r) => r.values),
      clearanceCounts,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
