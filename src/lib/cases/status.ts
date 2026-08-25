export const CASE_STATUS_LABELS: Record<string, string> = {
  awaiting_reply: "Awaiting Reply",
  reply_received: "Reply Received",
  documents_provided: "Docs Provided",
  boe_filed: "BOE Filed",
  assessment_pending: "Assessment Pending",
  duty_assessed: "Duty Assessed",
  out_of_charge: "Out of Charge",
  do_ready: "DO Ready",
  do_collected: "DO Collected",
  human_review: "Human Review",
  escalated: "Escalated",
  closed: "Closed",
};

export const CASE_STATUS_DOT: Record<string, string> = {
  awaiting_reply: "bg-amber-400",
  reply_received: "bg-emerald-400",
  documents_provided: "bg-sky-400",
  boe_filed: "bg-blue-400",
  assessment_pending: "bg-amber-400",
  duty_assessed: "bg-violet-400",
  out_of_charge: "bg-emerald-500",
  do_ready: "bg-teal-400",
  do_collected: "bg-emerald-600",
  human_review: "bg-red-400",
  escalated: "bg-red-500",
  closed: "bg-slate-300",
};

export function statusLabel(s: string): string {
  return CASE_STATUS_LABELS[s] ?? s.replace(/_/g, " ");
}

export const FULL_CASE_STATUSES = [
  "awaiting_reply",
  "reply_received",
  "documents_provided",
  "boe_filed",
  "assessment_pending",
  "duty_assessed",
  "out_of_charge",
  "do_ready",
  "do_collected",
  "human_review",
  "escalated",
  "closed",
] as const;

export type CaseStatus = (typeof FULL_CASE_STATUSES)[number];
