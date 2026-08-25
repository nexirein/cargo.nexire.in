import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ShipmentInfoContext } from "@/lib/ai/types";

/**
 * Load the real shipment facts for an AWB from awb_cases + batch_items so AI
 * auto-replies for generic "tell me about this shipment" requests are grounded
 * in the system's data (never invented).
 */
export async function loadShipmentContext(
  awb: string,
): Promise<ShipmentInfoContext | null> {
  const admin = createAdminClient();

  const [caseRes, itemRes] = await Promise.all([
    admin
      .from("awb_cases")
      .select(
        "awb, clearance_type, current_status, mawb, igm_number, igm_date, flight_number, origin_port, dest_port, do_number, do_ready_at, do_payment_status, utr_no",
      )
      .eq("awb", awb)
      .maybeSingle(),
    admin
      .from("batch_items")
      .select(
        "consignee_name, consignee_email, fedex_broker, clearance_type, shipment_data",
      )
      .eq("awb", awb)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const c = caseRes.data;
  const it = itemRes.data;
  if (!c && !it) return null;

  const shipmentData = (it?.shipment_data ?? {}) as Record<string, string>;

  return {
    awb,
    consigneeName: it?.consignee_name ?? null,
    consigneeEmail: it?.consignee_email ?? null,
    clearanceType:
      (c?.clearance_type ?? it?.clearance_type) as ShipmentInfoContext["clearanceType"],
    fedexBroker: it?.fedex_broker ?? null,
    currentStatus: c?.current_status ?? null,
    mawb: c?.mawb ?? null,
    igmNumber: c?.igm_number ?? null,
    igmDate: c?.igm_date ?? null,
    flightNumber: c?.flight_number ?? null,
    originPort: c?.origin_port ?? null,
    destPort: c?.dest_port ?? null,
    doNumber: c?.do_number ?? null,
    doReadyAt: c?.do_ready_at ?? null,
    doPaymentStatus: c?.do_payment_status ?? null,
    utrNo: c?.utr_no ?? null,
    freight: shipmentData["Freight"] ?? shipmentData["freight"] ?? null,
    currency: shipmentData["Currency"] ?? shipmentData["currency"] ?? null,
    pieces: shipmentData["Pieces"] ?? shipmentData["pieces"] ?? shipmentData["PieceQty"] ?? null,
    weight: shipmentData["Weight"] ?? shipmentData["weight"] ?? shipmentData["KiloWgt"] ?? null,
    value: shipmentData["Value"] ?? shipmentData["value"] ?? shipmentData["Invoice Value"] ?? shipmentData["CIF Value"] ?? null,
    iec: shipmentData["IEC"] ?? shipmentData["iec"] ?? null,
    pinCode: shipmentData["PIN Code"] ?? shipmentData["PIN"] ?? shipmentData["pincode"] ?? shipmentData["Pin Code"] ?? null,
    loc: shipmentData["Loc"] ?? shipmentData["loc"] ?? shipmentData["Location"] ?? null,
    shipDate: shipmentData["Date"] ?? shipmentData["date"] ?? shipmentData["Ship Date"] ?? null,
    dutyBillAccount: shipmentData["Duty Bill Account"] ?? shipmentData["duty bill account"] ?? null,
    account: shipmentData["Account"] ?? shipmentData["account"] ?? null,
    standardRemarks: shipmentData["Standard Remarks"] ?? shipmentData["standardRemarks"] ?? null,
    mode: shipmentData["Mode"] ?? shipmentData["mode"] ?? null,
  };
}

/** Human-readable "Known shipment facts" block injected into the AI prompt. */
export function formatShipmentFacts(ctx: ShipmentInfoContext): string {
  const lines: string[] = [];
  lines.push(`AWB: ${ctx.awb ?? "unknown"}`);
  lines.push(`Consignee: ${ctx.consigneeName ?? "unknown"}`);
  lines.push(`Clearance path: ${ctx.clearanceType ?? "unknown"}`);
  lines.push(`Broker: ${ctx.fedexBroker ?? "not assigned yet"}`);
  lines.push(`Current status: ${ctx.currentStatus ?? "unknown"}`);
  if (ctx.mawb) lines.push(`MAWB: ${ctx.mawb}`);
  if (ctx.igmNumber) lines.push(`IGM Number: ${ctx.igmNumber}`);
  if (ctx.igmDate) lines.push(`IGM Date: ${ctx.igmDate}`);
  if (ctx.flightNumber) lines.push(`Flight: ${ctx.flightNumber}`);
  if (ctx.originPort) lines.push(`Origin: ${ctx.originPort}`);
  if (ctx.destPort) lines.push(`Destination: ${ctx.destPort}`);
  if (ctx.freight) lines.push(`Freight: ${ctx.freight}${ctx.currency ? ` ${ctx.currency}` : ""}`);
  if (ctx.pieces) lines.push(`Pieces: ${ctx.pieces}`);
  if (ctx.weight) lines.push(`Weight: ${ctx.weight}`);
  if (ctx.value) lines.push(`Value: ${ctx.value}${ctx.currency ? ` ${ctx.currency}` : ""}`);
  if (ctx.iec) lines.push(`IEC: ${ctx.iec}`);
  if (ctx.mode) lines.push(`Mode: ${ctx.mode}`);
  if (ctx.loc) lines.push(`Location: ${ctx.loc}`);
  if (ctx.pinCode) lines.push(`PIN Code: ${ctx.pinCode}`);
  if (ctx.shipDate) lines.push(`Ship Date: ${ctx.shipDate}`);
  if (ctx.dutyBillAccount) lines.push(`Duty Bill Account: ${ctx.dutyBillAccount}`);
  if (ctx.account) lines.push(`Account: ${ctx.account}`);
  if (ctx.standardRemarks) lines.push(`Standard Remarks: ${ctx.standardRemarks}`);
  if (ctx.doNumber) lines.push(`DO Number: ${ctx.doNumber}`);
  if (ctx.doReadyAt) lines.push(`DO Ready At: ${ctx.doReadyAt}`);
  if (ctx.doPaymentStatus) lines.push(`DO Payment Status: ${ctx.doPaymentStatus}`);
  return lines.join("\n");
}
