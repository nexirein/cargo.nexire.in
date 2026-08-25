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
    execute format(
      'create policy select_active_users on %I for select using (app_is_active_user());',
      t
    );
  end loop;
end $$;


-- =============================================================================
-- 13. UPDATED-AT TRIGGERS
-- =============================================================================
create trigger trg_ai_drafts_updated_at before update on ai_drafts
  for each row execute function set_updated_at();

create trigger trg_followup_schedules_updated_at before update on followup_schedules
  for each row execute function set_updated_at();

create trigger trg_company_clearance_master_updated_at before update on company_clearance_master
  for each row execute function set_updated_at();

create trigger trg_app_config_updated_at before update on app_config
  for each row execute function set_updated_at();
