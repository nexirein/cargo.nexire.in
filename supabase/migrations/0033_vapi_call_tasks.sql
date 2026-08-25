-- Vapi AI calling integration — columns already partially added in 0030
-- This adds the remaining columns needed by the new review + calling flow

-- Add missing columns for the calling flow
alter table call_tasks
  add column if not exists awb text,
  add column if not exists consignee_name text,
  add column if not exists consignee_email text,
  add column if not exists completed_at timestamptz;

-- Relax status check: 0030 only allows 'confirmation','reminder','follow_up' for call_type
-- Add 'broker_lookup' to the allowed call_type values
alter table call_tasks
  drop constraint if exists call_tasks_call_type_check,
  add constraint call_tasks_call_type_check
    check (call_type in ('confirmation', 'broker_lookup', 'reminder', 'follow_up'));

-- Relax status check: original table only allows 'open','in_progress','done','skipped'
alter table call_tasks
  drop constraint if exists call_tasks_status_check,
  add constraint call_tasks_status_check
    check (status in ('open', 'in_progress', 'done', 'skipped', 'pending', 'failed'));

-- Indexes for the new calling flow
create index if not exists idx_call_tasks_vapi_id on call_tasks(vapi_call_id);
create index if not exists idx_call_tasks_batch_item on call_tasks(batch_item_id);
create index if not exists idx_call_tasks_awb on call_tasks(awb);
