create table batch_items (
  id uuid primary key default gen_random_uuid(),
  batch_run_id uuid not null references batch_runs(id) on delete cascade,
  sub_batch_id uuid references sub_batches(id) on delete set null,
  awb text not null,
  consignee_name text,
  consignee_email text,
  shipment_data jsonb not null default '{}'::jsonb,
  attachment_status text not null default 'pending' check (attachment_status in (
    'pending','matched','converted','manual_needed','missing'
  )),
  template_id text not null default 'prealert_v1',
  send_status text not null default 'pending' check (send_status in (
    'pending','queued','processing','sent','retrying','failed','cancelled'
  )),
  attempt_count int not null default 0,
  max_attempts int not null default 5,
  qstash_message_id text,
  send_started_at timestamptz,
  send_completed_at timestamptz,
  next_retry_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_run_id, awb)
);

alter table batch_items enable row level security;
