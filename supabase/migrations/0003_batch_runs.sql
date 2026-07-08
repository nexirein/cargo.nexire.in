create table batch_runs (
  id uuid primary key default gen_random_uuid(),
  run_name text not null,
  run_date date not null,
  mailbox_config_id uuid references mailbox_configs(id),
  created_by uuid references app_users(id),
  status text not null default 'draft' check (status in (
    'draft','validating','ready','converting','queued','sending',
    'partially_sent','completed','failed','archived'
  )),
  sub_batch_size int not null default 25 check (sub_batch_size in (25, 50)),
  total_rows int not null default 0,
  total_sub_batches int not null default 0,
  sent_count int not null default 0,
  failed_count int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table batch_runs enable row level security;
