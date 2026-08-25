import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function resolveStep(status: string, phase: string): string {
  if (phase === "tp_hold") {
    if (["draft", "validating", "failed"].includes(status)) return "mapping";
    return "summary";
  }
  if (phase === "post_arrival") {
    if (["draft", "validating", "failed"].includes(status)) return "mapping";
    if (status === "ready" || status === "converting") return "preview";
    if (["queued", "sending", "partially_sent"].includes(status)) return "send";
    return "summary";
  }
  const MAP: Record<string, string> = {
    draft: "mapping", validating: "mapping", failed: "mapping",
    ready: "review", converting: "convert",
    queued: "send", sending: "send", partially_sent: "send",
    completed: "summary", archived: "summary",
  };
  return MAP[status] ?? "preview";
}

export default async function BatchRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: batch } = await supabase
    .from("batch_runs")
    .select("status, phase")
    .eq("id", id)
    .maybeSingle();

  if (!batch) {
    notFound();
  }

  redirect(`/batches/${id}/${resolveStep(batch.status, batch.phase ?? "pre_alert")}`);
}
