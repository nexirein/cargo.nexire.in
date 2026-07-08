-- Not in the spec's literal section-12 SQL, but required by spec 7.2/7.4:
-- "each sub-batch gets its own progress and retry state."
create table sub_batches (
  id uuid primary key default gen_random_uuid(),
  batch_run_id uuid not null references batch_runs(id) on delete cascade,
  sub_batch_index int not null,
  status text not null default 'pending' check (status in (
    'pending','queued','processing','completed','partially_failed','failed'
  )),
  total_items int not null default 0,
  sent_count int not null default 0,
  failed_count int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_run_id, sub_batch_index)
);

alter table sub_batches enable row level security;
