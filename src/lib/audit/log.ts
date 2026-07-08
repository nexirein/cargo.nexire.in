import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export interface AuditEntry {
  actorUserId: string | null;
  entityType: string;
  entityId: string | null;
  action: string;
  metadata?: Record<string, unknown>;
}

// Best-effort: a failed audit write logs to the console but never blocks
// the primary action it's describing (e.g. a claim/release/send that
// already succeeded shouldn't roll back because the audit insert failed).
export async function logAudit(entry: AuditEntry) {
  const admin = createAdminClient();
  const { error } = await admin.from("audit_logs").insert({
    actor_user_id: entry.actorUserId,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    action: entry.action,
    metadata: entry.metadata ?? {},
  });
  if (error) {
    console.error("Failed to write audit log", error, entry);
  }
}
