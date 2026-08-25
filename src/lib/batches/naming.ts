// Suggests a batch name in the spec's recommended format.
// Purely a prefill default — the user can always type their own name instead.
export function suggestBatchName(date: Date = new Date(), preAlertType?: string): string {
  const datePart = date.toISOString().slice(0, 10);
  const isMorning = date.getHours() < 12;
  const prefix = preAlertType === "consol" ? "CONSOL" : "UBOND";
  return `${prefix}-${datePart}-${isMorning ? "AM" : "PM"}`;
}

export function todayIsoDate(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
