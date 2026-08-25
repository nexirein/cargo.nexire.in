-- Delivery Order collection tracking
alter table awb_cases
  add column if not exists do_number text,
  add column if not exists do_collected_at timestamptz;

-- Index for my-cases queries
create index if not exists idx_awb_cases_owner_status
  on awb_cases(owner_user_id, ownership_status, current_status);
