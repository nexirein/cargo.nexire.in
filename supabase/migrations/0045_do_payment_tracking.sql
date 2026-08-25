-- NFBRK Delivery Order (DO) payment tracking.
-- The NFBRK end result is: consignee pays DO charges (₹3068 day-of /
-- ₹4248 next-day) to Deldo@corp.ds.fedex.com and we track who paid and
-- who did not. Trace marks payment on the dashboard; this stores it.

alter table awb_cases
  add column if not exists do_payment_status text
    check (do_payment_status in ('pending', 'paid', 'overdue')),
  add column if not exists utr_no text,
  add column if not exists do_amount numeric,
  add column if not exists payment_received_at timestamptz,
  add column if not exists payment_confirmed_by uuid references app_users(id) on delete set null,
  add column if not exists do_payment_notes text;

create index if not exists idx_awb_cases_do_payment
  on awb_cases(do_payment_status)
  where do_payment_status is not null;
