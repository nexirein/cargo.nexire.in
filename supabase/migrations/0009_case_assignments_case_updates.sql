create table case_assignments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references awb_cases(id) on delete cascade,
  from_user_id uuid references app_users(id),
  to_user_id uuid references app_users(id),
  assignment_type text not null check (assignment_type in (
    'claim','assign','release','override','auto_assign'
  )),
  reason text,
  created_at timestamptz not null default now()
);

create table case_updates (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references awb_cases(id) on delete cascade,
  updated_by uuid references app_users(id),
  update_type text not null,
  old_values jsonb,
  new_values jsonb,
  remarks text,
  created_at timestamptz not null default now()
);

alter table case_assignments enable row level security;
alter table case_updates enable row level security;
