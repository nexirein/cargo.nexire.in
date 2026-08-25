-- Auto-send pipeline (NFBRK-first):
-- 1. Relax batch_items.send_status check so 'skipped' is legal
--    (process-send-job.ts writes 'skipped' for consol dedup / calling items,
--    but the original 0005 constraint only allowed pending/queued/processing/
--    sent/retrying/failed/cancelled).
-- 2. Track how/when a shipment's clearance path was confirmed, so the
--    dashboard can show why a send happened.

alter table batch_items
  drop constraint if exists batch_items_send_status_check;
alter table batch_items
  add constraint batch_items_send_status_check
    check (send_status in (
      'pending', 'queued', 'processing', 'sent', 'retrying',
      'failed', 'cancelled', 'skipped'
    ));

-- 0005 defaulted template_id to 'prealert_v1', which is not a real template
-- (the seeded pre-alert type is 'nfbrk'). Point the default at the NFBRK one.
alter table batch_items
  alter column template_id set default 'nfbrk';

alter table batch_items
  add column if not exists confirmation_source text
    check (confirmation_source in ('ai_call', 'master', 'sheet', 'manual'));
alter table batch_items
  add column if not exists confirmed_at timestamptz;

create index if not exists idx_batch_items_confirmed
  on batch_items(confirmation_source)
  where confirmation_source is not null;
