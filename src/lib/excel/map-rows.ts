import type { ParsedExcel } from "./parse";

export interface ColumnMapping {
  awb: string;
  consigneeEmail: string;
  consigneeName?: string;
  templateType?: string;
  fedexBroker?: string;
  contact?: string;
  standardRemarks?: string;
  mailId?: string;
}

export interface MappedRow {
  rowNumber: number;
  awb: string;
  consigneeEmail: string;
  consigneeName: string | null;
  templateType: string | null;
  fedexBroker: string | null;
  shipmentData: Record<string, string>;
}

export function mapRows(
  parsed: ParsedExcel,
  mapping: ColumnMapping,
): MappedRow[] {
  return parsed.rows.map((row) => {
    const shipmentData: Record<string, string> = {};
    for (const header of parsed.headers) {
      if (
        header === mapping.awb ||
        header === mapping.consigneeEmail ||
        header === mapping.consigneeName ||
        header === mapping.templateType ||
        header === mapping.fedexBroker
      ) {
        continue;
      }
      shipmentData[header] = row.values[header] ?? "";
    }

    return {
      rowNumber: row.rowNumber,
      awb: (row.values[mapping.awb] ?? "").trim(),
      consigneeEmail: (row.values[mapping.consigneeEmail] ?? "").trim(),
      consigneeName: mapping.consigneeName
        ? (row.values[mapping.consigneeName] ?? "").trim() || null
        : null,
      templateType: mapping.templateType
        ? (row.values[mapping.templateType] ?? "").trim()
        : null,
      fedexBroker: mapping.fedexBroker
        ? (row.values[mapping.fedexBroker] ?? "").trim()
        : null,
      shipmentData,
    };
  });
}

const AWB_SYNONYMS = [
  "awb",
  "awb no",
  "awb number",
  "airwaybill",
  "air waybill",
  "waybill",
  "waybill no",
  "waybill number",
  "mawb",
  "hawb",
  "fec numbers",
  "fec number",
  "fec no",
];
const EMAIL_SYNONYMS = [
  "email",
  "e mail",
  "consignee email",
  "recipient email",
  "customer email",
  "notify email",
];
const NAME_SYNONYMS = [
  "consignee",
  "consignee name",
  "cgnee name",
  "cgnee",
  "customer name",
  "customer",
  "notify party",
  "name",
];
const TEMPLATE_SYNONYMS = [
  "end result",
  "result",
  "clearance type",
  "clearance",
];
const FEDEX_BROKER_SYNONYMS = [
  "fedex broker",
  "broker",
  "broker type",
  "broker name",
  "cha",
];
const CONTACT_SYNONYMS = ["contact", "contact no", "phone", "mobile", "telephone", "phone no", "mobile no"];
const STD_REMARKS_SYNONYMS = ["standard remarks", "remarks", "cc", "cc emails", "cc email", "remarks"];
const MAIL_ID_SYNONYMS = ["mail id", "mail", "mail ids", "email id", "consignee email id"];

// Post-arrival synonyms
export const MAWB_SYNONYMS = ["mawb", "mawb no", "master awb", "master airwaybill", "mawb number"];
export const IGM_SYNONYMS = ["igm", "igm no", "igm number"];
export const FLIGHT_SYNONYMS = ["flight", "flight no", "flight number", "flight no."];
export const ORIGIN_SYNONYMS = ["origin", "port of origin", "pol", "org"];
export const DEST_SYNONYMS = ["destination", "port of discharge", "pod", "dest"];
export const HSN_SYNONYMS = ["hsn", "hsn code", "hsn number", "tariff", "hsn no"];
export const INVOICE_VALUE_SYNONYMS = ["value", "invoice value", "cif value", "cif"];
export const PIECES_SYNONYMS = ["pieces", "pcs", "pcs arrived", "pcs code", "pieceqty"];
export const WEIGHT_SYNONYMS = ["weight", "wt", "kg", "kilos", "kilowgt", "kgs"];

// TP Hold synonyms
export const TP_REASON_SYNONYMS = ["reason", "hold reason", "remarks"];
export const TP_STATUS_SYNONYMS = ["stat", "status code", "stat53", "stat44", "hold status"];
export const TP_ARRIVAL_SOURCE_SYNONYMS = ["arrival source", "flight", "arrival flight"];
export const TP_ARRIVAL_DATE_SYNONYMS = ["arrival date", "date arrived", "arrival"];

function normalize(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Best-effort defaults for the field-mapping UI; the user confirms/edits. */
export function guessColumnMapping(headers: string[]): Partial<ColumnMapping> {
  const guess: Partial<ColumnMapping> = {};

  for (const header of headers) {
    const normalized = normalize(header);
    if (
      !guess.awb &&
      AWB_SYNONYMS.some((s) => normalized === s || normalized.includes(s))
    ) {
      guess.awb = header;
      continue;
    }
    if (
      !guess.consigneeEmail &&
      EMAIL_SYNONYMS.some((s) => normalized.includes(s))
    ) {
      guess.consigneeEmail = header;
      continue;
    }
    if (
      !guess.consigneeName &&
      NAME_SYNONYMS.some((s) => normalized.includes(s))
    ) {
      guess.consigneeName = header;
      continue;
    }
    if (
      !guess.templateType &&
      TEMPLATE_SYNONYMS.some((s) => normalized.includes(s))
    ) {
      guess.templateType = header;
      continue;
    }
    if (
      !guess.fedexBroker &&
      FEDEX_BROKER_SYNONYMS.some((s) => normalized.includes(s))
    ) {
      guess.fedexBroker = header;
      continue;
    }
    if (
      !guess.contact &&
      CONTACT_SYNONYMS.some((s) => normalized.includes(s))
    ) {
      guess.contact = header;
      continue;
    }
    if (
      !guess.standardRemarks &&
      STD_REMARKS_SYNONYMS.some((s) => normalized.includes(s))
    ) {
      guess.standardRemarks = header;
      continue;
    }
    if (
      !guess.mailId &&
      MAIL_ID_SYNONYMS.some((s) => normalized.includes(s))
    ) {
      guess.mailId = header;
    }
  }

  return guess;
}

/** Auto-detect columns for post-arrival Excel (MAWB/IGM/Flight/Origin/Dest) */
export function guessPostColumnMapping(headers: string[]): Record<string, string> {
  const guess: Record<string, string> = {};

  for (const header of headers) {
    const normalized = normalize(header);
    if (!guess.awb && AWB_SYNONYMS.some((s) => normalized === s || normalized.includes(s))) {
      guess.awb = header;
      continue;
    }
    if (!guess.consigneeEmail && EMAIL_SYNONYMS.some((s) => normalized.includes(s))) {
      guess.consigneeEmail = header;
      continue;
    }
    if (!guess.consigneeName && NAME_SYNONYMS.some((s) => normalized.includes(s))) {
      guess.consigneeName = header;
      continue;
    }
    if (!guess.templateType && TEMPLATE_SYNONYMS.some((s) => normalized.includes(s))) {
      guess.templateType = header;
      continue;
    }
    if (!guess.mawb && MAWB_SYNONYMS.some((s) => normalized.includes(s))) {
      guess.mawb = header;
      continue;
    }
    if (!guess.igm && IGM_SYNONYMS.some((s) => normalized.includes(s))) {
      guess.igm = header;
      continue;
    }
    if (!guess.flight && FLIGHT_SYNONYMS.some((s) => normalized.includes(s))) {
      guess.flight = header;
      continue;
    }
    if (!guess.origin && ORIGIN_SYNONYMS.some((s) => normalized.includes(s))) {
      guess.origin = header;
      continue;
    }
    if (!guess.dest && DEST_SYNONYMS.some((s) => normalized.includes(s))) {
      guess.dest = header;
      continue;
    }
    if (!guess.hsn && HSN_SYNONYMS.some((s) => normalized.includes(s))) {
      guess.hsn = header;
      continue;
    }
    if (!guess.invoiceValue && INVOICE_VALUE_SYNONYMS.some((s) => normalized.includes(s))) {
      guess.invoiceValue = header;
      continue;
    }
    if (!guess.pieces && PIECES_SYNONYMS.some((s) => normalized.includes(s))) {
      guess.pieces = header;
      continue;
    }
    if (!guess.weight && WEIGHT_SYNONYMS.some((s) => normalized.includes(s))) {
      guess.weight = header;
    }
  }

  return guess;
}

/** Auto-detect columns for TP Hold sheet */
export function guessTpHoldColumnMapping(headers: string[]): Record<string, string> {
  const guess: Record<string, string> = {};

  for (const header of headers) {
    const normalized = normalize(header);
    if (!guess.awb && (normalized === "awb" || normalized.includes("awb"))) {
      guess.awb = header;
      continue;
    }
    if (!guess.tpReason && TP_REASON_SYNONYMS.some((s) => normalized.includes(s))) {
      guess.tpReason = header;
      continue;
    }
    if (!guess.tpStatus && TP_STATUS_SYNONYMS.some((s) => normalized.includes(s))) {
      guess.tpStatus = header;
      continue;
    }
    if (!guess.tpArrivalSource && TP_ARRIVAL_SOURCE_SYNONYMS.some((s) => normalized.includes(s))) {
      guess.tpArrivalSource = header;
      continue;
    }
    if (!guess.tpArrivalDate && TP_ARRIVAL_DATE_SYNONYMS.some((s) => normalized.includes(s))) {
      guess.tpArrivalDate = header;
      continue;
    }
    if (!guess.origin && ORIGIN_SYNONYMS.some((s) => normalized.includes(s))) {
      guess.origin = header;
      continue;
    }
    if (!guess.dest && DEST_SYNONYMS.some((s) => normalized.includes(s))) {
      guess.dest = header;
      continue;
    }
    if (!guess.pieces && PIECES_SYNONYMS.some((s) => normalized.includes(s))) {
      guess.pieces = header;
    }
  }

  return guess;
}
