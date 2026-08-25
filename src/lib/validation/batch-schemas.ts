import { z } from "zod";
import type { MappedRow } from "@/lib/excel/map-rows";

export const createBatchSchema = z.object({
  runName: z
    .string()
    .trim()
    .min(3, "Name must be at least 3 characters.")
    .max(120, "Name must be under 120 characters."),
  mailboxConfigId: z.string().uuid("Select a mailbox."),
  subBatchSize: z.union([z.literal(25), z.literal(50)]).default(25),
  templateId: z.string().uuid("Select a template.").optional(),
  phase: z.enum(["pre_alert", "post_arrival", "tp_hold"]).default("pre_alert"),
  preAlertType: z.enum(["u_bond", "consol"]).default("u_bond"),
});

export const columnMappingSchema = z.object({
  awb: z.string().min(1, "Select the AWB column."),
  consigneeEmail: z.string().min(1, "Select the consignee email column."),
  consigneeName: z.string().optional(),
  templateType: z.string().optional(),
  fedexBroker: z.string().optional(),
});

const emailSchema = z.string().trim().email();

export interface RowValidationIssue {
  rowNumber: number;
  field: "awb" | "consigneeEmail";
  severity: "error" | "warning";
  message: string;
}

export interface EmailStatus {
  rowNumber: number;
  awb: string;
  rawValue: string;
  extracted: string[];
  validCount: number;
  hasIssue: boolean;
}

export interface RowValidationResult {
  validRows: MappedRow[];
  issues: RowValidationIssue[];
  emailStatuses: EmailStatus[];
}

function extractEmails(raw: string): string[] {
  const parts = raw.split(";").map((s) => s.trim()).filter(Boolean);
  const emails: string[] = [];
  for (const part of parts) {
    const angleMatch = part.match(/<([^>]+)>/);
    if (angleMatch) {
      const e = angleMatch[1].trim();
      if (e) emails.push(e);
    } else {
      emails.push(part);
    }
  }
  return emails;
}

/**
 * In-file validation only (duplicate AWB within this sheet, malformed
 * email). Cross-batch duplicate detection (has this AWB already been sent
 * in another recent batch?) needs a DB query and is layered on top by the
 * validate route handler, which merges its own warning-level issues into
 * this result's `issues` array.
 */
export function validateMappedRows(rows: MappedRow[]): RowValidationResult {
  const issues: RowValidationIssue[] = [];
  const emailStatuses: EmailStatus[] = [];
  const firstSeenAtRow = new Map<string, number>();

  for (const row of rows) {
    let awbIssue = false;
    if (!row.awb) {
      issues.push({
        rowNumber: row.rowNumber,
        field: "awb",
        severity: "error",
        message: "AWB is missing.",
      });
      awbIssue = true;
    } else {
      const firstRow = firstSeenAtRow.get(row.awb);
      if (firstRow !== undefined) {
        issues.push({
          rowNumber: row.rowNumber,
          field: "awb",
          severity: "error",
          message: `Duplicate AWB — already appears on row ${firstRow}.`,
        });
        awbIssue = true;
      } else {
        firstSeenAtRow.set(row.awb, row.rowNumber);
      }
    }

    const rawEmail = row.consigneeEmail ?? "";
    const extracted = extractEmails(rawEmail);
    const validExtracted = extracted.filter((e) => emailSchema.safeParse(e).success);
    const hasIssue = validExtracted.length === 0;

    emailStatuses.push({
      rowNumber: row.rowNumber,
      awb: row.awb || "(missing)",
      rawValue: rawEmail,
      extracted,
      validCount: validExtracted.length,
      hasIssue,
    });

    if (hasIssue && !awbIssue) {
      if (!rawEmail) {
        issues.push({
          rowNumber: row.rowNumber,
          field: "consigneeEmail",
          severity: "error",
          message: "Consignee email is missing.",
        });
      } else {
        issues.push({
          rowNumber: row.rowNumber,
          field: "consigneeEmail",
          severity: "error",
          message: `No valid email addresses found in "${rawEmail.slice(0, 80)}${rawEmail.length > 80 ? "..." : ""}".`,
        });
      }
    }
  }

  const errorRows = new Set(
    issues.filter((i) => i.severity === "error").map((i) => i.rowNumber),
  );
  const validRows = rows.filter((row) => !errorRows.has(row.rowNumber));

  return { validRows, issues, emailStatuses };
}
