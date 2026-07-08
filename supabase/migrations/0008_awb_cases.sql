create table awb_cases (
  id uuid primary key default gen_random_uuid(),
  awb text unique not null,
  latest_batch_run_id uuid references batch_runs(id),
  current_status text not null default 'awaiting_reply',
  issue_type text,
  urgency text check (urgency in ('low','normal','urgent')),
  action_needed text,
  owner_user_id uuid references app_users(id),
  ownership_status text not null default 'unassigned' check (ownership_status in (
    'unassigned','claimed','assigned','review','closed','released'
  )),
  claimed_at timestamptz,
  released_at timestamptz,
  assigned_by_user_id uuid references app_users(id),
  human_review_required boolean not null default false,
  ai_reply_allowed boolean not null default false,
  ai_suggested_needs_approval boolean not null default false,
  call_required boolean not null default false,
  reminder_count int not null default 0,
  final_reminder_sent boolean not null default false,
  last_human_action_at timestamptz,
  next_action_at timestamptz,
  sla_due_at timestamptz,
  slipped boolean not null default false,
  slipped_at timestamptz,
  version int not null default 1,
  summary text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table awb_cases enable row level security;
