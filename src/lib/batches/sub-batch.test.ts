import { describe, expect, it } from "vitest";
import { chunkIntoSubBatches } from "./sub-batch";

describe("chunkIntoSubBatches", () => {
  it("splits evenly divisible input into equal chunks", () => {
    const items = Array.from({ length: 50 }, (_, i) => i);
    const chunks = chunkIntoSubBatches(items, 25);

    expect(chunks).toHaveLength(2);
    expect(chunks[0].subBatchIndex).toBe(1);
    expect(chunks[0].items).toHaveLength(25);
    expect(chunks[1].subBatchIndex).toBe(2);
    expect(chunks[1].items).toHaveLength(25);
  });

  it("puts the remainder in a smaller final chunk", () => {
    const items = Array.from({ length: 130 }, (_, i) => i);
    const chunks = chunkIntoSubBatches(items, 25);

    expect(chunks).toHaveLength(6);
    expect(chunks.slice(0, 5).every((c) => c.items.length === 25)).toBe(true);
    expect(chunks[5].items).toHaveLength(5);
  });

  it("returns an empty array for no items", () => {
    expect(chunkIntoSubBatches([], 25)).toEqual([]);
  });

  it("rejects a non-positive size", () => {
    expect(() => chunkIntoSubBatches([1, 2, 3], 0 as unknown as 25)).toThrow();
  });
});
