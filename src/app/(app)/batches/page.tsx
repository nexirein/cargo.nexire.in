import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/ui/status-badge";

export default async function BatchesPage() {
  const supabase = await createClient();
  const { data: batches } = await supabase
    .from("batch_runs")
    .select(
      "id, run_name, run_date, status, total_rows, total_sub_batches, sent_count, failed_count, created_at, mailbox_configs(display_name)",
    )
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Batches</h1>
          <p className="mt-1 text-sm text-slate-500">
            Every pre-alert run, from upload through send.
          </p>
        </div>
        <Link
          href="/batches/new"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Create batch
        </Link>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Run name</th>
              <th className="px-4 py-3">Mailbox</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Rows</th>
              <th className="px-4 py-3">Sub-batches</th>
              <th className="px-4 py-3">Sent / Failed</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(batches ?? []).map((row) => {
              const mailbox = Array.isArray(row.mailbox_configs)
                ? row.mailbox_configs[0]
                : row.mailbox_configs;
              return (
                <tr key={row.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <Link href={`/batches/${row.id}`} className="hover:underline">
                      {row.run_name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {mailbox?.display_name ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={row.status} />
                  </td>
                  <td className="px-4 py-3 text-slate-500">{row.total_rows}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {row.total_sub_batches}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {row.sent_count} / {row.failed_count}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-400">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                </tr>
              );
            })}
            {(batches ?? []).length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-10 text-center text-sm text-slate-400"
                >
                  No batches yet. Create your first pre-alert run to get
                  started.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
