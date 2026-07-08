export interface SubBatchChunk<T> {
  subBatchIndex: number;
  items: T[];
}

export function chunkIntoSubBatches<T>(
  items: T[],
  size: 25 | 50,
): SubBatchChunk<T>[] {
  if (size <= 0) {
    throw new Error("Sub-batch size must be positive.");
  }

  const chunks: SubBatchChunk<T>[] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push({
      subBatchIndex: chunks.length + 1,
      items: items.slice(i, i + size),
    });
  }
  return chunks;
}
