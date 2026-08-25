-- Templates table: stores email templates that are admin-customizable
create table templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('nfbrk', 'febrk-jeena', 'febrk-sunimpex', 'custom')),
  description text,
  subject_template text not null,
  body_html text not null,
  cc_emails text[] not null default '{}',
  fixed_attachment_paths text[] not null default '{}',
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table templates enable row level security;

-- Seed NFBRK template (customer uses their own CHA/broker)
insert into templates (name, type, description, subject_template, body_html, cc_emails, fixed_attachment_paths) values
(
  'NFBRK — Non-FedEx Broker',
  'nfbrk',
  'For shipments where the customer appoints their own Customs House Agent. Includes DO collection process and bank details.',
  'Pre Alert - {AWB} / {CONSIGNEE_NAME}',
  '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a;">
<p>Dear Sir/Madam,</p>
<p>I would like to apprise you that said Shipment expected to arrive under DELHI cargo-mode. We respect your decision to appoint your own broker for clearance of this shipment.</p>
<p>Please find the attached AWB/CI in &ldquo;.tiff&rdquo; format for filling the documents. (Open with Window Photo Viewer)</p>
<p>The shipment is expected to arrive, MAWB and IGM will be provided once generated.</p>
<p>You may file BOE in prior without MAWB to avoid late penalty.</p>
<p>Further if you need FedEx Authorized Broker (JEENA/SUNIMPEX) to clear the shipment, Please write to darain.saad@fedex.com; jane.alam@fedex.com; ayush.saklani@fedex.com; neha.sambhyal@fedex.com; priyansh.sinha@fedex.com; ravi.singh2@fedex.com; prabhat.vaish@fedex.com; talib.ahmed@fedex.com; surojit.biswas@fedex.com with the subject line of the email as below</p>
<p><strong>Shipment Delivery Note</strong> &ndash; If shipment is cleared by consignee&rsquo;s own CHA/Broker, delivery will be done by their appointed Broker. FedEx will not be responsible for delivery of the shipment irrespective of billing terms mentioned on AWB/Invoice copy.</p>
<br/>
<h3>Process to follow for Online DO Collection</h3>
<p>1. To release the online Delivery Order (DO), Please provide below details on <strong>Deldo@corp.ds.fedex.com</strong>.</p>
<ul>
  <li>Please provide authorization letter (in favor of Broker) from Consignee Official Email-ID. (Attached in the format)</li>
  <li>Kindly make the D.O Payment through NEFT mode of INR 3068/- on given FedEx Bank Account detail. (Refer Attachment)</li>
  <li>DO Payment clear editable details UTR/IMPS pasted on mail to: <strong>deldo@corp.ds.fedex.com</strong></li>
</ul>
<p>DO charges are 3068/- INR. (2600+18%GST)</p>
<p>Authority letter and GST details are compulsory</p>
<br/>
<table style="border-collapse:collapse;width:100%;font-size:13px;">
  <tr style="background:#f1f5f9;"><th style="padding:8px;text-align:left;border:1px solid #e2e8f0;"></th><th style="padding:8px;text-align:left;border:1px solid #e2e8f0;">Day of arrival</th><th style="padding:8px;text-align:left;border:1px solid #e2e8f0;">Next day onwards</th></tr>
  <tr><td style="padding:8px;border:1px solid #e2e8f0;">DO Charges (INR)</td><td style="padding:8px;border:1px solid #e2e8f0;">2600</td><td style="padding:8px;border:1px solid #e2e8f0;">2600</td></tr>
  <tr><td style="padding:8px;border:1px solid #e2e8f0;">ADMIN FEES</td><td style="padding:8px;border:1px solid #e2e8f0;">0</td><td style="padding:8px;border:1px solid #e2e8f0;">1000</td></tr>
  <tr><td style="padding:8px;border:1px solid #e2e8f0;">GST (18%)</td><td style="padding:8px;border:1px solid #e2e8f0;">468</td><td style="padding:8px;border:1px solid #e2e8f0;">648</td></tr>
  <tr style="font-weight:bold;"><td style="padding:8px;border:1px solid #e2e8f0;">Total</td><td style="padding:8px;border:1px solid #e2e8f0;">3068</td><td style="padding:8px;border:1px solid #e2e8f0;">4248</td></tr>
</table>
<p style="margin-top:12px;"><em>**Effective November 22, 2023, there is change in the admin fees applicable on the Delivery Order (DO) on Inbound shipments.</em></p>
<p><em>**In case the DO is not collected on the day of arrival, an additional fee of INR 1000 + 18% GST will be applicable.</em></p>
<br/>
<h3>Important Note</h3>
<p>As per attached Notification no 34/2021 Dated 29-03-2021 with immediate effect, Bill of Entry needs to be filed by the end of the day of arrival of the shipment to avoid fine for late filing of BOE.</p>
<ul>
  <li>Rs.5000.00 per day from the 1st day of the shipment arrival for 3 days.</li>
  <li>Rs.10000.00 per day from the 4th day onwards till the day of filling.</li>
</ul>
<p>In this connection we request you to kindly provide us the shipment related pre-alert &amp; clearance documents within 3 hours of receipt of this mail, thus enabling us to proceed with the required documentation formalities and filing of the BOE in Advance / within the exempted period (as specified above) of arrival.</p>
<p>If there is any delay in providing the clearance documents, the carrier or clearance broker will not be held responsible for additional charges incurring due to late presentation of BOE.</p>
<br/>
<p>Thanks &amp; Regards,</p>
<p>FedEx Trace Team</p>
</div>',
  array[]::text[],
  array['DO FORMAT.docx', 'BANK DETAILS.docx']
);

-- Seed FEBRK-Jeena template
insert into templates (name, type, description, subject_template, body_html, cc_emails, fixed_attachment_paths) values
(
  'FEBRK — Jeena & Co.',
  'febrk-jeena',
  'For shipments cleared by FedEx nominated broker Jeena & Co. Includes clearance process and charges.',
  'CARGO ARRIVAL NOTICE- Pre Alert AWB and freight charges : {AWB} {CONSIGNEE_NAME} {FREIGHT}_{CURRENCY} | FEBRK-DDP',
  '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a;">
<p>Dear Sir / Madam,</p>
<p>This shipment will arrive under Cargo mode and be cleared by FedEx&rsquo;s nominated broker, <strong>JEENA &amp; CO.</strong></p>
<br/>
<h3>Key Reminders</h3>
<ul>
  <li>Do not pay duty before filing IGM.</li>
  <li>Office closes at 6:00 pm &mdash; checklist approvals must be completed before this to avoid late filing penalties.</li>
</ul>
<br/>
<h3>Cargo Clearance &ndash; 3 Steps</h3>
<ol>
  <li><strong>Checklist preparation and approval.</strong></li>
  <li><strong>Prior Bill of Entry filing.</strong></li>
  <li><strong>Customs clearance process and release.</strong></li>
</ol>
<br/>
<h3>Checklist approval</h3>
<ul>
  <li>KYC docs to be shared to prepare the duty checklist.</li>
  <li>Detailed invoice with item descriptions.</li>
  <li>End use of items/consignment (product catalogue if available).</li>
</ul>
<h3>Bill of Entry filing</h3>
<ul>
  <li>PAN-based IEC Code</li>
  <li>Catalogue/technical write-up</li>
  <li>End use details / previous BOE of similar import</li>
  <li>KYC form + supporting docs (ignore if already shared)</li>
  <li>Duty exemption/benefit details</li>
  <li>Authorized Dealer (A.D) code from bank</li>
  <li>GST certificate copy</li>
</ul>
<h3>Customs clearance</h3>
<ul>
  <li>Additional documents may be requested by customs during release.</li>
</ul>
<br/>
<h3>Charges</h3>
<ul>
  <li>Customs Clearance: INR 3000 + GST</li>
  <li>Service Tax: As per applicable rates</li>
  <li>AAI (Warehouse): As per actual receipts.</li>
  <li>Customs Duty: As per actual receipts.</li>
  <li>Duty Advancement Fee: 2% of invoice OR INR 800 (whichever higher)</li>
</ul>
<br/>
<h3>Late BOE Filing Penalties (Notification No. 34/2021)</h3>
<ul>
  <li>INR 5000/day for first 3 days after arrival</li>
  <li>INR 10,000/day from 4th day onwards</li>
</ul>
<br/>
<p><strong>Action Required:</strong> Please provide shipment pre-alert and clearance documents within 3 hours of this mail to enable timely filing and avoid penalties. Delays will result in additional charges, for which FedEx or Jeena &amp; Co. cannot be held responsible.</p>
<br/>
<p>Thanks &amp; Regards,</p>
<p>FedEx Trace Team</p>
</div>',
  array[
    'del-fedex.imports@jeena.co.in',
    'madhikari@jeena.co.in',
    'syogesh@jeena.co.in',
    'adtaneja@jeena.co.in',
    'sdutt@jeena.co.in',
    'vjain1@jeena.co.in',
    'ssingh@jeena.co.in',
    'aanand1@jeena.co.in',
    'kbihari@jeena.co.in',
    'iphvdelcargo@corp.ds.fedex.com'
  ],
  array[]::text[]
);

-- Seed FEBRK-Sunimpex template
insert into templates (name, type, description, subject_template, body_html, cc_emails, fixed_attachment_paths) values
(
  'FEBRK — Sunimpex',
  'febrk-sunimpex',
  'For shipments cleared by FedEx nominated broker Sunimpex. Includes clearance process and charges.',
  'CARGO ARRIVAL NOTICE- Pre Alert AWB and freight charges : {AWB} {CONSIGNEE_NAME} {FREIGHT}_{CURRENCY} | FEBRK-DDU',
  '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;color:#0f172a;">
<p>Dear Sir / Madam,</p>
<p>This shipment will arrive under Cargo mode and be cleared by FedEx&rsquo;s nominated broker, <strong>SUNIMPEX</strong>.</p>
<br/>
<h3>Key Reminders</h3>
<ul>
  <li>Do not pay duty before filing IGM.</li>
  <li>Office closes at 6:00 pm &mdash; checklist approvals must be completed before this to avoid late filing penalties.</li>
</ul>
<br/>
<h3>Cargo Clearance &ndash; 3 Steps</h3>
<ol>
  <li><strong>Checklist preparation and approval.</strong></li>
  <li><strong>Prior Bill of Entry filing.</strong></li>
  <li><strong>Customs clearance process and release.</strong></li>
</ol>
<br/>
<h3>Checklist approval</h3>
<ul>
  <li>KYC docs to be shared to prepare the duty checklist.</li>
  <li>Detailed invoice with item descriptions.</li>
  <li>End use of items/consignment (product catalogue if available).</li>
</ul>
<h3>Bill of Entry filing</h3>
<ul>
  <li>PAN-based IEC Code</li>
  <li>Catalogue/technical write-up</li>
  <li>End use details / previous BOE of similar import</li>
  <li>KYC form + supporting docs (ignore if already shared)</li>
  <li>Duty exemption/benefit details</li>
  <li>Authorized Dealer (A.D) code from bank</li>
  <li>GST certificate copy</li>
</ul>
<h3>Customs clearance</h3>
<ul>
  <li>Additional documents may be requested by customs during release.</li>
</ul>
<br/>
<h3>Charges</h3>
<ul>
  <li>Customs Clearance: INR 3000 + GST</li>
  <li>Service Tax: As per applicable rates</li>
  <li>AAI (Warehouse): As per actual receipts.</li>
  <li>Customs Duty: As per actual receipts.</li>
  <li>Duty Advancement Fee: 2% of invoice OR INR 800 (whichever higher)</li>
</ul>
<br/>
<h3>Late BOE Filing Penalties (Notification No. 34/2021)</h3>
<ul>
  <li>INR 5000/day for first 3 days after arrival</li>
  <li>INR 10,000/day from 4th day onwards</li>
</ul>
<br/>
<p><strong>Action Required:</strong> Please provide shipment pre-alert and clearance documents within 3 hours of this mail to enable timely filing and avoid penalties. Delays will result in additional charges, for which FedEx or Sunimpex cannot be held responsible.</p>
<br/>
<p>Thanks &amp; Regards,</p>
<p>FedEx Trace Team</p>
</div>',
  array[
    'csdel@sunimpexcsa.com',
    'iphvdelcargo@corp.ds.fedex.com'
  ],
  array[]::text[]
);

-- Add template_id to batch_runs
alter table batch_runs add column template_id uuid references templates(id);

-- Add file source columns to batch_runs (for ZIP/folder source of invoice files)
alter table batch_runs add column file_source_type text check (file_source_type in ('folder', 'zip'));
alter table batch_runs add column file_source_path text;

-- RLS: same pattern as other tables
create policy select_active_users on templates for select
  using (app_is_active_user());

-- Set updated_at on templates
create trigger trg_templates_updated_at before update on templates
  for each row execute function set_updated_at();
