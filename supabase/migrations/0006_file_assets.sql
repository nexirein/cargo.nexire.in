create table file_assets (
  id uuid primary key default gen_random_uuid(),
  batch_run_id uuid references batch_runs(id) on delete cascade,
  batch_item_id uuid references batch_items(id) on delete cascade,
  awb text,
  original_name text not null,
  source_format text not null,
  derived_format text,
  storage_path text,
  checksum text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table file_assets enable row level security;
