-- AI Metrics tracking
-- Adds columns to track AI vs human actions per case for dashboard metrics

-- 0. Helper function for incrementing counters
CREATE OR REPLACE FUNCTION increment_case_counter(p_case_id uuid, p_column text)
RETURNS void AS $$
BEGIN
  EXECUTE format('UPDATE awb_cases SET %I = COALESCE(%I, 0) + 1 WHERE id = $1', p_column, p_column) USING p_case_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 1. New columns on awb_cases
ALTER TABLE awb_cases ADD COLUMN IF NOT EXISTS auto_classified boolean DEFAULT false;
ALTER TABLE awb_cases ADD COLUMN IF NOT EXISTS auto_replied boolean DEFAULT false;
ALTER TABLE awb_cases ADD COLUMN IF NOT EXISTS auto_closed boolean DEFAULT false;
ALTER TABLE awb_cases ADD COLUMN IF NOT EXISTS human_ever_opened boolean DEFAULT false;
ALTER TABLE awb_cases ADD COLUMN IF NOT EXISTS ai_actions_count integer DEFAULT 0;
ALTER TABLE awb_cases ADD COLUMN IF NOT EXISTS human_actions_count integer DEFAULT 0;

-- 2. Actor type on case_updates
ALTER TABLE case_updates ADD COLUMN IF NOT EXISTS actor_type text DEFAULT 'system';

-- 3. Backfill actor_type on existing case_updates
UPDATE case_updates SET actor_type = 'human' WHERE updated_by IS NOT NULL AND actor_type = 'system';
UPDATE case_updates SET actor_type = 'ai' WHERE updated_by IS NULL AND update_type IN ('auto_reply_sent', 'reply_received') AND actor_type = 'system';
UPDATE case_updates SET actor_type = 'cron' WHERE updated_by IS NULL AND update_type IN ('do_overdue_reminder', 'reminder_sent', 'final_reminder_sent') AND actor_type = 'system';
-- remaining = 'system' (default)

-- 4. Backfill awb_cases from ai_classifications table
UPDATE awb_cases ac
SET auto_classified = true,
    ai_actions_count = COALESCE(ai_actions_count, 0) + 1
WHERE ac.id IN (SELECT DISTINCT case_id FROM ai_classifications);

-- 5. Backfill human_ever_opened from case_updates with non-null updated_by
UPDATE awb_cases ac
SET human_ever_opened = true
FROM case_updates cu
WHERE cu.case_id = ac.id AND cu.updated_by IS NOT NULL;

-- 6. Backfill action counts from case_updates
UPDATE awb_cases ac
SET ai_actions_count = (
  SELECT COUNT(*) FROM case_updates cu
  WHERE cu.case_id = ac.id AND cu.actor_type IN ('ai', 'cron', 'system')
);

UPDATE awb_cases ac
SET human_actions_count = (
  SELECT COUNT(*) FROM case_updates cu
  WHERE cu.case_id = ac.id AND cu.actor_type = 'human'
);

-- 7. Backfill auto_closed: cases closed without human ever opening them
UPDATE awb_cases ac
SET auto_closed = true
WHERE ac.current_status = 'closed'
  AND ac.human_ever_opened = false
  AND ac.human_review_required = false;

-- 8. Indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_awb_cases_auto_classified ON awb_cases(auto_classified);
CREATE INDEX IF NOT EXISTS idx_awb_cases_auto_closed ON awb_cases(auto_closed);
CREATE INDEX IF NOT EXISTS idx_awb_cases_human_ever_opened ON awb_cases(human_ever_opened);
CREATE INDEX IF NOT EXISTS idx_case_updates_actor_type ON case_updates(actor_type);
