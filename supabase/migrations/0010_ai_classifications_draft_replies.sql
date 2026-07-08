-- Unused until the next phase (M7 AI decision layer). Created now so no
-- schema surgery is needed when that phase starts.
create table ai_classifications (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references awb_cases(id) on delete cascade,
  email_event_id uuid references email_events(id) on delete cascade,
  classifier_version text,
  issue_type text,
  urgency text,
  action_needed text,
  confidence numeric(5,4),
  human_review_required boolean,
  ai_reply_allowed boolean,
  call_required boolean,
  reason text,
  raw_output jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table draft_replies (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references awb_cases(id) on delete cascade,
  email_event_id uuid references email_events(id) on delete cascade,
  generated_by text not null,
  draft_subject text,
  draft_body text,
  approval_status text not null default 'pending' check (approval_status in (
    'pending','approved','rejected','sent'
  )),
  approved_by uuid references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table ai_classifications enable row level security;
alter table draft_replies enable row level security;
