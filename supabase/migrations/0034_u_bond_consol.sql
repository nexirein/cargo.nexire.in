-- Phase: uBond / Consol split for Pre-alert batches
-- Adds pre_alert_type discriminator to batch_runs

ALTER TABLE batch_runs ADD COLUMN IF NOT EXISTS pre_alert_type text DEFAULT 'u_bond'
  CHECK (pre_alert_type IN ('u_bond', 'consol'));

CREATE INDEX IF NOT EXISTS idx_batch_runs_pre_alert_type ON batch_runs(pre_alert_type);

-- Extend shipment_phase on awb_cases to include u_bond / consol
ALTER TABLE awb_cases DROP CONSTRAINT IF EXISTS awb_cases_shipment_phase_check;
ALTER TABLE awb_cases ADD CONSTRAINT awb_cases_shipment_phase_check
  CHECK (shipment_phase <@ ARRAY['pre_alert', 'post_arrival', 'u_bond', 'consol']);

-- Track pre-alert type on awb_cases (u_bond, consol, or post_arrival for non-pre-alert)
ALTER TABLE awb_cases ADD COLUMN IF NOT EXISTS pre_alert_type text
  CHECK (pre_alert_type IN ('u_bond', 'consol', 'post_arrival'));

CREATE INDEX IF NOT EXISTS idx_awb_cases_pre_alert_type ON awb_cases(pre_alert_type);
