-- ============================================================
-- CONSOLIDATED: Company Clearance Master + Fuzzy Matching + Enrichment
-- Run this entire script in one go in Supabase SQL Editor
-- ============================================================

-- 1. Ensure set_updated_at() helper exists (from 0014_triggers)
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 2. Create company_clearance_master table (from 0035_ai_foundation)
create table if not exists company_clearance_master (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  clearance_type text not null check (clearance_type in ('nfbrk', 'febrk', 'febrk-sunimpex', 'febrk-jeena')),
  confidence real default 1.0,
  source text not null default 'excel_upload' check (source in ('excel_upload', 'human_research', 'ai_call', 'batch_auto')),
  last_seen_at timestamptz default now(),
  times_seen int default 1,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(company_name, clearance_type)
);

create index if not exists idx_company_clearance_name on company_clearance_master(company_name);
create index if not exists idx_company_clearance_type on company_clearance_master(clearance_type);
create index if not exists idx_company_clearance_last_seen on company_clearance_master(last_seen_at);

-- 3. Lookup function (from 0035)
create or replace function get_company_clearance_type(p_company_name text)
returns text
language plpgsql
as $$
declare
  v_result text;
begin
  select clearance_type into v_result
  from company_clearance_master
  where company_name = p_company_name
  order by times_seen desc, last_seen_at desc
  limit 1;
  return v_result;
end;
$$;

-- Add email column to company_clearance_master for auto-fill fallback
alter table company_clearance_master
  add column if not exists email text;
create index if not exists idx_company_clearance_email
  on company_clearance_master(email);

alter table company_clearance_master enable row level security;

-- 4. pg_trgm extension + normalize function + fuzzy lookup (from 0040, FIXED)
create extension if not exists pg_trgm with schema extensions;

create index if not exists idx_company_clearance_trgm
  on company_clearance_master using gin (company_name gin_trgm_ops);

create index if not exists idx_broker_master_trgm
  on broker_master using gin (company_name gin_trgm_ops);

create or replace function normalize_company_name(p_name text)
returns text
language plpgsql
immutable
as $$
declare
  v_name text;
begin
  v_name := lower(trim(p_name));
  v_name := regexp_replace(v_name, '\yprivate limited\y', '', 'g');
  v_name := regexp_replace(v_name, '\ypvt\.?\s*ltd\.?\y', '', 'g');
  v_name := regexp_replace(v_name, '\ypvt\b', '', 'g');
  v_name := regexp_replace(v_name, '\ylimited\y', '', 'g');
  v_name := regexp_replace(v_name, '\yltd\b', '', 'g');
  v_name := regexp_replace(v_name, '\yplc\y', '', 'g');
  v_name := regexp_replace(v_name, '\yllc\y', '', 'g');
  v_name := regexp_replace(v_name, '\yinc\b', '', 'g');
  v_name := regexp_replace(v_name, '\ycorporation\y', '', 'g');
  v_name := regexp_replace(v_name, '\ycorp\b', '', 'g');
  v_name := regexp_replace(v_name, '\ycompany\y', '', 'g');
  v_name := regexp_replace(v_name, '\yco\.?\b', '', 'g');
  v_name := regexp_replace(v_name, '\(.*?\)', '', 'g');
  v_name := regexp_replace(v_name, '\*.*?\*', '', 'g');
  v_name := regexp_replace(v_name, '[^a-z0-9\s]', ' ', 'g');
  v_name := regexp_replace(v_name, '\s+', ' ', 'g');
  v_name := trim(v_name);
  return v_name;
end;
$$;

create or replace function fuzzy_clearance_lookup(p_company_name text)
returns table (
  clearance_type text,
  source text,
  similarity real
)
language plpgsql
stable
as $$
declare
  v_normalized text;
begin
  v_normalized := normalize_company_name(p_company_name);

  return query
  select
    ccm.clearance_type,
    ccm.source,
    1.0::real as similarity
  from company_clearance_master ccm
  where normalize_company_name(ccm.company_name) = v_normalized
  order by ccm.times_seen desc, ccm.last_seen_at desc
  limit 1;

  if not found then
    return query
    select
      ccm.clearance_type,
      ccm.source,
      similarity(normalize_company_name(ccm.company_name), v_normalized) as sim
    from company_clearance_master ccm
    where similarity(normalize_company_name(ccm.company_name), v_normalized) > 0.4
    order by sim desc, ccm.times_seen desc, ccm.last_seen_at desc
    limit 1;
  end if;
end;
$$;

drop trigger if exists trg_company_clearance_master_updated_at on company_clearance_master;
create trigger trg_company_clearance_master_updated_at
  before update on company_clearance_master
  for each row
  execute function set_updated_at();

-- 5. Enrichment columns on batch_items + call_tasks (from 0041)
alter table batch_items
  add column if not exists fedex_broker text;
alter table batch_items
  add column if not exists contact_phone text;
alter table batch_items
  add column if not exists standard_remarks text;
alter table batch_items
  add column if not exists mail_id text;
alter table batch_items
  add column if not exists call_reasons jsonb default '[]'::jsonb;
alter table batch_items
  add column if not exists updated_at timestamptz default now();

create index if not exists idx_batch_items_call_reasons
  on batch_items using gin (call_reasons);
create index if not exists idx_batch_items_contact_phone
  on batch_items(contact_phone);

alter table call_tasks
  add column if not exists customer_phone text;
alter table call_tasks
  add column if not exists missing_fields jsonb default '[]'::jsonb;

alter table call_tasks
  drop constraint if exists call_tasks_call_type_check,
  add constraint call_tasks_call_type_check
    check (call_type in ('confirmation', 'broker_lookup', 'clearance_enrichment', 'reminder', 'follow_up'));

-- 6. RLS policy for company_clearance_master
do $$
begin
  if not exists (
    select 1 from pg_policies where tablename = 'company_clearance_master' and policyname = 'select_active_users'
  ) then
    create policy select_active_users on company_clearance_master
      for select using (app_is_active_user());
  end if;
end $$;
