-- Additional TP hold columns for upload + clear-with-remarks

ALTER TABLE awb_cases ADD COLUMN IF NOT EXISTS tp_hold_arrival_date timestamptz;
ALTER TABLE awb_cases ADD COLUMN IF NOT EXISTS pieces_arrived text;
ALTER TABLE awb_cases ADD COLUMN IF NOT EXISTS tp_hold_clear_remarks text;
ALTER TABLE awb_cases ADD COLUMN IF NOT EXISTS tp_hold_cleared_at timestamptz;
