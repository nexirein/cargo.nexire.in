-- Full Tracker: BOE/Clearance/DO lifecycle milestones
-- Adds IGM, BOE, customs clearance, and DO readiness tracking to awb_cases

alter table awb_cases
  add column if not exists igm_number text,
  add column if not exists igm_provided_at timestamptz,
  add column if not exists boe_filed_at timestamptz,
  add column if not exists boe_number text,
  add column if not exists boe_penalty_started_at timestamptz,
  add column if not exists assessment_pending_at timestamptz,
  add column if not exists duty_assessed_at timestamptz,
  add column if not exists duty_amount numeric(12,2),
  add column if not exists out_of_charge_at timestamptz,
  add column if not exists do_ready_at timestamptz,
  add column if not exists clearance_type text;

-- Indexes for new columns
create index if not exists idx_awb_cases_igm_number
  on awb_cases(igm_number);
create index if not exists idx_awb_cases_boe_filed_at
  on awb_cases(boe_filed_at);
create index if not exists idx_awb_cases_clearance_type
  on awb_cases(clearance_type);
create index if not exists idx_awb_cases_do_ready_at
  on awb_cases(do_ready_at);
create index if not exists idx_awb_cases_out_of_charge_at
  on awb_cases(out_of_charge_at);
