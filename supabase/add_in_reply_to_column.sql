-- Add the in_reply_to column to email_events.
-- Run this in Supabase SQL Editor if it doesn't already exist.
ALTER TABLE email_events ADD COLUMN IF NOT EXISTS in_reply_to text;
