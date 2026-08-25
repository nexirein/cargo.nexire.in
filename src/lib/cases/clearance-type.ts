export const CLEARANCE_TYPES = [
  { value: "", label: "All types" },
  { value: "nfbrk", label: "NFBRK" },
  { value: "febrk", label: "FEBRK (unresolved)" },
  { value: "febrk-jeena", label: "FEBRK-Jeena" },
  { value: "febrk-sunimpex", label: "FEBRK-Sunimpex" },
  { value: "calling", label: "Calling" },
  { value: "hold", label: "Hold" },
] as const;

export const CLEARANCE_DISPLAY: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  nfbrk: { dot: "bg-blue-400", bg: "bg-blue-50", text: "text-blue-700", label: "NFBRK" },
  febrk: { dot: "bg-orange-400", bg: "bg-orange-50", text: "text-orange-700", label: "FEBRK" },
  "febrk-jeena": { dot: "bg-violet-400", bg: "bg-violet-50", text: "text-violet-700", label: "FEBRK-Jeena" },
  "febrk-sunimpex": { dot: "bg-purple-400", bg: "bg-purple-50", text: "text-purple-700", label: "FEBRK-Sunimpex" },
  calling: { dot: "bg-amber-400", bg: "bg-amber-50", text: "text-amber-700", label: "Calling" },
  hold: { dot: "bg-slate-400", bg: "bg-slate-100", text: "text-slate-500", label: "Hold" },
};

export function resolveClearanceType(value: string): string | null {
  const upper = value.toUpperCase().trim();
  if (upper === "CALLING" || upper.startsWith("CALLING")) return "calling";
  if (upper === "HOLD" || upper.startsWith("HOLD")) return "hold";
  if (upper.startsWith("FEBRK")) {
    if (upper.includes("SUNIMPEX")) return "febrk-sunimpex";
    if (upper.includes("JEENA")) return "febrk-jeena";
    return "febrk";
  }
  if (upper === "NFBRK" || upper.startsWith("NFBRK")) return "nfbrk";
  return null;
}

export function isFebrk(ct: string | null): boolean {
  return ct === "febrk-jeena" || ct === "febrk-sunimpex";
}

export function isNfbrk(ct: string | null): boolean {
  return ct === "nfbrk";
}

export function isCalling(ct: string | null): boolean {
  return ct === "calling";
}

export function isHold(ct: string | null): boolean {
  return ct === "hold";
}
