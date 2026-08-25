-- Seed app_config with correct auto-send settings for production.
-- Run this in Supabase SQL Editor to ensure auto-reply works.

INSERT INTO app_config (key, value) VALUES
  ('ai_enabled', 'true'),
  ('auto_send_enabled', 'true'),
  ('auto_send_routine_enabled', 'true'),
  ('auto_send_routine_min_confidence', '0.7'),
  ('draft_hold_min_threshold', '0.7'),
  ('followup_enabled', 'true'),
  ('call_ai_enabled', 'true')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
