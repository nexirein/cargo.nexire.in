"use client";

import { useRouter } from "next/navigation";

const STATUS_OPTIONS = [
  { value: "", label: "Default (AI-unhandled)" },
  { value: "reply_received", label: "Reply Received" },
  { value: "documents_provided", label: "Docs Provided" },
  { value: "boe_filed", label: "BOE Filed" },
  { value: "human_review", label: "Human Review" },
  { value: "escalated", label: "Escalated" },
  { value: "awaiting_reply", label: "Awaiting Reply" },
  { value: "assessment_pending", label: "Assessment Pending" },
  { value: "duty_assessed", label: "Duty Assessed" },
  { value: "out_of_charge", label: "Out of Charge" },
  { value: "do_ready", label: "DO Ready" },
];

const ISSUE_OPTIONS = [
  { value: "", label: "All issues" },
  { value: "unclear", label: "Unclear" },
  { value: "status_query", label: "Status Query" },
  { value: "checklist_request", label: "Checklist Request" },
  { value: "reminder_needed", label: "Reminder Needed" },
  { value: "special_case", label: "Special Case" },
  { value: "escalation", label: "Escalation" },
  { value: "info_only", label: "Info Only" },
  { value: "payment_received", label: "Payment Received" },
  { value: "pdf_invoice_request", label: "Invoice Request" },
  { value: "no_action", label: "No Action" },
];

const URGENCY_OPTIONS = [
  { value: "", label: "All urgency" },
  { value: "urgent", label: "Urgent" },
  { value: "normal", label: "Normal" },
  { value: "low", label: "Low" },
];

interface Props {
  status?: string;
  issue_type?: string;
  urgency?: string;
  q?: string;
  clearance_type?: string;
  batch_id?: string;
  phase?: string;
  allBatches?: { id: string; run_name: string; run_date: string }[];
  clearanceTypes?: { value: string; label: string }[];
}

export function ReviewFilters({
  status: sf,
  issue_type,
  urgency,
  q,
  clearance_type: ct,
  batch_id,
  phase,
  allBatches,
  clearanceTypes,
}: Props) {
  const router = useRouter();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const params = new URLSearchParams();
    for (const [key, val] of fd.entries()) {
      if (val) params.set(key, val.toString());
    }
    if (phase) params.set("phase", phase);
    const qs = params.toString();
    router.push(qs ? `/human-review?${qs}` : "/human-review");
  }

  const hasFilters = !!(sf || issue_type || urgency || q || ct || batch_id);

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-2">
      <input
        name="q"
        defaultValue={q ?? ""}
        placeholder="Search AWB…"
        className="h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-sidebar-primary"
      />
      <select name="status" defaultValue={sf ?? ""}
        className="h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-sidebar-primary">
        {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <select name="issue_type" defaultValue={issue_type ?? ""}
        className="h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-sidebar-primary">
        {ISSUE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <select name="urgency" defaultValue={urgency ?? ""}
        className="h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-sidebar-primary">
        {URGENCY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <select name="clearance_type" defaultValue={ct ?? ""}
        className="h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-sidebar-primary">
        <option value="">All clearance</option>
        {clearanceTypes?.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>
      <select name="batch_id" defaultValue={batch_id ?? ""}
        className="h-9 rounded-lg border border-border bg-card px-3 text-sm outline-none focus:border-sidebar-primary">
        <option value="">All batches</option>
        {allBatches?.map((b) => <option key={b.id} value={b.id}>{b.run_name}</option>)}
      </select>
      <button type="submit"
        className="h-9 rounded-lg bg-sidebar-primary px-4 text-sm font-medium text-white transition hover:bg-sidebar-primary/90">
        Filter
      </button>
      {hasFilters ? (
        <a href={phase ? `/human-review?phase=${phase}` : "/human-review"} className="text-xs text-muted-foreground hover:text-foreground">
          Clear
        </a>
      ) : null}
    </form>
  );
}
