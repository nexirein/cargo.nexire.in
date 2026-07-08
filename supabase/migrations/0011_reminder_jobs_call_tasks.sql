-- Unused until the next phase (M8 reminders, M7/v2 call layer). Created now
-- so no schema surgery is needed when that phase starts.
create table reminder_jobs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references awb_cases(id) on delete cascade,
  reminder_level int not null default 1,
  due_at timestamptz not null,
  status text not null default 'pending' check (status in (
    'pending','sent','skipped','failed'
  )),
  executed_at timestamptz,
  created_at timestamptz not null default now()
);

create table call_tasks (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references awb_cases(id) on delete cascade,
  assigned_to uuid references app_users(id),
  customer_phone text,
  reason text,
  script_prompt text,
  due_at timestamptz,
  status text not null default 'open' check (status in (
    'open','in_progress','done','skipped'
  )),
  outcome text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table reminder_jobs enable row level security;
alter table call_tasks enable row level security;
