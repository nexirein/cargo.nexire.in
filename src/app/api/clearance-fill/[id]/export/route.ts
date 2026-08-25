import { NextResponse } from "next/server";
import { getCurrentAppUser } from "@/lib/auth/session";
import { requireRole } from "@/lib/auth/rbac";
import { handleRouteError } from "@/lib/api/handler";
import { createAdminClient } from "@/lib/supabase/admin";

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

    // Build CSV: AWB, Company Name, Clearance Type, Broker, Email, Phone, Source, Call Reasons
    const header = "AWB,Company Name,Clearance Type,Broker,Consignee Email,Contact Phone,Source,Call Reasons,Status";
    const rows = items.map((item) => {
      const ct = item.clearance_type ?? "";
      const broker = item.fedex_broker ?? item.shipment_data?.fedex_broker_raw ?? "";
      const source = item.shipment_data?.source ?? "";
      const reasons: string[] = item.call_reasons as string[] ?? [];
      const status = item.clearance_type ? "Resolved" : reasons.length > 0 ? "Needs AI Call" : "Pending";

      return [
        csvEscape(item.awb),
        csvEscape(item.consignee_name ?? ""),
        csvEscape(formatClearanceType(ct)),
        csvEscape(broker),
        csvEscape(item.consignee_email ?? ""),
        csvEscape(item.contact_phone ?? ""),
        csvEscape(source),
        csvEscape(reasons.join("; ")),
        csvEscape(status),
      ].join(",");
    });

    const csv = [header, ...rows].join("\n");

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="clearance-fill-${id.slice(0, 8)}.csv"`,
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

function csvEscape(val: string): string {
  const s = val ?? "";
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}
