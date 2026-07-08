/**
 * Matches uploaded invoice files to AWBs by filename. Looks for the AWB
 * string anywhere in the filename (case-insensitive, punctuation-agnostic),
 * which is the common convention for exported invoice archives (e.g.
 * `176-12345678.tif`, `AWB_176-12345678_invoice.pdf`).
 */
export interface AttachmentMatch {
  fileName: string;
  awb: string | null;
}

export function matchAttachmentsToAwbs(
  fileNames: string[],
  knownAwbs: string[],
): AttachmentMatch[] {
  const normalizedAwbs = knownAwbs
    .map((awb) => ({ awb, normalized: normalizeForMatch(awb) }))
    .filter((entry) => entry.normalized.length > 0);

  return fileNames.map((fileName) => {
    const normalizedFile = normalizeForMatch(fileName);
    const match = normalizedAwbs.find((entry) =>
      normalizedFile.includes(entry.normalized),
    );
    return { fileName, awb: match?.awb ?? null };
  });
}

function normalizeForMatch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}
