import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WizardSteps } from "@/components/batches/wizard-steps";
import { MappingWizard } from "./mapping-wizard";

export default async function BatchMappingPage({
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

  return (
    <div>
      <WizardSteps current="mapping" />
      <h1 className="mt-4 text-2xl font-semibold text-slate-900">
        {batch.run_name}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Upload the pre-alert Excel sheet, then map its columns to AWB and
        consignee email.
      </p>
      <MappingWizard batchRunId={id} />
    </div>
  );
}
