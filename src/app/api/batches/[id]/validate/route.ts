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
import { resolveClearanceType } from "@/lib/cases/clearance-type";
import {
  buildMasterIndex,
  buildBrokerIndex,
  resolveEmailFromMaster,
} from "@/lib/master-data/resolve";
import { autofillShipmentRow, type AutofillResult } from "@/lib/master-data/autofill";
import { chunkIntoSubBatches } from "@/lib/batches/sub-batch";
import { batchSourcePath } from "@/lib/batches/storage-paths";
import { logAudit } from "@/lib/audit/log";

function resolveTemplateType(
  value: string,
  templates: { id: string; type: string }[],
  phase?: string,
): string | null {
  if (phase === "post_arrival") {
    // For post-arrival, map Excel values to post template types
    const upper = value.toUpperCase().trim();
    if (upper.includes("IGM") || upper === "ARRIVAL" || upper.includes("CARGO")) {
      return templates.find((t) => t.type === "cargo_arrival_notice")?.id ?? null;
    }
    if (upper === "DAY 1" || upper === "DAY1" || upper === "SAME DAY") {
      return templates.find((t) => t.type === "post_day_1")?.id ?? null;
    }
    if (upper === "DAY 2" || upper === "DAY2" || upper === "NEXT DAY") {
      return templates.find((t) => t.type === "post_day_2")?.id ?? null;
    }
    if (upper.includes("REMINDER")) {
      return templates.find((t) => t.type === "post_reminder")?.id ?? null;
    }
    if (upper.includes("ICEGATE") || upper.includes("RETRY")) {
      return templates.find((t) => t.type === "post_igm_retry")?.id ?? null;
    }
    // Default to cargo_arrival_notice for post-arrival
    return templates.find((t) => t.type === "cargo_arrival_notice")?.id ?? null;
  }

  const upper = value.toUpperCase().trim();
  if (upper.startsWith("FEBRK")) {
    if (upper.includes("SUNIMPEX")) {
      return templates.find((t) => t.type === "febrk-sunimpex")?.id ?? null;
    }
    return templates.find((t) => t.type === "febrk-jeena")?.id ?? null;
  }
  if (upper === "NFBRK" || upper.startsWith("NFBRK")) {
    return templates.find((t) => t.type === "nfbrk")?.id ?? null;
  }
  if (upper === "CALLING" || upper.startsWith("CALLING")) {
    return templates.find((t) => t.type === "calling")?.id ?? null;
  }
  if (upper === "HOLD" || upper.startsWith("HOLD")) {
    return templates.find((t) => t.type === "hold")?.id ?? null;
  }
  const exactMatch = templates.find(
    (t) => t.type.toLowerCase() === value.toLowerCase(),
  );
  return exactMatch?.id ?? null;
}

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

    const phase = (body.phase as string) ?? "pre_alert";
    const preAlertType = (body.preAlertType as string) ?? "u_bond";
    if (!["pre_alert", "post_arrival", "tp_hold"].includes(phase)) {
      return NextResponse.json({ error: `Invalid phase "${phase}".` }, { status: 400 });
    }
    if (phase === "pre_alert" && !["u_bond", "consol"].includes(preAlertType)) {
      return NextResponse.json({ error: `Invalid pre-alert type "${preAlertType}".` }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data: batchRun, error: batchError } = await admin
      .from("batch_runs")
      .select("id, sub_batch_size, template_id, phase")
      .eq("id", id)
      .single();
    if (batchError || !batchRun) {
      return NextResponse.json({ error: "Batch not found." }, { status: 404 });
    }

    const { data: allTemplates } = await admin
      .from("templates")
      .select("id, type")
      .eq("is_active", true);

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
    const { validRows, issues, emailStatuses } = validateMappedRows(mapped);

    for (const row of validRows) {
      if (phase === "post_arrival") {
        if (!row.consigneeEmail) {
          issues.push({
            rowNumber: row.rowNumber,
            field: "consigneeEmail",
            severity: "error",
            message: "Consignee email is required for post-arrival notification.",
          });
        }
        const awbStr = row.awb?.toString().trim();
        if (awbStr) {
          const { data: existingCase } = await admin
            .from("awb_cases")
            .select("id, current_status")
            .eq("awb", awbStr)
            .maybeSingle();
          if (!existingCase) {
            issues.push({
              rowNumber: row.rowNumber,
              field: "awb",
              severity: "error",
              message: `No pre-alert case found for AWB ${awbStr}. Send pre-alert first.`,
            });
          }
        }
      }
    }

    // Soft warning for pre_alert: AWB was already sent
    if (phase === "pre_alert") {
      const awbList = validRows.map((r) => r.awb);
      if (awbList.length > 0) {
        let q = admin
          .from("batch_items")
          .select("awb, batch_runs(run_name, pre_alert_type)")
          .in("awb", awbList)
          .neq("batch_run_id", id);

        if (preAlertType === "consol") {
          // Consol: check against uBond batches only
          q = q.eq("batch_runs.pre_alert_type", "u_bond");
        }

        const { data: existingItems } = await q;

        for (const existing of existingItems ?? []) {
          const relatedRun = Array.isArray(existing.batch_runs)
            ? existing.batch_runs[0]
            : existing.batch_runs;
          const row = validRows.find((r) => r.awb === existing.awb);
          if (row) {
            issues.push({
              rowNumber: row.rowNumber,
              field: "awb",
              severity: preAlertType === "consol" ? "warning" : "warning",
              message: `Already sent in a previous batch${
                relatedRun?.run_name ? ` (${relatedRun.run_name})` : ""
              }.${preAlertType === "consol" ? " Will be skipped in send." : ""}`,
            } satisfies RowValidationIssue);
          }
        }
      }
    }

    // Master data — shared 3-chain auto-fill (clearance + broker + email),
    // identical to /clearance-fill via autofillShipmentRow. Persisted into
    // batch_items below so review/send see the auto-filled fields.
    const clearanceTypeCounts: Record<string, number> = {};
    const masterDataResolved: { rowNumber: number; awb: string; companyName: string; clearanceType: string; source: string }[] = [];
    const unresolvedCompanies: { rowNumber: number; awb: string; companyName: string }[] = [];
    const brokerNeedsResolution: { rowNumber: number; awb: string; companyName: string }[] = [];
    const rowAutofill = new Map<number, AutofillResult>();

    const [{ data: clearanceMaster }, { data: brokerMaster }] = await Promise.all([
      admin.from("company_clearance_master").select("company_name, clearance_type, source, times_seen, email"),
      admin.from("broker_master").select("company_name, company_name_normalized, broker_type, broker_name, match_type"),
    ]);

    const masterIdx = buildMasterIndex(clearanceMaster ?? []);
    const brokerIdx = buildBrokerIndex(brokerMaster ?? []);

    for (const row of validRows) {
      const companyName = row.consigneeName ?? "";
      const rawBroker =
        row.fedexBroker &&
        row.fedexBroker !== "0" &&
        row.fedexBroker !== "#N/A" &&
        row.fedexBroker !== "0.0"
          ? row.fedexBroker
          : null;

      const autofill = autofillShipmentRow(
        {
          companyName,
          endResult: row.templateType,
          fedexBroker: rawBroker,
          email: row.consigneeEmail ?? "",
          standardRemarks: null,
          mailId: null,
        },
        masterIdx,
        brokerIdx,
      );

      rowAutofill.set(row.rowNumber, autofill);
      const ct = autofill.clearanceType;

      if (ct) {
        clearanceTypeCounts[ct] = (clearanceTypeCounts[ct] ?? 0) + 1;
        if (autofill.source.startsWith("master_db")) {
          masterDataResolved.push({
            rowNumber: row.rowNumber,
            awb: row.awb,
            companyName,
            clearanceType: ct,
            source: autofill.source || "master_db",
          });
        }
      } else {
        unresolvedCompanies.push({
          rowNumber: row.rowNumber,
          awb: row.awb,
          companyName,
        });
      }

      // FEBRK (unresolved) still missing a broker — needs resolution
      if (ct === "febrk" && !autofill.broker) {
        brokerNeedsResolution.push({
          rowNumber: row.rowNumber,
          awb: row.awb,
          companyName,
        });
      }
    }

    // Per-row auto-fill summary (clearance + broker + email all from company name)
    const autofillSummary: {
      rowNumber: number;
      awb: string;
      companyName: string;
      clearanceType: string | null;
      broker: string | null;
      email: string | null;
      source: string;
      callReasons: string[];
    }[] = validRows.map((row) => {
      const a = rowAutofill.get(row.rowNumber);
      return {
        rowNumber: row.rowNumber,
        awb: row.awb,
        companyName: row.consigneeName ?? "",
        clearanceType: a?.clearanceType ?? null,
        broker: a?.broker ?? null,
        email: a?.email ?? null,
        source: a?.source ?? "",
        callReasons: a?.callReasons ?? [],
      };
    });

    // Courier-move check for consol
    const courierMoveCandidates: { rowNumber: number; awb: string; pieces: number; weightPerPiece: number }[] = [];
    if (phase === "pre_alert" && preAlertType === "consol") {
      for (const row of validRows) {
        const pieces = parseInt(row.shipmentData?.PieceQty ?? row.shipmentData?.Pieces ?? "0", 10);
        const weight = parseFloat(row.shipmentData?.KiloWgt ?? row.shipmentData?.Weight ?? row.shipmentData?.WEIGHT ?? "0");
        const weightPerPiece = pieces > 0 ? weight / pieces : 0;
        if (pieces >= 10 && weightPerPiece > 70) {
          courierMoveCandidates.push({ rowNumber: row.rowNumber, awb: row.awb, pieces, weightPerPiece });
        }
      }
    }

    // Email resolution from master DB for rows with missing emails
    const masterEmailsResolved: { rowNumber: number; awb: string; companyName: string; email: string }[] = [];
    for (const es of emailStatuses) {
      if (es.hasIssue) {
        const row = validRows.find((r) => r.rowNumber === es.rowNumber);
        if (row?.consigneeName) {
          const resolvedEmail = resolveEmailFromMaster(row.consigneeName, masterIdx);
          if (resolvedEmail) {
            masterEmailsResolved.push({
              rowNumber: es.rowNumber,
              awb: row.awb,
              companyName: row.consigneeName,
              email: resolvedEmail,
            });
          }
        }
      }
    }

    if (validRows.length === 0) {
      await admin
        .from("batch_runs")
        .update({
          status: "failed",
          total_rows: mapped.length,
          metadata: { column_mapping: mappingResult.data, validation_issues: issues, clearance_type_counts: clearanceTypeCounts, broker_needs_resolution: brokerNeedsResolution, email_statuses: emailStatuses, unresolved_companies: unresolvedCompanies, master_data_resolved: masterDataResolved, master_emails_resolved: masterEmailsResolved, autofill_summary: autofillSummary },
          pre_alert_type: preAlertType,
        })
        .eq("id", id);
      return NextResponse.json({
        validCount: 0,
        totalRows: mapped.length,
        issues,
        subBatchCount: 0,
        clearanceTypeCounts,
        brokerNeedsResolution,
        courierMoveCandidates,
        emailStatuses,
        masterDataResolved,
        unresolvedCompanies,
        masterEmailsResolved,
        autofillSummary,
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

    function fallbackTemplateId(): string {
      const phaseDefault: Record<string, string> = {
        pre_alert: "nfbrk",
        post_arrival: "cargo_arrival_notice",
        tp_hold: "hold",
      };
      const typeName = phaseDefault[phase] ?? "nfbrk";
      const t = allTemplates?.find((t) => t.type === typeName);
      return t?.id ?? typeName;
    }

    const batchItemsToInsert = chunks.flatMap((chunk) =>
      chunk.items.map((row) => {
        let templateId: string | null = batchRun.template_id ?? null;
        let clearanceType: string | null = null;
        if (phase === "post_arrival" && !templateId) {
          templateId = allTemplates?.find((t) => t.type === "cargo_arrival_notice")?.id ?? null;
        }
        if (row.templateType) {
          const resolved = resolveTemplateType(row.templateType, allTemplates ?? [], phase);
          if (resolved) templateId = resolved;
          clearanceType = resolveClearanceType(row.templateType);
        }

        // Auto-fill from master data (clearance + broker + email) — same as clearance-fill
        const autofill = rowAutofill.get(row.rowNumber);
        const effectiveType = autofill?.clearanceType ?? clearanceType;
        const effectiveEmail = autofill?.email ?? row.consigneeEmail;

        return {
          batch_run_id: id,
          sub_batch_id: subBatchIdByIndex.get(chunk.subBatchIndex),
          awb: row.awb,
          consignee_name: row.consigneeName,
          consignee_email: effectiveEmail,
          clearance_type: effectiveType,
          fedex_broker: autofill?.broker ?? null,
          call_reasons: autofill?.callReasons ?? [],
          shipment_data: {
            ...row.shipmentData,
            ...(autofill?.source ? { source: autofill.source, autofilled: true } : { autofilled: false }),
          },
          template_id: templateId ?? fallbackTemplateId(),
          attachment_status: "pending",
          send_status: "pending",
        };
      }),
    );

    const { error: itemsError } = await admin
      .from("batch_items")
      .insert(batchItemsToInsert);
    if (itemsError) {
      return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    // TP Hold: auto-process immediately (no email, just update awb_cases)
    if (phase === "tp_hold") {
      const { data: tpItems } = await admin
        .from("batch_items")
        .select("id")
        .eq("batch_run_id", id)
        .eq("send_status", "pending");

      if (tpItems && tpItems.length > 0) {
        const { processSendJob } = await import("@/lib/send/process-send-job");
        await Promise.allSettled(tpItems.map((ti) => processSendJob(ti.id)));
      }

      await admin
        .from("batch_runs")
        .update({
          status: "completed",
          phase,
          total_rows: mapped.length,
          total_sub_batches: chunks.length,
          metadata: { column_mapping: mappingResult.data, validation_issues: issues, clearance_type_counts: clearanceTypeCounts, broker_needs_resolution: brokerNeedsResolution, courier_move_candidates: courierMoveCandidates, email_statuses: emailStatuses, unresolved_companies: unresolvedCompanies, master_data_resolved: masterDataResolved, master_emails_resolved: masterEmailsResolved, autofill_summary: autofillSummary },
          pre_alert_type: preAlertType,
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
          autoProcessed: true,
        },
      });

      return NextResponse.json({
        validCount: validRows.length,
        totalRows: mapped.length,
        issues,
        subBatchCount: chunks.length,
        autoProcessed: true,
        clearanceTypeCounts,
        brokerNeedsResolution,
        courierMoveCandidates,
        emailStatuses,
        masterDataResolved,
        unresolvedCompanies,
        masterEmailsResolved,
        autofillSummary,
      });
    }

    await admin
      .from("batch_runs")
        .update({
          status: "ready",
          phase,
          total_rows: mapped.length,
          total_sub_batches: chunks.length,
          metadata: { column_mapping: mappingResult.data, validation_issues: issues, clearance_type_counts: clearanceTypeCounts, broker_needs_resolution: brokerNeedsResolution, courier_move_candidates: courierMoveCandidates, email_statuses: emailStatuses, unresolved_companies: unresolvedCompanies, master_data_resolved: masterDataResolved, master_emails_resolved: masterEmailsResolved, autofill_summary: autofillSummary },
          pre_alert_type: preAlertType,
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
          unresolvedCompanies: unresolvedCompanies.length,
          masterDataResolved: masterDataResolved.length,
        },
    });

    return NextResponse.json({
      validCount: validRows.length,
      totalRows: mapped.length,
      issues,
      subBatchCount: chunks.length,
      clearanceTypeCounts,
      brokerNeedsResolution,
      courierMoveCandidates,
      emailStatuses,
      masterDataResolved,
      unresolvedCompanies,
      masterEmailsResolved,
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
