import { redirect } from "next/navigation";

const STEP_ORDER_PRE_ALERT = ["mapping", "validate", "review", "attachments", "preview", "send", "summary"] as const;
const STEP_ORDER_POST_ARRIVAL = ["mapping", "validate", "preview", "send", "summary"] as const;
const STEP_ORDER_TP_HOLD = ["mapping", "validate", "summary"] as const;

type Step = string;

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
    ready: "review", converting: "attachments",
    queued: "send", sending: "send", partially_sent: "send",
    completed: "summary", archived: "summary",
  };
  return MAP[status] ?? "mapping";
}

export function assertStep(
  batchId: string,
  currentStep: Step,
  status: string,
  phase: string,
  completedSteps?: Step[],
): void {
  const expected = resolveStep(status, phase);

  // If the expected step matches, allow it
  if (expected === currentStep) return;

  // For pre_alert "ready" status, multiple steps share the same status.
  // Allow review, attachments (they all have status "ready")
  if (phase === "pre_alert" && status === "ready") {
    const allowed: Step[] = ["review", "attachments", "preview"];
    if (allowed.includes(currentStep)) return;
  }

  // Allow validate page even when ready (user might be returning to check errors)
  if (currentStep === "validate" && status === "ready") return;

  redirect(`/batches/${batchId}/${expected}`);
}
