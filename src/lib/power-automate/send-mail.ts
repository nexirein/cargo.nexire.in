import "server-only";

export interface PowerAutomateAttachment {
  name: string;
  contentType: string;
  /** Base64-encoded file bytes, embedded directly in the trigger payload. */
  contentBytes: string;
}

export interface TriggerSendInput {
  batchItemId: string;
  fromMailbox: string;
  to: string[];
  cc?: string[];
  subject: string;
  htmlBody: string;
  attachments?: PowerAutomateAttachment[];
}

/**
 * Fires the shared "send pre-alert" Power Automate flow (see
 * docs/POWER_AUTOMATE.md) and returns as soon as the flow accepts the
 * job — this is a hand-off, not a send confirmation. The flow responds
 * 202 immediately, then actually sends via Outlook in the background and
 * reports the real outcome asynchronously to
 * POST /api/power-automate/callback. Any non-2xx here means the flow
 * itself was unreachable/rejected the request, which is retryable by
 * QStash exactly like a network failure to Graph would be.
 */
export async function triggerPowerAutomateSend(
  input: TriggerSendInput,
): Promise<void> {
  const flowUrl = process.env.POWER_AUTOMATE_FLOW_URL;
  const callbackSecret = process.env.POWER_AUTOMATE_CALLBACK_SECRET;
  const appBaseUrl = process.env.APP_BASE_URL;

  if (!flowUrl || !callbackSecret || !appBaseUrl) {
    throw new Error(
      "POWER_AUTOMATE_FLOW_URL, POWER_AUTOMATE_CALLBACK_SECRET, and APP_BASE_URL must all be set for MAIL_DRIVER=power_automate.",
    );
  }

  const response = await fetch(flowUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      batchItemId: input.batchItemId,
      fromMailbox: input.fromMailbox,
      to: input.to,
      cc: input.cc ?? [],
      subject: input.subject,
      htmlBody: input.htmlBody,
      attachments: input.attachments ?? [],
      callbackUrl: `${appBaseUrl}/api/power-automate/callback`,
      callbackSecret,
    }),
  });

  // The flow is expected to respond 202 immediately, before it has
  // actually sent anything (see docs/POWER_AUTOMATE.md step 2) — a 2xx
  // here only means "the flow accepted the job," not "the email sent."
  if (!response.ok) {
    throw new Error(
      `Power Automate flow trigger failed: ${response.status} ${await response.text()}`,
    );
  }
}
