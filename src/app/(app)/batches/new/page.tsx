import { createClient } from "@/lib/supabase/server";
import { suggestBatchName } from "@/lib/batches/naming";
import { BatchForm } from "./batch-form";

export default async function NewBatchPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await createClient();
  const [mailboxesResult, templatesResult] = await Promise.all([
    supabase
      .from("mailbox_configs")
      .select("id, display_name, operational_mailbox")
      .eq("is_active", true)
      .order("display_name", { ascending: true }),
    supabase
      .from("templates")
      .select("id, name, type")
      .eq("is_active", true)
      .order("name"),
  ]);
  const mailboxes = mailboxesResult.data ?? [];
  const templates = templatesResult.data ?? [];

  return (
    <div className="mx-auto max-w-xl">
      <h1 className="text-2xl font-semibold text-slate-900">Create batch</h1>
      <p className="mt-1 text-sm text-slate-500">
        Start a new batch run. You&apos;ll upload the Excel sheet on the next step.
      </p>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      {mailboxes.length === 0 ? (
        <p className="mt-6 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-700">
          No active mailboxes are configured yet. Ask an admin to set one up,
          or configure one from your own account setup.
        </p>
      ) : null}

      <BatchForm
        mailboxes={mailboxes}
        templates={templates}
        initialName={suggestBatchName()}
      />
    </div>
  );
}
