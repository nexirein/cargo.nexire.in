-- Fix: migration 0034_u_bond_consol was only half-applied.
-- batch_runs.pre_alert_type exists, but awb_cases.pre_alert_type does not,
-- which makes every awb_cases SELECT that references it error out
-- (empty cases tracker). Idempotent.

ALTER TABLE awb_cases ADD COLUMN IF NOT EXISTS pre_alert_type text
  CHECK (pre_alert_type IN ('u_bond', 'consol', 'post_arrival'));

CREATE INDEX IF NOT EXISTS idx_awb_cases_pre_alert_type ON awb_cases(pre_alert_type);

-- Shipment phase constraint: allow u_bond / consol (idempotent)
ALTER TABLE awb_cases DROP CONSTRAINT IF EXISTS awb_cases_shipment_phase_check;
ALTER TABLE awb_cases ADD CONSTRAINT awb_cases_shipment_phase_check
  CHECK (shipment_phase <@ ARRAY['pre_alert', 'post_arrival', 'u_bond', 'consol']);
