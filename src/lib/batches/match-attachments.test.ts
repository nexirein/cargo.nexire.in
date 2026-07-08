import { describe, expect, it } from "vitest";
import { matchAttachmentsToAwbs } from "./match-attachments";

describe("matchAttachmentsToAwbs", () => {
  const knownAwbs = ["176-12345678", "176-87654321"];

  it("matches a filename that contains the AWB verbatim", () => {
    const [result] = matchAttachmentsToAwbs(["176-12345678.tif"], knownAwbs);
    expect(result.awb).toBe("176-12345678");
  });

  it("matches regardless of punctuation/case differences", () => {
    const [result] = matchAttachmentsToAwbs(
      ["AWB_176_12345678_invoice.PDF"],
      knownAwbs,
    );
    expect(result.awb).toBe("176-12345678");
  });

  it("returns null when no AWB appears in the filename", () => {
    const [result] = matchAttachmentsToAwbs(["random-scan.pdf"], knownAwbs);
    expect(result.awb).toBeNull();
  });

  it("preserves file order across mixed matches", () => {
    const results = matchAttachmentsToAwbs(
      ["176-87654321.tif", "unmatched.pdf", "176-12345678.pdf"],
      knownAwbs,
    );
    expect(results.map((r) => r.awb)).toEqual([
      "176-87654321",
      null,
      "176-12345678",
    ]);
  });
});
