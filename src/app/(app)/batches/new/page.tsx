import { createClient } from "@/lib/supabase/server";
import { suggestBatchName } from "@/lib/batches/naming";
import { createBatch } from "./actions";

export default async function NewBatchPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const { data: mailboxes } = await supabase
    .from("mailbox_configs")
    .select("id, display_name, operational_mailbox")
    .eq("is_active", true)
    .order("display_name", { ascending: true });

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold text-slate-900">Create batch</h1>
      <p className="mt-1 text-sm text-slate-500">
        Start a new pre-alert run. You&apos;ll upload the Excel sheet and
        invoices on the next step.
      </p>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      {(mailboxes ?? []).length === 0 ? (
        <p className="mt-6 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
          No active mailboxes are configured yet. Ask an admin to set one up,
          or configure one from your own account setup.
        </p>
      ) : null}

      <form action={createBatch} className="mt-6 space-y-5">
        <div>
          <label
            htmlFor="runName"
            className="block text-sm font-medium text-slate-700"
          >
            Run name
          </label>
          <input
            id="runName"
            name="runName"
            type="text"
            required
            defaultValue={suggestBatchName()}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          />
          <p className="mt-1 text-xs text-slate-400">
            Suggested format: PREALERT-YYYY-MM-DD-AM/PM/SEQ01 — feel free to
            change it.
          </p>
        </div>

        <div>
          <label
            htmlFor="mailboxConfigId"
            className="block text-sm font-medium text-slate-700"
          >
            Send from mailbox
          </label>
          <select
            id="mailboxConfigId"
            name="mailboxConfigId"
            required
            className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
          >
            <option value="">Select a mailbox…</option>
            {(mailboxes ?? []).map((mailbox) => (
              <option key={mailbox.id} value={mailbox.id}>
                {mailbox.display_name} ({mailbox.operational_mailbox})
              </option>
            ))}
          </select>
        </div>

        <fieldset>
          <legend className="block text-sm font-medium text-slate-700">
            Sub-batch size
          </legend>
          <p className="mt-1 text-xs text-slate-400">
            Rows are split into sub-batches for progress tracking and
            retries.
          </p>
          <div className="mt-2 flex gap-4">
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="subBatchSize"
                value={25}
                defaultChecked
                className="text-slate-900 focus:ring-slate-500"
              />
              25 per sub-batch (default)
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="subBatchSize"
                value={50}
                className="text-slate-900 focus:ring-slate-500"
              />
              50 per sub-batch
            </label>
          </div>
        </fieldset>

        <button
          type="submit"
          className="w-full rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          Create and continue
        </button>
      </form>
    </div>
  );
}
