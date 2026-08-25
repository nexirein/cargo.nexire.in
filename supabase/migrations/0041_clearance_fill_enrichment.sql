-- Enrich batch_items with fields for the 3-chain auto-fill system
-- Clearance type, broker, and email are resolved independently

-- Resolved FedEx broker value (after auto-fill or AI call)
alter table batch_items
  add column if not exists fedex_broker text;

-- Phone number from Contact column (for Vapi AI calling)
alter table batch_items
  add column if not exists contact_phone text;

-- Raw Standard Remarks (CC emails) from Excel
alter table batch_items
  add column if not exists standard_remarks text;

-- Raw Mail ID from Excel (36K historical format)
alter table batch_items
  add column if not exists mail_id text;

-- Which fields triggered an AI call: ["clearance_type", "broker", "email"]
-- Stored as JSONB array: e.g., '["broker", "email"]' means broker + email need calling
alter table batch_items
  add column if not exists call_reasons jsonb default '[]'::jsonb;

-- Ensure updated_at exists for batch_items
alter table batch_items
  add column if not exists updated_at timestamptz default now();

-- Index for querying call_reasons efficiently
create index if not exists idx_batch_items_call_reasons
  on batch_items using gin (call_reasons);

-- Index for contact_phone queries
create index if not exists idx_batch_items_contact_phone
  on batch_items(contact_phone);

-- Add phone to call_tasks for easier access
alter table call_tasks
  add column if not exists customer_phone text;

-- Add missing_fields tracking on call_tasks
alter table call_tasks
  add column if not exists missing_fields jsonb default '[]'::jsonb;

-- Allow call_type to be a general 'clearance_enrichment' type
-- This covers calls that ask for clearance + broker + email in one conversation
alter table call_tasks
  drop constraint if exists call_tasks_call_type_check,
  add constraint call_tasks_call_type_check
    check (call_type in ('confirmation', 'broker_lookup', 'clearance_enrichment', 'reminder', 'follow_up'));
