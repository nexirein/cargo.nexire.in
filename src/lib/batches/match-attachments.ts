export interface AttachmentMatch {
  fileName: string;
  awb: string | null;
  strictMatch: boolean;
  error?: string;
}

/**
 * Matches uploaded invoice files to AWBs by filename.
 *
 * Loose mode (default): looks for the AWB string anywhere in the filename.
 *
 * Strict mode: filename without extension must equal the AWB exactly.
 * Non-matching files are returned with an error string.
 */
export function matchAttachmentsToAwbs(
  fileNames: string[],
  knownAwbs: string[],
  strict?: boolean,
): AttachmentMatch[] {
  const normalizedAwbs = knownAwbs
    .map((awb) => ({ awb, normalized: normalizeForMatch(awb) }))
    .filter((entry) => entry.normalized.length > 0);

  return fileNames.map((fileName) => {
    const nameWithoutExt = fileName.replace(/\.[^.]+$/, "");
    const normalizedFile = normalizeForMatch(fileName);
    const normalizedStripped = normalizeForMatch(nameWithoutExt);

    if (strict) {
      // Strict: stripped filename must equal one of the normalized AWBs
      const match = normalizedAwbs.find(
        (entry) => entry.normalized === normalizedStripped,
      );
      if (match) {
        return { fileName, awb: match.awb, strictMatch: true };
      }
      // Check if any AWB is contained within (fuzzy fallback with warning)
      const fuzzyMatch = normalizedAwbs.find((entry) =>
        normalizedFile.includes(entry.normalized),
      );
      if (fuzzyMatch) {
        return {
          fileName,
          awb: fuzzyMatch.awb,
          strictMatch: false,
          error: `Filename "${nameWithoutExt}" doesn't exactly match AWB "${fuzzyMatch.awb}"`,
        };
      }
      return {
        fileName,
        awb: null,
        strictMatch: false,
        error: `No AWB found in filename`,
      };
    }

    // Loose: AWB string found anywhere in filename
    const match = normalizedAwbs.find((entry) =>
      normalizedFile.includes(entry.normalized),
    );
    return {
      fileName,
      awb: match?.awb ?? null,
      strictMatch: !!match,
      error: match ? undefined : `No AWB found in filename`,
    };
  });
}

function normalizeForMatch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}
