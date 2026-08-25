-- Add reply-tracking columns to email_events

alter table email_events
  add column if not exists in_reply_to text,
  add column if not exists is_customer_reply boolean not null default false;

create index if not exists idx_email_events_in_reply_to
  on email_events (in_reply_to);

alter table awb_cases
  add column if not exists reply_count int not null default 0,
  add column if not exists last_reply_at timestamptz,
  add column if not exists last_reply_from text;

-- Quick summary view for dashboard
create or replace function get_todays_reply_count()
returns int
language sql
stable
as $$
  select count(*)::int
  from email_events
  where direction = 'inbound'
    and created_at >= current_date;
$$;
