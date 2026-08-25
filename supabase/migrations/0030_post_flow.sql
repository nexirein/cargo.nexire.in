-- Phase: Post-Arrival flow + TP Hold + Unified batch phases

-- 1. Phase on batch_runs
ALTER TABLE batch_runs ADD COLUMN IF NOT EXISTS phase text DEFAULT 'pre_alert'
  CHECK (phase IN ('pre_alert', 'post_arrival', 'tp_hold'));

-- 2. Shipment phase tracking on awb_cases
ALTER TABLE awb_cases ADD COLUMN IF NOT EXISTS shipment_phase text[] DEFAULT '{pre_alert}'
  CHECK (shipment_phase <@ ARRAY['pre_alert', 'post_arrival']);

-- 3. Post-arrival metadata on awb_cases
ALTER TABLE awb_cases ADD COLUMN IF NOT EXISTS mawb text;
ALTER TABLE awb_cases ADD COLUMN IF NOT EXISTS igm_number text;
ALTER TABLE awb_cases ADD COLUMN IF NOT EXISTS igm_date timestamptz;
ALTER TABLE awb_cases ADD COLUMN IF NOT EXISTS flight_number text;
ALTER TABLE awb_cases ADD COLUMN IF NOT EXISTS origin_port text;
ALTER TABLE awb_cases ADD COLUMN IF NOT EXISTS dest_port text;
ALTER TABLE awb_cases ADD COLUMN IF NOT EXISTS hsn_code text;
ALTER TABLE awb_cases ADD COLUMN IF NOT EXISTS invoice_value numeric;

-- 4. TP hold tracking
ALTER TABLE awb_cases ADD COLUMN IF NOT EXISTS tp_hold_reason text;
ALTER TABLE awb_cases ADD COLUMN IF NOT EXISTS tp_hold_status text;
ALTER TABLE awb_cases ADD COLUMN IF NOT EXISTS tp_hold_arrival_source text;
ALTER TABLE awb_cases ADD COLUMN IF NOT EXISTS tp_hold_arrival_date timestamptz;
ALTER TABLE awb_cases ADD COLUMN IF NOT EXISTS tp_hold_updated_at timestamptz;
ALTER TABLE awb_cases ADD COLUMN IF NOT EXISTS pieces_arrived text;
ALTER TABLE awb_cases ADD COLUMN IF NOT EXISTS tp_hold_clear_remarks text;
ALTER TABLE awb_cases ADD COLUMN IF NOT EXISTS tp_hold_cleared_at timestamptz;

-- 5. Batch phase index
CREATE INDEX IF NOT EXISTS idx_batch_runs_phase ON batch_runs(phase);

-- 6. Call tracking enhancements
ALTER TABLE call_tasks ADD COLUMN IF NOT EXISTS batch_item_id uuid REFERENCES batch_items(id);
ALTER TABLE call_tasks ADD COLUMN IF NOT EXISTS call_type text DEFAULT 'confirmation'
  CHECK (call_type IN ('confirmation', 'reminder', 'follow_up'));
ALTER TABLE call_tasks ADD COLUMN IF NOT EXISTS duration_seconds int;
ALTER TABLE call_tasks ADD COLUMN IF NOT EXISTS vapi_call_id text;
ALTER TABLE call_tasks ADD COLUMN IF NOT EXISTS result_data jsonb;

-- 7. Extend templates type constraint
ALTER TABLE templates DROP CONSTRAINT IF EXISTS templates_type_check;
ALTER TABLE templates ADD CONSTRAINT templates_type_check
  CHECK (type IN (
    'nfbrk', 'febrk-jeena', 'febrk-sunimpex',
    'calling', 'hold',
    'cargo_arrival_notice', 'post_day_1', 'post_day_2', 'post_reminder',
    'post_igm_retry', 'custom'
  ));

-- ============================================================
-- SEED POST-ARRIVAL TEMPLATES
-- ============================================================

-- cargo_arrival_notice: sent when post-arrival batch is processed
INSERT INTO templates (name, type, description, subject_template, body_html, cc_emails, fixed_attachment_paths) VALUES
(
  'Cargo Arrival Notice — Post-IGM',
  'cargo_arrival_notice',
  'Sent after IGM is filed and shipment has arrived. Informs consignee of arrival and requests clearance documents.',
  'CARGO ARRIVAL NOTICE -> Pre Alert | TRK NO : {AWB}, {CONSIGNEE_NAME} (FREIGHT :{FREIGHT} {CURRENCY}) | {END_RESULT}',
  '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a;">
<p>Dear Sir/Madam,</p>
<p>This is with regards to subject shipment; we would like to inform you that the said shipment will arrive in {DEST_PORT} for formal clearance.</p>
<p>PFA the AWB and invoice in .tiff format.</p>
<br/>
<h3>Clearance Options</h3>
<p><strong>A. FedEx CHA clearance</strong> &mdash; FedEx clearance charges will be Rs 3000.00 + GST.</p>
<p><strong>B. Your nominated CHA clearance</strong> &mdash; Collect DO from FedEx and appoint your own broker.</p>
<br/>
<h3>Documents Required</h3>
<ul>
  <li>KYC Form with supporting documents (duly self-attested)</li>
  <li>Authorization letter, 2 Sets of GATT/Import Declaration forms</li>
  <li>Commercial Invoice/Packing List with item-wise NET &amp; GROSS WEIGHT</li>
  <li>Technical write-up clarifying the item along with end-use</li>
  <li>Bank AD Code Number</li>
  <li>IEC Copy &amp; GST Copy &amp; EWAY Bill</li>
  <li>EPR Certificate (for plastics/e-waste/battery)</li>
  <li>LMPC registration (for pre-packed commodities)</li>
</ul>
<br/>
<h3>Important Note</h3>
<p>Customs Notification no 34/2021: Bill of Entry must be filed by end of day of arrival to avoid late filing penalties.</p>
<ul>
  <li>Rs. 5,000 per day from the 2nd day of arrival</li>
  <li>Rs. 10,000 per day from the 3rd day onwards</li>
</ul>
<br/>
<h3>Delivery Order Charges</h3>
<table style="border-collapse:collapse;width:100%;font-size:13px;">
  <tr style="background:#f1f5f9;"><th style="padding:8px;text-align:left;border:1px solid #e2e8f0;"></th><th style="padding:8px;text-align:left;border:1px solid #e2e8f0;">Day of arrival</th><th style="padding:8px;text-align:left;border:1px solid #e2e8f0;">Next day onwards</th></tr>
  <tr><td style="padding:8px;border:1px solid #e2e8f0;">DO Charges (INR)</td><td style="padding:8px;border:1px solid #e2e8f0;">2600</td><td style="padding:8px;border:1px solid #e2e8f0;">2600</td></tr>
  <tr><td style="padding:8px;border:1px solid #e2e8f0;">Admin Fees</td><td style="padding:8px;border:1px solid #e2e8f0;">0</td><td style="padding:8px;border:1px solid #e2e8f0;">1000</td></tr>
  <tr><td style="padding:8px;border:1px solid #e2e8f0;">GST (18%)</td><td style="padding:8px;border:1px solid #e2e8f0;">468</td><td style="padding:8px;border:1px solid #e2e8f0;">648</td></tr>
  <tr style="font-weight:bold;"><td style="padding:8px;border:1px solid #e2e8f0;">Total</td><td style="padding:8px;border:1px solid #e2e8f0;">3068</td><td style="padding:8px;border:1px solid #e2e8f0;">4248</td></tr>
</table>
<br/>
<p><em>**Effective November 22, 2023, if the DO is not collected on the day of arrival, an additional fee of INR 1000 + 18% GST will be applicable.</em></p>
<br/>
<h3>Bank Details for Payment</h3>
<p><strong>Bank:</strong> Bank of America<br/>
<strong>Account:</strong> 72790060<br/>
<strong>IFSC:</strong> BOFA0MM6205<br/>
<strong>MICR:</strong> 400032002</p>
<br/>
<p>Please provide documents within 1630 hours (working days) / 1430 hours (customs holidays) to enable timely BOE filing.</p>
<br/>
<p>Thanks &amp; Regards,</p>
<p>FedEx Trace Team</p>
</div>',
  array[]::text[],
  array['DO FORMAT.docx', 'BANK DETAILS.docx']
);

-- post_day_1: sent same day after IGM generation
INSERT INTO templates (name, type, description, subject_template, body_html, cc_emails, fixed_attachment_paths) VALUES
(
  'Post-Arrival — Same Day (Day 1)',
  'post_day_1',
  'First follow-up sent same day after IGM. Urges DO collection to avoid admin fee.',
  'DO Collection Reminder - AWB {AWB} / {CONSIGNEE_NAME} | Same Day',
  '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a;">
<p>Dear Sir/Ma''am,</p>
<p>Shipment has arrived at Delhi Port in Cargo Mode. Please refer details below to file Bill of Entry by your CHA.</p>
<br/>
<p><strong>Please collect the DO from Deldo@corp.ds.fedex.com by the end of today to avoid the Rs 1180/- admin fee.</strong></p>
<br/>
<p>Note: DO charges are Rs 3068/- INR (2600+18%GST) Per Shipment</p>
<p>UTR no./Payment Transfer details, Authority letter and GST details are compulsory.</p>
<br/>
<table style="border-collapse:collapse;width:100%;font-size:13px;">
  <tr style="background:#f1f5f9;"><th style="padding:8px;text-align:left;border:1px solid #e2e8f0;"></th><th style="padding:8px;text-align:left;border:1px solid #e2e8f0;">Day of arrival</th><th style="padding:8px;text-align:left;border:1px solid #e2e8f0;">Next day onwards</th></tr>
  <tr><td style="padding:8px;border:1px solid #e2e8f0;">DO Charges (INR)</td><td style="padding:8px;border:1px solid #e2e8f0;">2600</td><td style="padding:8px;border:1px solid #e2e8f0;">2600</td></tr>
  <tr><td style="padding:8px;border:1px solid #e2e8f0;">Admin Fees</td><td style="padding:8px;border:1px solid #e2e8f0;">0</td><td style="padding:8px;border:1px solid #e2e8f0;">1000</td></tr>
  <tr><td style="padding:8px;border:1px solid #e2e8f0;">GST (18%)</td><td style="padding:8px;border:1px solid #e2e8f0;">468</td><td style="padding:8px;border:1px solid #e2e8f0;">648</td></tr>
  <tr style="font-weight:bold;"><td style="padding:8px;border:1px solid #e2e8f0;">Total</td><td style="padding:8px;border:1px solid #e2e8f0;">3068</td><td style="padding:8px;border:1px solid #e2e8f0;">4248</td></tr>
</table>
<br/>
<p>Please write to DEL D.O. at <strong>Deldo@corp.ds.fedex.com</strong> for D.O. Collection.</p>
<p>Please write to <strong>india@fedex.com</strong> for FREIGHT related queries.</p>
<p>This shipment will only be cleared from customs by your own Broker/Custom House Agent (CHA).</p>
<br/>
<p>Thanks &amp; Regards,</p>
<p>FedEx Trace Team</p>
</div>',
  array[]::text[],
  array[]::text[]
);

-- post_day_2: second day follow-up
INSERT INTO templates (name, type, description, subject_template, body_html, cc_emails, fixed_attachment_paths) VALUES
(
  'Post-Arrival — Next Day (Day 2)',
  'post_day_2',
  'Second follow-up sent next day. DO charges now include admin fee.',
  'DO Collection Reminder - AWB {AWB} / {CONSIGNEE_NAME} | Next Day',
  '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a;">
<p>Dear Sir/Ma''am,</p>
<p>Shipment has arrived at Delhi Port in Cargo Mode. Please refer details below to file Bill of Entry by your CHA.</p>
<br/>
<p><strong>Note: DO charges are now Rs 4248/- INR (3600+18%GST) Per Shipment as the same-day period has passed.</strong></p>
<br/>
<p>Authority letter and GST details are compulsory.</p>
<br/>
<table style="border-collapse:collapse;width:100%;font-size:13px;">
  <tr style="background:#f1f5f9;"><th style="padding:8px;text-align:left;border:1px solid #e2e8f0;"></th><th style="padding:8px;text-align:left;border:1px solid #e2e8f0;">Day of arrival</th><th style="padding:8px;text-align:left;border:1px solid #e2e8f0;">Next day onwards</th></tr>
  <tr><td style="padding:8px;border:1px solid #e2e8f0;">DO Charges (INR)</td><td style="padding:8px;border:1px solid #e2e8f0;">2600</td><td style="padding:8px;border:1px solid #e2e8f0;">2600</td></tr>
  <tr><td style="padding:8px;border:1px solid #e2e8f0;">Admin Fees</td><td style="padding:8px;border:1px solid #e2e8f0;">0</td><td style="padding:8px;border:1px solid #e2e8f0;">1000</td></tr>
  <tr><td style="padding:8px;border:1px solid #e2e8f0;">GST (18%)</td><td style="padding:8px;border:1px solid #e2e8f0;">468</td><td style="padding:8px;border:1px solid #e2e8f0;">648</td></tr>
  <tr style="font-weight:bold;"><td style="padding:8px;border:1px solid #e2e8f0;">Total</td><td style="padding:8px;border:1px solid #e2e8f0;">3068</td><td style="padding:8px;border:1px solid #e2e8f0;">4248</td></tr>
</table>
<br/>
<p>Please write to DEL D.O. at <strong>Deldo@corp.ds.fedex.com</strong> for D.O. Collection.</p>
<p>Please write to <strong>india@fedex.com</strong> for FREIGHT related queries.</p>
<br/>
<p>Thanks &amp; Regards,</p>
<p>FedEx Trace Team</p>
</div>',
  array[]::text[],
  array[]::text[]
);

-- post_reminder: first day reminder (for automated cron follow-ups)
INSERT INTO templates (name, type, description, subject_template, body_html, cc_emails, fixed_attachment_paths) VALUES
(
  'Post-Arrival — Reminder (Day 1 Reminder)',
  'post_reminder',
  'Automated reminder sent via cron. Reminds consignee to collect DO and avoid admin fee.',
  'Reminder - DO Collection Pending - AWB {AWB} / {CONSIGNEE_NAME}',
  '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a;">
<p>Dear Sir/Mam,</p>
<p><strong>First Reminder</strong></p>
<p>Please collect the DO by the end of today to avoid the Rs 1180/- admin fee as mentioned in the previous email.</p>
<br/>
<p>This is a reminder to kindly collect the Delivery Order (D.O.) by the end of today. The D.O. is still pending for collection.</p>
<p>For collection, please write to <strong>Deldo@corp.ds.fedex.com</strong>, including the payment details and authority letter.</p>
<br/>
<p>Note: DO charges are Rs 3068/- INR (2600+18%GST)</p>
<p><strong>Next Day DO charges will be Rs 4248/- INR (3600+18%GST)</strong></p>
<br/>
<table style="border-collapse:collapse;width:100%;font-size:13px;">
  <tr style="background:#f1f5f9;"><th style="padding:8px;text-align:left;border:1px solid #e2e8f0;"></th><th style="padding:8px;text-align:left;border:1px solid #e2e8f0;">Day of arrival</th><th style="padding:8px;text-align:left;border:1px solid #e2e8f0;">Next day onwards</th></tr>
  <tr><td style="padding:8px;border:1px solid #e2e8f0;">DO Charges (INR)</td><td style="padding:8px;border:1px solid #e2e8f0;">2600</td><td style="padding:8px;border:1px solid #e2e8f0;">2600</td></tr>
  <tr><td style="padding:8px;border:1px solid #e2e8f0;">Admin Fees</td><td style="padding:8px;border:1px solid #e2e8f0;">0</td><td style="padding:8px;border:1px solid #e2e8f0;">1000</td></tr>
  <tr><td style="padding:8px;border:1px solid #e2e8f0;">GST (18%)</td><td style="padding:8px;border:1px solid #e2e8f0;">468</td><td style="padding:8px;border:1px solid #e2e8f0;">648</td></tr>
  <tr style="font-weight:bold;"><td style="padding:8px;border:1px solid #e2e8f0;">Total</td><td style="padding:8px;border:1px solid #e2e8f0;">3068</td><td style="padding:8px;border:1px solid #e2e8f0;">4248</td></tr>
</table>
<br/>
<p>Authority letter and GST details are compulsory.</p>
<p>Please write to DEL D.O. Team at <strong>Deldo@corp.ds.fedex.com</strong> for D.O. Collection.</p>
<br/>
<p>Thanks &amp; Regards,</p>
<p>FedEx Trace Team</p>
</div>',
  array[]::text[],
  array[]::text[]
);

-- post_igm_retry: when ICEGATE is down and IGM not yet generated
INSERT INTO templates (name, type, description, subject_template, body_html, cc_emails, fixed_attachment_paths) VALUES
(
  'Post-Arrival — IGM Retry (ICEGATE Down)',
  'post_igm_retry',
  'Sent when ICEGATE is down and IGM is not yet generated. Consignee monitors AIRIGM for IGM number.',
  'DUE TO ICEGATE ISSUE IGM NOT GENERATED - AWB {AWB} / {CONSIGNEE_NAME}',
  '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a;">
<p>Dear Sir/Madam,</p>
<p>DUE TO ICEGATE ISSUE IGM NOT GENERATED. Please monitor AIRIGM for IGM NO. at <a href="https://foservices.icegate.gov.in/#/public-enquiries/document-status/air-igm">https://foservices.icegate.gov.in</a></p>
<br/>
<p>Shipment has arrived at Delhi Port in Cargo Mode.</p>
<br/>
<p>HAWB No.: {AWB}</p>
<p>MAWB No.: {MAWB}</p>
<p>Consignee Name: {CONSIGNEE_NAME}</p>
<br/>
<p>Note: DO charges are Rs 3068/- INR (2600+18%GST)</p>
<p>Authority letter and GST details are compulsory.</p>
<br/>
<table style="border-collapse:collapse;width:100%;font-size:13px;">
  <tr style="background:#f1f5f9;"><th style="padding:8px;text-align:left;border:1px solid #e2e8f0;">AWB NO</th><th style="padding:8px;text-align:left;border:1px solid #e2e8f0;">Consignee GSTNO</th><th style="padding:8px;text-align:left;border:1px solid #e2e8f0;">UTR NO</th><th style="padding:8px;text-align:left;border:1px solid #e2e8f0;">Remitter Account Name</th></tr>
  <tr><td style="padding:8px;border:1px solid #e2e8f0;">{AWB}</td><td style="padding:8px;border:1px solid #e2e8f0;"></td><td style="padding:8px;border:1px solid #e2e8f0;"></td><td style="padding:8px;border:1px solid #e2e8f0;"></td></tr>
</table>
<br/>
<table style="border-collapse:collapse;width:100%;font-size:13px;">
  <tr style="background:#f1f5f9;"><th style="padding:8px;text-align:left;border:1px solid #e2e8f0;"></th><th style="padding:8px;text-align:left;border:1px solid #e2e8f0;">Day of arrival</th><th style="padding:8px;text-align:left;border:1px solid #e2e8f0;">Next day onwards</th></tr>
  <tr><td style="padding:8px;border:1px solid #e2e8f0;">DO Charges (INR)</td><td style="padding:8px;border:1px solid #e2e8f0;">2600</td><td style="padding:8px;border:1px solid #e2e8f0;">2600</td></tr>
  <tr><td style="padding:8px;border:1px solid #e2e8f0;">Admin Fees</td><td style="padding:8px;border:1px solid #e2e8f0;">0</td><td style="padding:8px;border:1px solid #e2e8f0;">1000</td></tr>
  <tr><td style="padding:8px;border:1px solid #e2e8f0;">GST (18%)</td><td style="padding:8px;border:1px solid #e2e8f0;">468</td><td style="padding:8px;border:1px solid #e2e8f0;">648</td></tr>
  <tr style="font-weight:bold;"><td style="padding:8px;border:1px solid #e2e8f0;">Total</td><td style="padding:8px;border:1px solid #e2e8f0;">3068</td><td style="padding:8px;border:1px solid #e2e8f0;">4248</td></tr>
</table>
<br/>
<p>Please write to DEL D.O. at <strong>Deldo@corp.ds.fedex.com</strong> for D.O. Collection.</p>
<p>Effective November 22, 2023, if the DO is not collected on the day of arrival, an additional fee of INR 1000 + 18% GST will be applicable.</p>
<br/>
<p>Thank you for your continued support.</p>
<br/>
<p>Best Regards,</p>
<p>FedEx Team</p>
</div>',
  array[]::text[],
  array[]::text[]
);
