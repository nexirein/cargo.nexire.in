import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
import { createClient } from "@supabase/supabase-js";

// Backfills case_updates timeline rows from existing AI activity
// (customer replies, drafts, auto-sends, approved drafts) so cases show
// their full history immediately. Run AFTER applying supabase/apply-0029-fix.sql.
// Idempotent: skips any (case, update_type, source-id) already recorded.

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(url, key);

const PLATFORM_MAILBOXES = ["cargopaf.demo@gmail.com", "cargopaf.monitor@gmail.com"];

function isPlatformAddress(s: string | null | undefined): boolean {
  return PLATFORM_MAILBOXES.some((m) => s?.toLowerCase().includes(m));
}

async function main() {
  const { data: cases, error: cErr } = await supabase
    .from("awb_cases")
    .select("id, awb");
  if (cErr || !cases) throw new Error(`cases: ${cErr?.message}`);
  const caseByAwb = new Map<string, string>(); // awb -> case id
  for (const c of cases) if (c.awb) caseByAwb.set(c.awb, c.id);

  const awbs = [...caseByAwb.keys()];

  // Existing timeline rows (to dedupe)
  const { data: existing, error: xErr } = await supabase
    .from("case_updates")
    .select("case_id, update_type, new_values");
  if (xErr) throw new Error(`case_updates: ${xErr.message}`);

  const seen = new Set<string>();
  for (const r of existing ?? []) {
    const src =
      r.new_values?.email_event_id ??
      r.new_values?.draft_id ??
      r.new_values?.smtp_message_id ??
      r.new_values?.source_id;
    if (src) seen.add(`${r.case_id}|${r.update_type}|${src}`);
  }

  const inserts: Record<string, unknown>[] = [];
  const dedupe = (caseId: string, type: string, src: string) => {
    const key = `${caseId}|${type}|${src}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  };

  // 1. Inbound customer replies -> reply_received
  const { data: inbound, error: iErr } = await supabase
    .from("email_events")
    .select("id, awb, subject, sender_email, created_at")
    .eq("direction", "inbound")
    .in("awb", awbs)
    .order("created_at", { ascending: true });
  if (iErr) throw new Error(`email_events: ${iErr.message}`);
  for (const ev of inbound ?? []) {
    if (isPlatformAddress(ev.sender_email)) continue; // pre-alert echo, not a customer reply
    const caseId = caseByAwb.get(ev.awb!);
    if (!caseId || !dedupe(caseId, "reply_received", ev.id)) continue;
    inserts.push({
      case_id: caseId,
      updated_by: null,
      actor_type: "ai",
      update_type: "reply_received",
      remarks: `Reply from ${ev.sender_email}: ${ev.subject}`,
      new_values: { email_event_id: ev.id, source_id: ev.id },
      created_at: ev.created_at,
    });
  }

  // 2. AI drafts -> draft_created
  const { data: drafts, error: dErr } = await supabase
    .from("ai_drafts")
    .select("id, case_id, trigger_reason, created_at");
  if (dErr) throw new Error(`ai_drafts: ${dErr.message}`);
  for (const d of drafts ?? []) {
    if (!d.case_id || !dedupe(d.case_id, "draft_created", d.id)) continue;
    inserts.push({
      case_id: d.case_id,
      updated_by: null,
      actor_type: "ai",
      update_type: "draft_created",
      remarks: `AI draft created (${d.trigger_reason ?? "n/a"})`,
      new_values: { draft_id: d.id, source_id: d.id },
      created_at: d.created_at,
    });
  }

  // 3. Auto-sent replies -> auto_reply_sent ; approved drafts -> draft_approved_sent
  const { data: outbound, error: oErr } = await supabase
    .from("email_events")
    .select("id, message_id, awb, created_at")
    .eq("direction", "outbound")
    .in("awb", awbs);
  if (oErr) throw new Error(`email_events outbound: ${oErr.message}`);
  for (const ev of outbound ?? []) {
    const caseId = caseByAwb.get(ev.awb!);
    if (!caseId) continue;
    const mid = ev.message_id ?? "";
    if (mid.startsWith("auto-send-")) {
      if (dedupe(caseId, "auto_reply_sent", ev.id)) {
        inserts.push({
          case_id: caseId,
          updated_by: null,
          actor_type: "ai",
          update_type: "auto_reply_sent",
          remarks: "AI auto-sent reply",
          new_values: { smtp_message_id: mid, source_id: ev.id },
          created_at: ev.created_at,
        });
      }
    } else if (mid.startsWith("draft-sent-")) {
      if (dedupe(caseId, "draft_approved_sent", ev.id)) {
        inserts.push({
          case_id: caseId,
          updated_by: null,
          actor_type: "ai",
          update_type: "draft_approved_sent",
          remarks: "Draft approved and sent",
          new_values: { smtp_message_id: mid, source_id: ev.id },
          created_at: ev.created_at,
        });
      }
    }
  }

  if (inserts.length > 0) {
    const { error: insErr } = await supabase.from("case_updates").insert(inserts);
    if (insErr) throw new Error(`insert: ${insErr.message}`);
  }
  console.log(`Backfill done: ${inserts.length} timeline row(s) inserted.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
