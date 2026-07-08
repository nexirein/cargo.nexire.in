const STATUS_STYLES: Record<string, string> = {
  draft: "bg-slate-100 text-slate-500",
  validating: "bg-amber-50 text-amber-700",
  ready: "bg-sky-50 text-sky-700",
  converting: "bg-amber-50 text-amber-700",
  queued: "bg-sky-50 text-sky-700",
  sending: "bg-amber-50 text-amber-700",
  partially_sent: "bg-amber-50 text-amber-700",
  completed: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700",
  archived: "bg-slate-100 text-slate-400",
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-slate-100 text-slate-500";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${style}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}
