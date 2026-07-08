import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WizardSteps } from "@/components/batches/wizard-steps";
import { ConversionRunner } from "./conversion-runner";

export default async function BatchConvertPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: batch } = await supabase
    .from("batch_runs")
    .select("id, run_name")
    .eq("id", id)
    .maybeSingle();

  if (!batch) {
    notFound();
  }

  const { data: items } = await supabase
    .from("batch_items")
    .select("awb")
    .eq("batch_run_id", id)
    .order("awb");

  return (
    <div>
      <WizardSteps current="convert" />
      <h1 className="mt-4 text-2xl font-semibold text-slate-900">
        {batch.run_name}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Convert TIFF invoices to PDF entirely in your browser — nothing
        uploads until conversion succeeds.
      </p>
      <ConversionRunner
        batchRunId={id}
        knownAwbs={(items ?? []).map((i) => i.awb)}
      />
      <div className="mt-6">
        <Link
          href={`/batches/${id}/attachments`}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← Back to attachments
        </Link>
      </div>
    </div>
  );
}
