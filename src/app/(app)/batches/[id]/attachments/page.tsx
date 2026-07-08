import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WizardSteps } from "@/components/batches/wizard-steps";
import { AttachmentsUploader } from "./attachments-uploader";

export default async function BatchAttachmentsPage({
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
    .select("id, awb, consignee_name, attachment_status")
    .eq("batch_run_id", id)
    .order("awb");

  return (
    <div>
      <WizardSteps current="attachments" />
      <h1 className="mt-4 text-2xl font-semibold text-slate-900">
        {batch.run_name}
      </h1>
      <p className="mt-1 text-sm text-slate-500">
        Upload invoice files and match them to each AWB.
      </p>
      <AttachmentsUploader batchRunId={id} initialItems={items ?? []} />
    </div>
  );
}
