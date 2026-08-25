import { describe, expect, it } from "vitest";
import { validateMappedRows } from "./batch-schemas";
import type { MappedRow } from "@/lib/excel/map-rows";

function row(overrides: Partial<MappedRow>): MappedRow {
  return {
    rowNumber: 2,
    awb: "176-12345678",
    consigneeEmail: "consignee@example.com",
    consigneeName: null,
    templateType: null,
    fedexBroker: null,
    shipmentData: {},
    ...overrides,
  } as MappedRow;
}

describe("validateMappedRows", () => {
  it("passes a clean row through with no issues", () => {
    const { validRows, issues } = validateMappedRows([row({})]);
    expect(validRows).toHaveLength(1);
    expect(issues).toHaveLength(0);
  });

  it("flags a missing AWB as an error and excludes the row", () => {
    const { validRows, issues } = validateMappedRows([row({ awb: "" })]);
    expect(validRows).toHaveLength(0);
    expect(issues).toEqual([
      expect.objectContaining({ field: "awb", severity: "error" }),
    ]);
  });

  it("flags the second occurrence of a duplicate AWB, not the first", () => {
    const rows = [
      row({ rowNumber: 2, awb: "DUP" }),
      row({ rowNumber: 3, awb: "DUP" }),
    ];
    const { validRows, issues } = validateMappedRows(rows);

    expect(validRows).toHaveLength(1);
    expect(validRows[0].rowNumber).toBe(2);
    expect(issues).toEqual([
      expect.objectContaining({
        rowNumber: 3,
        field: "awb",
        severity: "error",
      }),
    ]);
  });

  it("flags a missing or malformed email as an error", () => {
    const missing = validateMappedRows([row({ consigneeEmail: "" })]);
    expect(missing.issues).toEqual([
      expect.objectContaining({ field: "consigneeEmail", severity: "error" }),
    ]);

    const malformed = validateMappedRows([
      row({ consigneeEmail: "not-an-email" }),
    ]);
    expect(malformed.issues).toEqual([
      expect.objectContaining({ field: "consigneeEmail", severity: "error" }),
    ]);
  });

  it("excludes a row from validRows if it has any error", () => {
    const { validRows } = validateMappedRows([
      row({ awb: "", consigneeEmail: "" }),
      row({ rowNumber: 3, awb: "OK-AWB" }),
    ]);
    expect(validRows).toHaveLength(1);
    expect(validRows[0].awb).toBe("OK-AWB");
  });
});
