-- ============================================================
-- Fix: apply the missing pieces of migration 0029 (AI metrics)
-- ============================================================
-- Why: case_updates.actor_type and the increment_case_counter
-- function were never applied to this project. Every AI timeline
-- insert silently fails, so case timelines stay empty ("No
-- activity yet") even while replies/drafts are happening.
--
-- HOW TOstil RUN: Dashboard -> SQL Editor -> New query -> paste ->
-- Run. Safe to re-run (idempotent).
-- ============================================================

ALTER TABLE case_updates ADD COLUMN IF NOT EXISTS actor_type text DEFAULT 'system';

UPDATE case_updates SET actor_type = 'human' WHERE updated_by IS NOT NULL AND actor_type = 'system';
UPDATE case_updates SET actor_type = 'ai' WHERE updated_by IS NULL AND update_type IN ('auto_reply_sent', 'reply_received', 'draft_created', 'draft_approved_sent') AND actor_type = 'system';
UPDATE case_updates SET actor_type = 'cron' WHERE updated_by IS NULL AND update_type IN ('do_overdue_reminder', 'reminder_sent', 'final_reminder_sent') AND actor_type = 'system';

CREATE OR REPLACE FUNCTION increment_case_counter(p_case_id uuid, p_column text)
RETURNS void AS $$
BEGIN
  EXECUTE format('UPDATE awb_cases SET %I = COALESCE(%I, 0) + 1 WHERE id = $1', p_column, p_column) USING p_case_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE INDEX IF NOT EXISTS idx_case_updates_actor_type ON case_updates(actor_type);
