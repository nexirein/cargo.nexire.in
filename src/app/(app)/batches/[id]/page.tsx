import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const STATUS_TO_STEP: Record<string, string> = {
  draft: "mapping",
  validating: "mapping",
  failed: "mapping",
  ready: "attachments",
  converting: "convert",
  queued: "preview",
  sending: "send",
  partially_sent: "send",
  completed: "summary",
  archived: "summary",
};

// Bare /batches/:id has no UI of its own — it just resumes the wizard at
// whichever step the batch's status implies, so a link to a batch always
// lands somewhere useful regardless of where it was left off.
export default async function BatchRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: batch } = await supabase
    .from("batch_runs")
    .select("status")
    .eq("id", id)
    .maybeSingle();

  if (!batch) {
    notFound();
  }

  redirect(`/batches/${id}/${STATUS_TO_STEP[batch.status] ?? "preview"}`);
}
