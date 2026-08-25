-- Phase 1: Operational Console — next_action, pending_info, call tracking

alter table awb_cases
  add column if not exists pending_info jsonb not null default '[]'::jsonb,
  add column if not exists last_called_at timestamptz,
  add column if not exists next_action text,
  add column if not exists next_action_sla_at timestamptz;

create index if not exists idx_awb_cases_next_action
  on awb_cases(next_action);
create index if not exists idx_awb_cases_owner_next_action
  on awb_cases(owner_user_id, next_action);
