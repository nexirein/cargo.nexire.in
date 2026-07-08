import "server-only";
import { getRedis } from "./client";

/**
 * Short-lived distributed lock for the narrow race window during
 * concurrent/duplicate delivery of the same send job. This is a UX/safety
 * nicety, not the actual correctness guarantee — Postgres's
 * `send_status = 'sent'` check remains the real idempotency source of
 * truth (per spec 14: Redis is never the final source of truth).
 */
export async function acquireLock(key: string, ttlMs: number): Promise<boolean> {
  const result = await getRedis().set(key, "1", { nx: true, px: ttlMs });
  return result === "OK";
}

export async function releaseLock(key: string): Promise<void> {
  await getRedis().del(key);
}
