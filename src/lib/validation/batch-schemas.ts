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
});

export const columnMappingSchema = z.object({
  awb: z.string().min(1, "Select the AWB column."),
  consigneeEmail: z.string().min(1, "Select the consignee email column."),
  consigneeName: z.string().optional(),
});

const emailSchema = z.string().trim().email();

export interface RowValidationIssue {
  rowNumber: number;
  field: "awb" | "consigneeEmail";
  severity: "error" | "warning";
  message: string;
}

export interface RowValidationResult {
  validRows: MappedRow[];
  issues: RowValidationIssue[];
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
  const firstSeenAtRow = new Map<string, number>();

  for (const row of rows) {
    if (!row.awb) {
      issues.push({
        rowNumber: row.rowNumber,
        field: "awb",
        severity: "error",
        message: "AWB is missing.",
      });
    } else {
      const firstRow = firstSeenAtRow.get(row.awb);
      if (firstRow !== undefined) {
        issues.push({
          rowNumber: row.rowNumber,
          field: "awb",
          severity: "error",
          message: `Duplicate AWB — already appears on row ${firstRow}.`,
        });
      } else {
        firstSeenAtRow.set(row.awb, row.rowNumber);
      }
    }

    const emailResult = row.consigneeEmail
      ? emailSchema.safeParse(row.consigneeEmail)
      : null;
    if (!row.consigneeEmail) {
      issues.push({
        rowNumber: row.rowNumber,
        field: "consigneeEmail",
        severity: "error",
        message: "Consignee email is missing.",
      });
    } else if (!emailResult?.success) {
      issues.push({
        rowNumber: row.rowNumber,
        field: "consigneeEmail",
        severity: "error",
        message: `"${row.consigneeEmail}" is not a valid email.`,
      });
    }
  }

  const errorRows = new Set(
    issues.filter((i) => i.severity === "error").map((i) => i.rowNumber),
  );
  const validRows = rows.filter((row) => !errorRows.has(row.rowNumber));

  return { validRows, issues };
}
