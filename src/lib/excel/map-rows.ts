import type { ParsedExcel } from "./parse";

export interface ColumnMapping {
  awb: string;
  consigneeEmail: string;
  consigneeName?: string;
}

export interface MappedRow {
  rowNumber: number;
  awb: string;
  consigneeEmail: string;
  consigneeName: string | null;
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
        header === mapping.consigneeName
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
  "customer name",
  "customer",
  "notify party",
  "name",
];

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
    }
  }

  return guess;
}
