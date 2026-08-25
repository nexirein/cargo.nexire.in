import { CASE_STATUS_LABELS, CASE_STATUS_DOT } from "@/lib/cases/status";

export const STATUS_CONFIG: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  draft: { dot: "bg-slate-400", bg: "bg-slate-100", text: "text-slate-600", label: "Draft" },
  validating: { dot: "bg-amber-400", bg: "bg-amber-50", text: "text-amber-700", label: "Validating" },
  ready: { dot: "bg-sky-400", bg: "bg-sky-50", text: "text-sky-700", label: "Ready" },
  converting: { dot: "bg-amber-400", bg: "bg-amber-50", text: "text-amber-700", label: "Converting" },
  queued: { dot: "bg-sky-400", bg: "bg-sky-50", text: "text-sky-700", label: "Queued" },
  sending: { dot: "bg-[oklch(0.75_0.15_75)]", bg: "bg-[oklch(0.95_0.02_75)]", text: "text-[oklch(0.55_0.1_75)]", label: "Sending" },
  partially_sent: { dot: "bg-amber-400", bg: "bg-amber-50", text: "text-amber-700", label: "Partially Sent" },
  completed: { dot: "bg-emerald-400", bg: "bg-emerald-50", text: "text-emerald-700", label: "Completed" },
  failed: { dot: "bg-red-400", bg: "bg-red-50", text: "text-red-700", label: "Failed" },
  archived: { dot: "bg-slate-300", bg: "bg-slate-100", text: "text-slate-400", label: "Archived" },
  unassigned: { dot: "bg-slate-400", bg: "bg-slate-100", text: "text-slate-600", label: "Unassigned" },
  claimed: { dot: "bg-sky-400", bg: "bg-sky-50", text: "text-sky-700", label: "Claimed" },
  assigned: { dot: "bg-sky-400", bg: "bg-sky-50", text: "text-sky-700", label: "Assigned" },
  review: { dot: "bg-amber-400", bg: "bg-amber-50", text: "text-amber-700", label: "Review" },
  released: { dot: "bg-slate-300", bg: "bg-slate-100", text: "text-slate-400", label: "Released" },
  awaiting_reply: { dot: "bg-amber-400", bg: "bg-amber-50", text: "text-amber-700", label: "Awaiting Reply" },
  reply_received: { dot: "bg-emerald-400", bg: "bg-emerald-50", text: "text-emerald-700", label: "Reply Received" },
  documents_provided: { dot: "bg-sky-400", bg: "bg-sky-50", text: "text-sky-700", label: "Docs Provided" },
  boe_filed: { dot: "bg-blue-400", bg: "bg-blue-50", text: "text-blue-700", label: "BOE Filed" },
  assessment_pending: { dot: "bg-amber-400", bg: "bg-amber-50", text: "text-amber-700", label: "Assessment Pending" },
  duty_assessed: { dot: "bg-violet-400", bg: "bg-violet-50", text: "text-violet-700", label: "Duty Assessed" },
  out_of_charge: { dot: "bg-emerald-500", bg: "bg-emerald-50", text: "text-emerald-700", label: "Out of Charge" },
  do_ready: { dot: "bg-teal-400", bg: "bg-teal-50", text: "text-teal-700", label: "DO Ready" },
  do_collected: { dot: "bg-emerald-600", bg: "bg-emerald-50", text: "text-emerald-700", label: "DO Collected" },
  human_review: { dot: "bg-red-400", bg: "bg-red-50", text: "text-red-700", label: "Human Review" },
  escalated: { dot: "bg-red-500", bg: "bg-red-50", text: "text-red-700", label: "Escalated" },
  closed: { dot: "bg-emerald-400", bg: "bg-emerald-50", text: "text-emerald-700", label: "Closed" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status];
  if (!config) {
    return (
      <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
        {status.replace(/_/g, " ")}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full ${config.bg} ${config.text} px-2.5 py-0.5 text-xs font-medium`}
    >
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}
