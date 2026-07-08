import "server-only";
import { getQStashClient } from "@/lib/qstash/client";

export interface EnqueueResult {
  qstashMessageId: string | null;
}

/**
 * `qstash` (Preview/Production): publishes a real message, flow-controlled
 * per mailbox so Microsoft Graph's per-mailbox throttling is respected
 * without hand-rolled rate limiting.
 *
 * `inline` (local dev, the default when `QUEUE_DRIVER` is unset): QStash
 * needs a public callback URL, which localhost isn't, so this runs the
 * exact same send logic in-process instead. Concurrency across many
 * items is capped by the caller (the launch route), not here.
 */
export async function enqueueSend(
  batchItemId: string,
  flowControlKey: string,
): Promise<EnqueueResult> {
  const driver = process.env.QUEUE_DRIVER ?? "inline";

  if (driver === "qstash") {
    const appBaseUrl = process.env.APP_BASE_URL;
    if (!appBaseUrl) {
      throw new Error("APP_BASE_URL must be set to enqueue via QStash.");
    }

    const qstash = getQStashClient();
    const { messageId } = await qstash.publishJSON({
      url: `${appBaseUrl}/api/send/webhook`,
      body: { batchItemId },
      flowControl: { key: flowControlKey, parallelism: 4 },
    });

    return { qstashMessageId: messageId };
  }

  const { processSendJob } = await import("@/lib/send/process-send-job");
  await processSendJob(batchItemId);
  return { qstashMessageId: null };
}
