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
    .select("id, run_name, phase, pre_alert_type")
    .eq("id", id)
    .maybeSingle();

  if (!batch) {
    notFound();
  }

  const phaseLabels: Record<string, string> = {
    pre_alert: "Upload the pre-alert Excel sheet, then map its columns.",
    post_arrival: "Upload the post-arrival Excel sheet (MAWB, IGM, etc).",
    tp_hold: "Upload the TP Hold sheet from the IGM team.",
  };

  return (
    <div>
      <WizardSteps current="mapping" phase={batch.phase ?? "pre_alert"} preAlertType={batch.pre_alert_type} />
      <h1 className="mt-4 text-2xl font-semibold text-slate-900">
        {batch.run_name}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        {phaseLabels[batch.phase ?? "pre_alert"]}
      </p>
      <MappingWizard batchRunId={id} phase={batch.phase ?? "pre_alert"} preAlertType={batch.pre_alert_type} />
    </div>
  );
}
