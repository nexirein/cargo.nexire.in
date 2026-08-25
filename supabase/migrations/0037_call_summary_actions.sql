-- Phase 7: AI call summarization, action extraction, thread linking

-- Add structured summary + action items to call_tasks
alter table call_tasks
  add column if not exists call_summary jsonb,
  add column if not exists action_items jsonb,
  add column if not exists thread_links jsonb,
  add column if not exists ai_summary_status text default 'pending'
    check (ai_summary_status in ('pending', 'processing', 'completed', 'failed'));

-- Enable RLS (already enabled, just ensuring new columns are accessible)
alter table call_tasks enable row level security;
