import "server-only";

const AWB_PATTERNS = [
  /\b\d{12,15}\b/g,
  /AWB[:\s]*(\d{12,15})/gi,
  /air.?way.?bill[:\s]*(\d{12,15})/gi,
  /(?:shipment|tracking)[:\s#]*(\d{12,15})/gi,
];

export function extractAwb(text: string): string | null {
  for (const pattern of AWB_PATTERNS) {
    const matches = text.match(pattern);
    if (matches && matches.length > 0) {
      const raw = matches[0];
      const digits = raw.replace(/\D/g, "");
      if (digits.length >= 12 && digits.length <= 15) {
        return digits;
      }
    }
  }
  return null;
}

export function extractAwbs(text: string): string[] {
  const found = new Set<string>();
  for (const pattern of AWB_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      for (const match of matches) {
        const digits = match.replace(/\D/g, "");
        if (digits.length >= 12 && digits.length <= 15) {
          found.add(digits);
        }
      }
    }
  }
  return Array.from(found);
}
