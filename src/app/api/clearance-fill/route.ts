import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { handleRouteError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import { parseExcelBuffer } from "@/lib/excel/parse";
import { guessColumnMapping } from "@/lib/excel/map-rows";
import { autofillShipmentRow } from "@/lib/master-data/autofill";
import {
  isValidPhone,
  buildMasterIndex,
  buildBrokerIndex,
  categorizeSource,
} from "@/lib/master-data/resolve";
import { logAudit } from "@/lib/audit/log";
import pLimit from "p-limit";

export async function POST(request: Request) {
  try {
    const user = requireRole(
      await getCurrentAppUser(),
      "admin",
      "lead",
      "operator",
    );

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }

    const admin = createAdminClient();

    // Parse Excel
    const buffer = await file.arrayBuffer();
    const parsed = await parseExcelBuffer(buffer);
    if (parsed.rows.length === 0) {
      return NextResponse.json({ error: "Excel file has no data rows." }, { status: 400 });
    }

    // Guess column mapping
    const guessedMapping = guessColumnMapping(parsed.headers);
    const awbCol = guessedMapping.awb;
    const nameCol = guessedMapping.consigneeName;
    const emailCol = guessedMapping.consigneeEmail;
    const typeCol = guessedMapping.templateType;
    const brokerCol = guessedMapping.fedexBroker;
    const contactCol = guessedMapping.contact;
    const remarksCol = guessedMapping.standardRemarks;
    const mailIdCol = guessedMapping.mailId;

    if (!awbCol) {
      return NextResponse.json(
        { error: "Could not detect AWB column. Ensure the sheet has a column named 'AWB', 'AWB Numbers', or similar.", headers: parsed.headers },
        { status: 400 },
      );
    }

    const masterIdx = buildMasterIndex([]);
    const brokerIdx = buildBrokerIndex([]);

    interface FillItem {
      rowNumber: number;
      awb: string;
      companyName: string;
      email: string;
      endResult: string | null;
      fedexBroker: string | null;
      contactPhone: string | null;
      standardRemarks: string | null;
      resolvedClearanceType: string | null;
      resolvedBroker: string | null;
      resolvedEmail: string | null;
      source: string;
      confidence: "high" | "medium" | "low";
      callReasons: string[];
    }

    const items: FillItem[] = [];
    const unresolved: FillItem[] = [];
    const callReasonCounts: Record<string, number> = { clearance_type: 0, broker: 0, email: 0 };

    for (const row of parsed.rows) {
      const awb = (row.values[awbCol] ?? "").toString().trim();
      const companyName = nameCol ? (row.values[nameCol] ?? "").toString().trim() : "";
      const email = emailCol ? (row.values[emailCol] ?? "").toString().trim() : "";
      const endResult = typeCol ? (row.values[typeCol] ?? "").toString().trim() : "";
      const fedexBroker = brokerCol ? (row.values[brokerCol] ?? "").toString().trim() : "";
      const contactPhone = contactCol ? (row.values[contactCol] ?? "").toString().trim() : "";
      const standardRemarks = remarksCol ? (row.values[remarksCol] ?? "").toString().trim() : "";
      const mailId = mailIdCol ? (row.values[mailIdCol] ?? "").toString().trim() : "";

      if (!awb) continue;

      // Single shared auto-fill resolution (clearance + broker + email)
      const autofill = autofillShipmentRow(
        {
          companyName,
          endResult: endResult || null,
          fedexBroker: fedexBroker && fedexBroker !== "0" && fedexBroker !== "#N/A" ? fedexBroker : null,
          email,
          standardRemarks: standardRemarks || null,
          mailId: mailId || null,
        },
        masterIdx,
        brokerIdx,
      );

      const item: FillItem = {
        rowNumber: row.rowNumber,
        awb,
        companyName,
        email,
        endResult: endResult || null,
        fedexBroker: fedexBroker && fedexBroker !== "0" && fedexBroker !== "#N/A" ? fedexBroker : null,
        contactPhone: isValidPhone(contactPhone),
        standardRemarks: standardRemarks || null,
        resolvedClearanceType: autofill.clearanceType,
        resolvedBroker: autofill.broker,
        resolvedEmail: autofill.email,
        source: autofill.source,
        confidence: autofill.confidence,
        callReasons: autofill.callReasons,
      };

      for (const reason of item.callReasons) {
        if (reason === "clearance_type") callReasonCounts.clearance_type++;
        else if (reason === "broker") callReasonCounts.broker++;
        else if (reason === "email") callReasonCounts.email++;
      }

      const fullyResolved = !!item.resolvedClearanceType && !item.callReasons.includes("clearance_type");
      items.push(item);
      if (!(fullyResolved && item.resolvedClearanceType !== "febrk")) {
        unresolved.push(item);
      }
    }

    // Store session in batch_runs
    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, "0");
    const timestamp = `${pad(now.getHours())}${pad(now.getMinutes())}`;
    const { data: session, error: sessionError } = await admin
      .from("batch_runs")
      .insert({
        run_name: `CF-${now.toISOString().slice(0, 10)}-${timestamp}-${items.length}items`,
        run_date: new Date().toISOString().slice(0, 10),
        created_by: user.id,
        status: "draft",
        phase: "pre_alert",
        pre_alert_type: "u_bond",
        total_rows: items.length,
        metadata: {
          type: "clearance_fill",
          unresolved_count: unresolved.length,
          resolved_count: items.length - unresolved.length,
          call_reason_counts: callReasonCounts,
          has_phone: items.filter((i) => i.contactPhone).length,
        },
      })
      .select("id")
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: sessionError?.message ?? "Could not create session." }, { status: 500 });
    }

    const sessionId = session.id;

    // Store items in batch_items
    const batchItemsToInsert = items.map((item) => ({
      batch_run_id: sessionId,
      awb: item.awb,
      consignee_name: item.companyName,
      consignee_email: item.resolvedEmail ?? item.email,
      clearance_type: item.resolvedClearanceType,
      fedex_broker: item.resolvedBroker,
      contact_phone: item.contactPhone,
      standard_remarks: item.standardRemarks,
      call_reasons: item.callReasons,
      shipment_data: {
        end_result: item.endResult,
        fedex_broker_raw: item.fedexBroker,
        contact_phone_raw: item.contactPhone,
        standard_remarks_raw: item.standardRemarks,
        row_number: item.rowNumber,
        source: item.source,
      },
      send_status: "pending" as const,
      attachment_status: "pending" as const,
    }));

    // Insert in batches of 50
    const limit = pLimit(4);
    const insertChunks: typeof batchItemsToInsert[] = [];
    for (let i = 0; i < batchItemsToInsert.length; i += 50) {
      insertChunks.push(batchItemsToInsert.slice(i, i + 50));
    }
    await Promise.allSettled(
      insertChunks.map((chunk) =>
        limit(() => admin.from("batch_items").insert(chunk)),
      ),
    );

    await logAudit({
      actorUserId: user.id,
      entityType: "batch_runs",
      entityId: sessionId,
      action: "clearance_fill",
      metadata: {
        totalRows: items.length,
        resolvedCount: items.length - unresolved.length,
        unresolvedCount: unresolved.length,
        callReasonCounts,
        fileName: file.name,
      },
    });

    const sourceCounts: Record<string, number> = {
      excel: 0, master_db_exact: 0, master_db_fuzzy: 0,
      rule: 0, email_column: 0, master_db_email: 0, ai_call: 0,
    };
    for (const i of items) {
      const cat = categorizeSource(i.source ?? "", i.callReasons);
      sourceCounts[cat] = (sourceCounts[cat] ?? 0) + 1;
    }

    return NextResponse.json({
      sessionId,
      total: items.length,
      resolved: items.length - unresolved.length,
      unresolved: unresolved.length,
      callReasonCounts,
      sourceCounts,
      hasPhoneCount: items.filter((i) => i.contactPhone).length,
      items: items.map((i) => ({
        awb: i.awb,
        companyName: i.companyName,
        email: i.email,
        endResult: i.endResult,
        fedexBroker: i.fedexBroker,
        contactPhone: i.contactPhone,
        resolvedClearanceType: i.resolvedClearanceType,
        resolvedBroker: i.resolvedBroker,
        resolvedEmail: i.resolvedEmail,
        source: i.source,
        confidence: i.confidence,
        callReasons: i.callReasons,
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}