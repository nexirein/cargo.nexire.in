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

create policy select_active_users on batch_checklist_items for select using (app_is_active_user());
create policy insert_active_users on batch_checklist_items for insert with check (app_is_active_user());
create policy update_active_users on batch_checklist_items for update using (app_is_active_user());
