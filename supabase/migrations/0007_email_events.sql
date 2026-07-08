-- Append-only record of actual transmissions/receipts. batch_items owns
-- mutable send job-state; this table is the source of truth for what was
-- actually sent/received, never updated after insert.
create table email_events (
  id uuid primary key default gen_random_uuid(),
  batch_run_id uuid references batch_runs(id),
  batch_item_id uuid references batch_items(id),
  sub_batch_id uuid references sub_batches(id),
  awb text,
  direction text not null check (direction in ('outbound','inbound')),
  message_id text,
  internet_message_id text,
  conversation_id text,
  subject text,
  body_clean text,
  sender_email text,
  recipient_emails text[],
  received_at timestamptz,
  sent_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table email_events enable row level security;
