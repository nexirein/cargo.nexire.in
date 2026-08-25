-- Consolidated pending migrations 0035 -> 0046 (hosted DB apply script).
-- Paste this whole file into the Supabase Dashboard SQL Editor and Run.
-- Safe to re-run: CREATE ... IF NOT EXISTS + ON CONFLICT DO NOTHING used throughout.
-- =============================================================================

-- pgvector extension must exist before any vector(1536) column.
create extension if not exists vector;

-- Phase 1: Foundation — AI infrastructure tables, pgvector setup, seed configs.
-- All tables are created in shadow mode: no user-facing changes until Phase 3.
-- =============================================================================

-- =============================================================================
-- 1. EMAILS — Cleaned, labeled, embedded historical email data for vector search
-- =============================================================================
create table if not exists emails (
  id uuid primary key default gen_random_uuid(),
  awb text,
  subject text,
  body_clean text,
  sender_email text,
  recipient_emails text[],
  clearance_type text,
  intent text,
  urgency text,
  actual_reply text,
  embedding vector(1536),
  source_email_event_id uuid references email_events(id) on delete set null,
  extracted_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_emails_awb on emails(awb);
create index if not exists idx_emails_clearance_type on emails(clearance_type);
create index if not exists idx_emails_intent on emails(intent);
create index if not exists idx_emails_created on emails(created_at);

alter table emails enable row level security;


-- =============================================================================
-- 2. TEMPLATES — Add embedding column for similarity-based template matching
-- =============================================================================
alter table templates add column if not exists embedding vector(1536);
alter table templates add column if not exists intent text;
alter table templates add column if not exists variables jsonb default '[]'::jsonb;
alter table templates add column if not exists version int not null default 1;


-- =============================================================================
-- 3. PGVECTOR SIMILARITY SEARCH FUNCTION
-- =============================================================================
create or replace function match_similar_emails(
  query_embedding vector(1536),
  match_threshold float default 0.75,
  match_count int default 5,
  filter_clearance_type text default null,
  filter_intent text default null
)
returns table(
  id uuid,
  awb text,
  subject text,
  body_clean text,
  clearance_type text,
  intent text,
  similarity float,
  actual_reply text
)
language plpgsql
as $$
begin
  return query
  select
    e.id, e.awb, e.subject, e.body_clean,
    e.clearance_type, e.intent,
    1 - (e.embedding <=> query_embedding) as similarity,
    e.actual_reply
  from emails e
  where
    e.embedding is not null
    and (1 - (e.embedding <=> query_embedding)) > match_threshold
    and (filter_clearance_type is null or e.clearance_type = filter_clearance_type)
    and (filter_intent is null or e.intent = filter_intent)
  order by e.embedding <=> query_embedding
  limit match_count;
end;
$$;


-- =============================================================================
-- 4. COMPANY CLEARANCE MASTER — Historical clearance type by company name
--    Uploaded from Excel. Used on Validate page to auto-fill clearance type.
-- =============================================================================
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

-- Lookup function: get most likely clearance type for a company
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

alter table company_clearance_master enable row level security;


-- =============================================================================
-- 5. ENHANCE AI_CLASSIFICATIONS — Add columns the new ensemble classifier needs
-- =============================================================================
alter table ai_classifications
  add column if not exists classifier_version text,
  add column if not exists model_used text,
  add column if not exists clearance_type text,
  add column if not exists intent text,
  add column if not exists urgency text,
  add column if not exists response_type text,
  add column if not exists route text,
  add column if not exists rule_matches jsonb default '[]'::jsonb,
  add column if not exists ml_prediction jsonb,
  add column if not exists llm_raw_output jsonb,
  add column if not exists ensemble_details jsonb,
  add column if not exists explanation text,
  add column if not exists latency_ms int;

comment on column ai_classifications.route is 'ignore | ai_auto_send | ai_draft_hold | human_review';
comment on column ai_classifications.clearance_type is 'nfbrk | febrk | febrk-sunimpex | febrk-jeena | calling | hold';
comment on column ai_classifications.intent is 'inquiry | update | escalation | confirmation | docs_request | other';
comment on column ai_classifications.urgency is 'low | normal | high | critical';
comment on column ai_classifications.response_type is 'acknowledge | provide_info | request_docs | escalate | no_action';

create index if not exists idx_ai_classifications_route on ai_classifications(route);
create index if not exists idx_ai_classifications_confidence on ai_classifications(confidence);
create index if not exists idx_ai_classifications_created on ai_classifications(created_at);
create index if not exists idx_ai_classifications_version on ai_classifications(classifier_version);


-- =============================================================================
-- 6. AI DRAFTS — Full draft lifecycle (replaces simpler draft_replies concept)
--    Old draft_replies table kept for backward compatibility.
-- =============================================================================
create table if not exists ai_drafts (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references awb_cases(id) on delete set null,
  email_event_id uuid references email_events(id) on delete set null,
  batch_id uuid references batch_runs(id) on delete set null,

  trigger_type text not null,
  trigger_reason text,

  subject text not null,
  body_html text not null,
  body_text text not null,
  variables_used jsonb,

  confidence real not null,
  flags text[],
  template_id uuid references templates(id) on delete set null,

  status text not null default 'pending' check (status in ('pending', 'approved', 'edited', 'rejected', 'sent')),
  reviewed_by uuid references app_users(id),
  reviewed_at timestamptz,
  edited_subject text,
  edited_body text,
  rejection_reason text,
  sent_at timestamptz,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_ai_drafts_status on ai_drafts(status);
create index if not exists idx_ai_drafts_case on ai_drafts(case_id);
create index if not exists idx_ai_drafts_trigger on ai_drafts(trigger_type);
create index if not exists idx_ai_drafts_created on ai_drafts(created_at);

alter table ai_drafts enable row level security;


-- =============================================================================
-- 7. FOLLOW-UP SCHEDULES — AI-proposed follow-ups, human-managed
-- =============================================================================
create table if not exists followup_schedules (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references awb_cases(id) on delete set null,
  awb text not null,

  clearance_type text not null,
  trigger_rule text not null,
  scheduled_at timestamptz not null,
  attempt_number int default 1,
  max_attempts int default 3,

  draft_id uuid references ai_drafts(id) on delete set null,

  status text not null default 'scheduled' check (status in ('scheduled', 'draft_ready', 'approved', 'edited', 'sent', 'cancelled', 'completed')),
  assigned_to uuid references app_users(id),
  completed_at timestamptz,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_followup_schedules_status on followup_schedules(status);
create index if not exists idx_followup_schedules_due on followup_schedules(scheduled_at) where status = 'scheduled';
create index if not exists idx_followup_schedules_case on followup_schedules(case_id);
create index if not exists idx_followup_schedules_awb on followup_schedules(awb);

alter table followup_schedules enable row level security;


-- =============================================================================
-- 8. CORRECTION LOG — Human corrections used for model retraining
--    (Distinct from the existing training_examples table which stores training
--     data with embeddings. This table logs AI-vs-human deltas.)
-- =============================================================================
create table if not exists correction_log (
  id uuid primary key default gen_random_uuid(),
  email_event_id uuid references email_events(id) on delete set null,
  case_id uuid references awb_cases(id) on delete set null,

  field_name text not null,
  predicted_value text,
  corrected_value text not null,

  corrected_by uuid references app_users(id) not null,
  confidence_at_prediction real,
  classifier_version text,
  source_context text,

  created_at timestamptz default now()
);

create index if not exists idx_correction_log_field on correction_log(field_name);
create index if not exists idx_correction_log_created on correction_log(created_at);
create index if not exists idx_correction_log_version on correction_log(classifier_version);

alter table correction_log enable row level security;


-- =============================================================================
-- 9. INFERENCE LOG — Model performance monitoring (separate from classifications)
-- =============================================================================
create table if not exists inference_log (
  id uuid primary key default gen_random_uuid(),
  input_awb text,
  input_subject text,
  input_body_hash text,
  predicted_clearance_type text,
  predicted_intent text,
  predicted_urgency text,
  actual_clearance_type text,
  actual_intent text,
  actual_urgency text,
  confidence real,
  latency_ms int,
  model_version text,
  created_at timestamptz default now()
);

create index if not exists idx_inference_log_created on inference_log(created_at);
create index if not exists idx_inference_log_version on inference_log(model_version);

alter table inference_log enable row level security;


-- =============================================================================
-- 10. APP CONFIG — Runtime configuration for AI system
-- =============================================================================
create table if not exists app_config (
  key text primary key,
  value jsonb not null,
  description text,
  updated_by uuid references app_users(id),
  updated_at timestamptz default now()
);

insert into app_config (key, value, description) values
  ('vip_domains', '["company.com", "client.org"]'::jsonb, 'Email domains that trigger VIP treatment'),
  ('vip_senders', '["ceo@company.com"]'::jsonb, 'Exact email addresses that trigger VIP treatment'),
  ('legal_keywords', '["attorney", "lawsuit", "compliance", "legal notice", "litigation", "regulatory"]'::jsonb, 'Keywords that trigger mandatory human review'),
  ('ai_enabled', 'true'::jsonb, 'Master kill-switch for all AI features'),
  ('classifier_version', '"v1.0.0"'::jsonb, 'Active classifier model version'),
  ('auto_send_enabled', 'false'::jsonb, 'Enable auto-send (only for data-proven safe patterns)'),
  ('draft_hold_min_threshold', '0.80'::jsonb, 'Minimum confidence for AI_DRAFT_HOLD route'),
  ('followup_enabled', 'true'::jsonb, 'Enable follow-up scheduler'),
  ('call_ai_enabled', 'true'::jsonb, 'Enable call logging AI features'),
  ('checklist_enabled', 'true'::jsonb, 'Enable checklist tracking'),
  ('checklist_nfbrk', '["boe_copy", "invoice", "packing_list", "awb_copy", "do_copy", "shipping_bill"]'::jsonb, 'Required documents for NFBRK clearance'),
  ('checklist_febrk', '["boe_copy", "invoice", "packing_list", "awb_copy", "broker_confirmation", "broker_letter"]'::jsonb, 'Required documents for FEBRK clearance')
on conflict (key) do nothing;

alter table app_config enable row level security;


-- =============================================================================
-- 11. AWB CASES — Add AI tracking columns (safe: IF NOT EXISTS)
-- =============================================================================
alter table awb_cases
  add column if not exists ai_classification_id uuid references ai_classifications(id),
  add column if not exists auto_classified boolean default false,
  add column if not exists auto_replied boolean default false,
  add column if not exists auto_closed boolean default false,
  add column if not exists human_ever_opened boolean default false,
  add column if not exists ai_actions_count int default 0,
  add column if not exists human_actions_count int default 0;

create index if not exists idx_awb_cases_auto_classified on awb_cases(auto_classified);
create index if not exists idx_awb_cases_auto_closed on awb_cases(auto_closed);
create index if not exists idx_awb_cases_human_ever_opened on awb_cases(human_ever_opened);


-- =============================================================================
-- 12. RLS POLICIES — Add SELECT policies for new tables (existing pattern)
-- =============================================================================
do $$
declare
  t text;
  tables text[] := array[
    'emails', 'company_clearance_master', 'ai_drafts', 'followup_schedules',
    'correction_log', 'inference_log', 'app_config'
  ];
begin
  foreach t in array tables loop
    execute format('drop policy if exists select_active_users on %I;', t);
    execute format(
      'create policy select_active_users on %I for select using (app_is_active_user());',
      t
    );
  end loop;
end $$;


-- =============================================================================
-- 13. UPDATED-AT TRIGGERS
-- =============================================================================
drop trigger if exists trg_ai_drafts_updated_at on ai_drafts;
create trigger trg_ai_drafts_updated_at before update on ai_drafts
  for each row execute function set_updated_at();

drop trigger if exists trg_followup_schedules_updated_at on followup_schedules;
create trigger trg_followup_schedules_updated_at before update on followup_schedules
  for each row execute function set_updated_at();

drop trigger if exists trg_company_clearance_master_updated_at on company_clearance_master;
create trigger trg_company_clearance_master_updated_at before update on company_clearance_master
  for each row execute function set_updated_at();

drop trigger if exists trg_app_config_updated_at on app_config;
create trigger trg_app_config_updated_at before update on app_config
  for each row execute function set_updated_at();
create table if not exists batch_checklist_items (
  id uuid primary key default gen_random_uuid(),
  batch_run_id uuid not null references batch_runs(id) on delete cascade,
  item_key text not null,
  label text not null,
  clearance_type text,
  is_required boolean not null default true,
  is_completed boolean not null default false,
  completed_by uuid references app_users(id),
  completed_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_batch_checklist_run on batch_checklist_items(batch_run_id);
create unique index if not exists idx_batch_checklist_unique on batch_checklist_items(batch_run_id, item_key);

alter table batch_checklist_items enable row level security;

drop policy if exists select_active_users on batch_checklist_items;
drop policy if exists insert_active_users on batch_checklist_items;
drop policy if exists update_active_users on batch_checklist_items;
create policy select_active_users on batch_checklist_items for select using (app_is_active_user());
create policy insert_active_users on batch_checklist_items for insert with check (app_is_active_user());
create policy update_active_users on batch_checklist_items for update using (app_is_active_user());
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
-- Store attachment content directly in file_assets to skip storage upload
alter table file_assets add column if not exists content text;
-- Enable pg_trgm extension for fuzzy company name matching
-- Used by the Bulk Clearance Fill feature to match company names
-- that have minor variations (e.g., "ABC PVT LTD" vs "ABC PRIVATE LIMITED")
create extension if not exists pg_trgm with schema extensions;

-- Fuzzy matching index on company_clearance_master
create index if not exists idx_company_clearance_trgm
  on company_clearance_master using gin (company_name gin_trgm_ops);

-- Fuzzy matching index on broker_master
create index if not exists idx_broker_master_trgm
  on broker_master using gin (company_name gin_trgm_ops);

-- Normalization function: strips legal suffixes and normalizes whitespace
-- Used for better company name matching
create or replace function normalize_company_name(p_name text)
returns text
language plpgsql
immutable
as $$
declare
  v_name text;
begin
  v_name := lower(trim(p_name));

  -- Remove common legal suffixes (order matters — longer first)
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

  -- Remove parenthetical qualifiers
  v_name := regexp_replace(v_name, '\(.*?\)', '', 'g');
  v_name := regexp_replace(v_name, '\*.*?\*', '', 'g');

  -- Remove non-alphanumeric characters (keep spaces and letters/numbers)
  v_name := regexp_replace(v_name, '[^a-z0-9\s]', ' ', 'g');

  -- Collapse whitespace
  v_name := regexp_replace(v_name, '\s+', ' ', 'g');
  v_name := trim(v_name);

  return v_name;
end;
$$;

-- Lookup function: find best clearance type match with fuzzy fallback
-- Returns clearance_type + similarity score
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

  -- Level 1: exact normalized match
  return query
  select
    ccm.clearance_type,
    ccm.source,
    1.0::real as similarity
  from company_clearance_master ccm
  where normalize_company_name(ccm.company_name) = v_normalized
  order by ccm.times_seen desc, ccm.last_seen_at desc
  limit 1;

  -- If not found, Level 2: fuzzy trigram match
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

-- Trigger: auto-set updated_at on company_clearance_master
drop trigger if exists trg_company_clearance_master_updated_at on company_clearance_master;
create trigger trg_company_clearance_master_updated_at
  before update on company_clearance_master
  for each row
  execute function set_updated_at();
-- Enrich batch_items with fields for the 3-chain auto-fill system
-- Clearance type, broker, and email are resolved independently

-- Resolved FedEx broker value (after auto-fill or AI call)
alter table batch_items
  add column if not exists fedex_broker text;

-- Phone number from Contact column (for Vapi AI calling)
alter table batch_items
  add column if not exists contact_phone text;

-- Raw Standard Remarks (CC emails) from Excel
alter table batch_items
  add column if not exists standard_remarks text;

-- Raw Mail ID from Excel (36K historical format)
alter table batch_items
  add column if not exists mail_id text;

-- Which fields triggered an AI call: ["clearance_type", "broker", "email"]
-- Stored as JSONB array: e.g., '["broker", "email"]' means broker + email need calling
alter table batch_items
  add column if not exists call_reasons jsonb default '[]'::jsonb;

-- Ensure updated_at exists for batch_items
alter table batch_items
  add column if not exists updated_at timestamptz default now();

-- Index for querying call_reasons efficiently
create index if not exists idx_batch_items_call_reasons
  on batch_items using gin (call_reasons);

-- Index for contact_phone queries
create index if not exists idx_batch_items_contact_phone
  on batch_items(contact_phone);

-- Add phone to call_tasks for easier access
alter table call_tasks
  add column if not exists customer_phone text;

-- Add missing_fields tracking on call_tasks
alter table call_tasks
  add column if not exists missing_fields jsonb default '[]'::jsonb;

-- Allow call_type to be a general 'clearance_enrichment' type
-- This covers calls that ask for clearance + broker + email in one conversation
alter table call_tasks
  drop constraint if exists call_tasks_call_type_check,
  add constraint call_tasks_call_type_check
    check (call_type in ('confirmation', 'broker_lookup', 'clearance_enrichment', 'reminder', 'follow_up'));
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
-- Auto-send pipeline (NFBRK-first):
-- 1. Relax batch_items.send_status check so 'skipped' is legal
--    (process-send-job.ts writes 'skipped' for consol dedup / calling items,
--    but the original 0005 constraint only allowed pending/queued/processing/
--    sent/retrying/failed/cancelled).
-- 2. Track how/when a shipment's clearance path was confirmed, so the
--    dashboard can show why a send happened.

alter table batch_items
  drop constraint if exists batch_items_send_status_check;
alter table batch_items
  add constraint batch_items_send_status_check
    check (send_status in (
      'pending', 'queued', 'processing', 'sent', 'retrying',
      'failed', 'cancelled', 'skipped'
    ));

-- 0005 defaulted template_id to 'prealert_v1', which is not a real template
-- (the seeded pre-alert type is 'nfbrk'). Point the default at the NFBRK one.
alter table batch_items
  alter column template_id set default 'nfbrk';

alter table batch_items
  add column if not exists confirmation_source text
    check (confirmation_source in ('ai_call', 'master', 'sheet', 'manual'));
alter table batch_items
  add column if not exists confirmed_at timestamptz;

create index if not exists idx_batch_items_confirmed
  on batch_items(confirmation_source)
  where confirmation_source is not null;
-- NFBRK Delivery Order (DO) payment tracking.
-- The NFBRK end result is: consignee pays DO charges (₹3068 day-of /
-- ₹4248 next-day) to Deldo@corp.ds.fedex.com and we track who paid and
-- who did not. Trace marks payment on the dashboard; this stores it.

alter table awb_cases
  add column if not exists do_payment_status text
    check (do_payment_status in ('pending', 'paid', 'overdue')),
  add column if not exists utr_no text,
  add column if not exists do_amount numeric,
  add column if not exists payment_received_at timestamptz,
  add column if not exists payment_confirmed_by uuid references app_users(id) on delete set null,
  add column if not exists do_payment_notes text;

create index if not exists idx_awb_cases_do_payment
  on awb_cases(do_payment_status)
  where do_payment_status is not null;
-- Generic shipment-info auto-replies.
-- Routine info requests ("need more info about this shipment", IGM/DO/charges
-- queries, confirmations) are auto-answered — grounded in real shipment facts
-- pulled from awb_cases + batch_items — at a lower confidence threshold than
-- the strict 0.97 auto-send. Escalations / urgent / VIP / legal still require
-- human review.

insert into app_config (key, value, description) values
  ('auto_send_routine_enabled', 'true'::jsonb, 'Enable auto-reply for routine info requests (shipment info, IGM/DO/charges queries, confirmations, acknowledgements)'),
  ('auto_send_routine_min_confidence', '0.80'::jsonb, 'Minimum confidence for routine auto-replies'),
  ('auto_send_patterns', '[
    {"clearance_type": "nfbrk", "intent": "inquiry"},
    {"clearance_type": "nfbrk", "intent": "confirmation"},
    {"clearance_type": "nfbrk", "intent": "update"},
    {"clearance_type": "nfbrk", "intent": "docs_request"},
    {"intent": "inquiry"},
    {"intent": "confirmation"}
  ]'::jsonb, 'Intent/clearance combos eligible for AI auto-reply')
on conflict (key) do nothing;
