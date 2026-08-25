-- Broker master data for FEBRK clearance type resolution
-- When FEBRK has no broker (0/#N/A), look up company_name here to auto-fill

create table if not exists broker_master (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  company_name_normalized text not null,
  broker_type text not null check (broker_type in ('febrk-sunimpex', 'febrk-jeena')),
  broker_name text,
  broker_contact text,
  broker_email text,
  source text not null default 'manual',
  confirmed_count integer not null default 0,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_broker_master_company
  on broker_master(company_name_normalized, broker_type);

-- Track broker resolution on awb_cases
alter table awb_cases
  add column if not exists broker_resolved_from text,
  add column if not exists broker_resolved_at timestamptz,
  add column if not exists broker_original_value text,
  add column if not exists broker_resolved_to text;

-- Track on batch_items too for per-item visibility
alter table batch_items
  add column if not exists needs_broker_resolution boolean not null default false,
  add column if not exists broker_resolved_from text,
  add column if not exists broker_resolved_at timestamptz;
