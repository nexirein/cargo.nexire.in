import { describe, expect, it } from "vitest";
import { guessColumnMapping, mapRows } from "./map-rows";
import type { ParsedExcel } from "./parse";

describe("guessColumnMapping", () => {
  it("finds AWB, email, and name columns under common header names", () => {
    const guess = guessColumnMapping([
      "AWB No",
      "Consignee Email",
      "Consignee Name",
      "Weight",
    ]);
    expect(guess.awb).toBe("AWB No");
    expect(guess.consigneeEmail).toBe("Consignee Email");
    expect(guess.consigneeName).toBe("Consignee Name");
  });

  it("leaves fields unset when nothing matches", () => {
    const guess = guessColumnMapping(["Column A", "Column B"]);
    expect(guess.awb).toBeUndefined();
    expect(guess.consigneeEmail).toBeUndefined();
  });
});

describe("mapRows", () => {
  const parsed: ParsedExcel = {
    headers: ["AWB No", "Email", "Name", "Weight"],
    rows: [
      {
        rowNumber: 2,
        values: {
          "AWB No": "176-12345678",
          Email: "consignee@example.com",
          Name: "Jane Doe",
          Weight: "42kg",
        },
      },
    ],
  };

  it("maps canonical fields and keeps everything else in shipmentData", () => {
    const [row] = mapRows(parsed, {
      awb: "AWB No",
      consigneeEmail: "Email",
      consigneeName: "Name",
    });

    expect(row.awb).toBe("176-12345678");
    expect(row.consigneeEmail).toBe("consignee@example.com");
    expect(row.consigneeName).toBe("Jane Doe");
    expect(row.shipmentData).toEqual({ Weight: "42kg" });
    expect(row.shipmentData).not.toHaveProperty("AWB No");
  });

  it("leaves consigneeName null when no name column is mapped", () => {
    const [row] = mapRows(parsed, { awb: "AWB No", consigneeEmail: "Email" });
    expect(row.consigneeName).toBeNull();
    expect(row.shipmentData).toHaveProperty("Name");
  });
});
