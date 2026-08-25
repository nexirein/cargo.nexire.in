import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { handleRouteError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";
import ExcelJS from "exceljs";

export async function GET(
  _request: Request,
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
    const admin = createAdminClient();

    const { data: batch } = await admin
      .from("batch_runs")
      .select("id, metadata")
      .eq("id", id)
      .single();

    if (!batch) {
      return NextResponse.json({ error: "Session not found." }, { status: 404 });
    }

    const { data: items } = await admin
      .from("batch_items")
      .select("awb, consignee_name, consignee_email, clearance_type, fedex_broker, contact_phone, call_reasons, shipment_data")
      .eq("batch_run_id", id)
      .order("awb");

    if (!items || items.length === 0) {
      return NextResponse.json({ error: "No items in this session." }, { status: 404 });
    }

    // Build a new workbook with enriched data
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Clearance Fill");

    // Headers
    sheet.columns = [
      { header: "AWB", key: "awb", width: 20 },
      { header: "Company Name", key: "companyName", width: 35 },
      { header: "Clearance Type", key: "clearanceType", width: 20 },
      { header: "Broker", key: "broker", width: 20 },
      { header: "Consignee Email", key: "email", width: 45 },
      { header: "Contact Phone", key: "phone", width: 18 },
      { header: "Source", key: "source", width: 25 },
      { header: "Call Reasons", key: "callReasons", width: 25 },
      { header: "Status", key: "status", width: 15 },
    ];

    // Style header
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, size: 11 };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFF1F5F9" },
    };

    // Add data rows
    for (const item of items) {
      const ct = item.clearance_type ?? "";
      const broker = item.fedex_broker ?? item.shipment_data?.fedex_broker_raw ?? "";
      const source = item.shipment_data?.source ?? "";
      const reasons: string[] = item.call_reasons as string[] ?? [];
      const status = item.clearance_type ? "Resolved" : reasons.length > 0 ? "Needs AI Call" : "Pending";

      sheet.addRow({
        awb: item.awb,
        companyName: item.consignee_name,
        clearanceType: formatClearanceType(ct),
        broker: broker || "—",
        email: item.consignee_email || "—",
        phone: item.contact_phone || "—",
        source: source || "—",
        callReasons: reasons.join("; ") || "—",
        status,
      });
    }

    // Auto-filter
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: items.length + 1, column: 9 },
    };

    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="clearance-fill-${id.slice(0, 8)}.xlsx"`,
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

function formatClearanceType(ct: string): string {
  switch (ct) {
    case "nfbrk": return "NFBRK";
    case "febrk": return "FEBRK (unresolved)";
    case "febrk-jeena": return "FEBRK-Jeena";
    case "febrk-sunimpex": return "FEBRK-Sunimpex";
    case "calling": return "Calling";
    case "hold": return "Hold";
    default: return ct || "NOT FOUND";
  }
}
