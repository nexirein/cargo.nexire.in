import { CLEARANCE_DISPLAY } from "@/lib/cases/clearance-type";

export interface AutofillSummaryRow {
  rowNumber: number;
  awb: string;
  companyName: string;
  clearanceType: string | null;
  broker: string | null;
  email: string | null;
  source: string;
  callReasons: string[];
}

function sourceBadge(src: string) {
  if (src.includes("fuzzy")) return { bg: "bg-indigo-50", text: "text-indigo-700", label: "Fuzzy Match" };
  if (src.includes("broker")) return { bg: "bg-violet-50", text: "text-violet-700", label: "Broker Rule" };
  if (src.includes("master_db")) return { bg: "bg-sky-50", text: "text-sky-700", label: "Master DB" };
  if (src.includes("excel")) return { bg: "bg-emerald-50", text: "text-emerald-700", label: "Excel" };
  if (src.includes("rule")) return { bg: "bg-amber-50", text: "text-amber-700", label: "Rule" };
  if (src.includes("remarks") || src.includes("mail_id") || src.includes("email")) return { bg: "bg-cyan-50", text: "text-cyan-700", label: "Email" };
  return { bg: "bg-slate-100", text: "text-slate-500", label: src || "Not resolved" };
}

function autoFilledCount(rows: AutofillSummaryRow[]): { clearance: number; broker: number; email: number } {
  let clearance = 0;
  let broker = 0;
  let email = 0;
  for (const r of rows) {
    if (r.clearanceType) clearance++;
    if (r.broker) broker++;
    if (r.email) email++;
  }
  return { clearance, broker, email };
}

export function AutofillSummaryPanel({ rows }: { rows: AutofillSummaryRow[] }) {
  if (rows.length === 0) return null;

  const counts = autoFilledCount(rows);

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">
            Auto-fill summary ({rows.length} rows)
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Fields auto-filled from company name + master DB (exact or fuzzy match).
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-medium text-emerald-700">
            {counts.clearance} clearance
          </span>
          <span className="rounded-full bg-violet-50 px-2 py-0.5 font-medium text-violet-700">
            {counts.broker} broker
          </span>
          <span className="rounded-full bg-cyan-50 px-2 py-0.5 font-medium text-cyan-700">
            {counts.email} email
          </span>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Row</th>
              <th className="px-4 py-3">AWB</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Clearance</th>
              <th className="px-4 py-3">FedEx Broker</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const style = CLEARANCE_DISPLAY[r.clearanceType ?? ""];
              const sb = sourceBadge(r.source);
              const needsCall = r.callReasons.length > 0;
              return (
                <tr key={r.rowNumber} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-500">{r.rowNumber}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600">{r.awb}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{r.companyName}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${style?.bg ?? "bg-slate-100"} ${style?.text ?? "text-slate-600"}`}>
                      {style?.label ?? (r.clearanceType ?? "—")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.broker ? (
                      <span className="inline-flex items-center rounded-full bg-violet-50 px-2 py-0.5 text-xs font-medium text-violet-700">
                        {r.broker}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.email ? (
                      <span className="text-xs text-slate-600">{r.email}</span>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${sb.bg} ${sb.text}`}>
                        {sb.label}
                      </span>
                      {needsCall && (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          call: {r.callReasons.join(", ")}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}