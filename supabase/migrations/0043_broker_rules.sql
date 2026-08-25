-- Add match_type to broker_master for pattern-based company matching
alter table broker_master
  add column if not exists match_type text not null default 'exact'
    check (match_type in ('exact', 'pattern'));

alter table broker_master
  add column if not exists updated_at timestamptz default now();

-- Seed default Air India rule (replaces hardcoded logic)
insert into broker_master (company_name, company_name_normalized, broker_type, broker_name, match_type, source, confirmed_count)
values ('AIR INDIA', 'air india', 'febrk-jeena', 'HC khanna', 'pattern', 'system_rule', 999)
on conflict (company_name_normalized, broker_type) do nothing;
