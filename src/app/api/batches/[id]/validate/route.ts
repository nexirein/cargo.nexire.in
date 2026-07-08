import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { handleRouteError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseExcelBuffer } from "@/lib/excel/parse";
import { mapRows } from "@/lib/excel/map-rows";
import {
  columnMappingSchema,
  validateMappedRows,
  type RowValidationIssue,
} from "@/lib/validation/batch-schemas";
import { chunkIntoSubBatches } from "@/lib/batches/sub-batch";
import { batchSourcePath } from "@/lib/batches/storage-paths";
import { logAudit } from "@/lib/audit/log";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = requireRole(
      await getCurrentAppUser(),
      "admin",
      "lead",
      "operator",
    );
    const { id } = await params;
    const body = await request.json();
    const mappingResult = columnMappingSchema.safeParse(body.mapping);
    if (!mappingResult.success) {
      return NextResponse.json(
        {
          error:
            mappingResult.error.issues[0]?.message ??
            "Invalid column mapping.",
        },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    const { data: batchRun, error: batchError } = await admin
      .from("batch_runs")
      .select("id, sub_batch_size")
      .eq("id", id)
      .single();
    if (batchError || !batchRun) {
      return NextResponse.json({ error: "Batch not found." }, { status: 404 });
    }

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
    const mapped = mapRows(parsed, mappingResult.data);
    const { validRows, issues } = validateMappedRows(mapped);

    // Soft warning: this AWB was already sent in a different batch.
    const awbList = validRows.map((r) => r.awb);
    if (awbList.length > 0) {
      const { data: existingItems } = await admin
        .from("batch_items")
        .select("awb, batch_runs(run_name)")
        .in("awb", awbList)
        .neq("batch_run_id", id);

      for (const existing of existingItems ?? []) {
        const relatedRun = Array.isArray(existing.batch_runs)
          ? existing.batch_runs[0]
          : existing.batch_runs;
        const row = validRows.find((r) => r.awb === existing.awb);
        if (row) {
          issues.push({
            rowNumber: row.rowNumber,
            field: "awb",
            severity: "warning",
            message: `Already sent in a previous batch${
              relatedRun?.run_name ? ` (${relatedRun.run_name})` : ""
            }.`,
          } satisfies RowValidationIssue);
        }
      }
    }

    if (validRows.length === 0) {
      await admin
        .from("batch_runs")
        .update({
          status: "failed",
          total_rows: mapped.length,
          metadata: { column_mapping: mappingResult.data, validation_issues: issues },
        })
        .eq("id", id);
      return NextResponse.json({
        validCount: 0,
        totalRows: mapped.length,
        issues,
        subBatchCount: 0,
      });
    }

    const subBatchSize = (batchRun.sub_batch_size ?? 25) as 25 | 50;
    const chunks = chunkIntoSubBatches(validRows, subBatchSize);

    const { data: insertedSubBatches, error: subBatchError } = await admin
      .from("sub_batches")
      .insert(
        chunks.map((chunk) => ({
          batch_run_id: id,
          sub_batch_index: chunk.subBatchIndex,
          total_items: chunk.items.length,
          status: "pending",
        })),
      )
      .select("id, sub_batch_index");

    if (subBatchError || !insertedSubBatches) {
      return NextResponse.json(
        { error: subBatchError?.message ?? "Could not create sub-batches." },
        { status: 500 },
      );
    }

    const subBatchIdByIndex = new Map(
      insertedSubBatches.map((sb) => [sb.sub_batch_index, sb.id]),
    );

    const batchItemsToInsert = chunks.flatMap((chunk) =>
      chunk.items.map((row) => ({
        batch_run_id: id,
        sub_batch_id: subBatchIdByIndex.get(chunk.subBatchIndex),
        awb: row.awb,
        consignee_name: row.consigneeName,
        consignee_email: row.consigneeEmail,
        shipment_data: row.shipmentData,
        attachment_status: "pending",
        send_status: "pending",
      })),
    );

    const { error: itemsError } = await admin
      .from("batch_items")
      .insert(batchItemsToInsert);
    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    await admin
      .from("batch_runs")
      .update({
        status: "ready",
        total_rows: mapped.length,
        total_sub_batches: chunks.length,
        metadata: { column_mapping: mappingResult.data, validation_issues: issues },
      })
      .eq("id", id);

    await logAudit({
      actorUserId: user.id,
      entityType: "batch_runs",
      entityId: id,
      action: "validate",
      metadata: {
        validCount: validRows.length,
        totalRows: mapped.length,
        issueCount: issues.length,
      },
    });

    return NextResponse.json({
      validCount: validRows.length,
      totalRows: mapped.length,
      issues,
      subBatchCount: chunks.length,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
