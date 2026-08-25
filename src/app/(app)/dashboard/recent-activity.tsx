import Link from "next/link";

interface CaseRow {
  id: string;
  awb: string;
  current_status: string;
  ownership_status: string;
  issue_type: string | null;
  urgency: string | null;
  updated_at: string;
  owner_user_id: string | null;
}

const STATUS_DOT: Record<string, string> = {
  awaiting_reply: "bg-amber-400",
  reply_received: "bg-emerald-400",
  claimed: "bg-sky-400",
  human_review: "bg-red-400",
  closed: "bg-slate-300",
  escalated: "bg-red-500",
};

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    awaiting_reply: "Awaiting Reply",
    reply_received: "Reply Received",
    claimed: "Claimed",
    human_review: "Human Review",
    closed: "Closed",
    escalated: "Escalated",
  };
  return map[status] ?? status.replace(/_/g, " ");
}

export function RecentActivity({ cases }: { cases: CaseRow[] }) {
  if (cases.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
        <p className="text-sm text-muted-foreground">
          No cases yet. Create a batch to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <table className="min-w-full divide-y divide-border">
        <thead>
          <tr className="bg-muted/50">
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              AWB
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Status
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Issue
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Urgency
            </th>
            <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Updated
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {cases.map((c) => (
            <tr
              key={c.id}
              className="transition-colors hover:bg-muted/30"
            >
              <td className="px-4 py-3">
                <Link
                  href={`/cases/${c.id}`}
                  className="font-mono text-sm font-medium text-sidebar-primary underline-offset-2 hover:underline"
                >
                  {c.awb}
                </Link>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      STATUS_DOT[c.current_status] ?? "bg-slate-300"
                    }`}
                  />
                  <span className="text-sm text-muted-foreground">
                    {statusLabel(c.current_status)}
                  </span>
                </div>
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {c.issue_type ?? "\u2014"}
              </td>
              <td className="px-4 py-3">
                {c.urgency ? (
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      c.urgency === "urgent"
                        ? "bg-red-50 text-red-700"
                        : c.urgency === "normal"
                          ? "bg-amber-50 text-amber-700"
                          : "bg-slate-50 text-slate-600"
                    }`}
                  >
                    {c.urgency}
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground/50">
                    \u2014
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-sm text-muted-foreground">
                {new Date(c.updated_at).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
