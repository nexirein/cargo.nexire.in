-- Add clearance_type to batch_items for end-to-end tracking
-- Extends the 0026_full_tracker migration which added clearance_type to awb_cases

alter table batch_items
  add column if not exists clearance_type text;

create index if not exists idx_batch_items_clearance_type
  on batch_items(clearance_type);

-- Extend templates.type check to include calling, hold, cargo_arrival_notice
alter table templates
  drop constraint if exists templates_type_check;

alter table templates
  add constraint templates_type_check
    check (type in ('nfbrk', 'febrk-jeena', 'febrk-sunimpex', 'calling', 'hold', 'cargo_arrival_notice', 'custom'));
