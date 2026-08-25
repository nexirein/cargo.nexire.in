# Cargo Pre-Alert Operations Model

## 1. Business Context

### The Team
The cargo operations team is split into two groups:
- **Prior (Pre-Alert)** — handles shipments before/during flight landing (same-day focus)
- **Post** — handles shipments after customs clearance

This system focuses on **Pre-Alert** operations.

### The Department's Role
The cargo team sits between **customs** and **customers**:
- Collects documents: Bill of Entry, DO (Delivery Order) charges, etc.
- Coordinates between customs brokers and consignees
- Ensures timely BOE (Bill of Entry) filing to avoid penalties

### Two Clearance Paths

| Path | Broker | Description |
|------|--------|-------------|
| **NFBRK** (Non-FedEx Broker) | Customer's own CHA (Customs House Agent) | Customer appoints their own broker; FedEx provides the AWB/invoice and DO process |
| **FEBRK** (FedEx Broker) | FedEx's nominated 3rd-party CHA: **Jeena & Co.** or **Sunimpex** | FedEx manages the full clearance through their appointed broker |

---

## 2. Current Manual Process

### How Pre-Alerts Are Sent Today
1. Team extracts data from **IGM Console** (Import General Manifest) into Excel
2. Excel contains ~150 rows of shipment data
3. Team manually runs a **VBA/Excel script** that:
   - Reads each row
   - Generates individual email from template
   - Places emails in Outlook outbox
   - Sends one-by-one
4. **Result**: ~1.5 hours to send 150 emails

### UBOND (Prior Pre-Alert for Incoming Shipments)
- Runs 2-3 times per day
- Team structures an Excel dataset
- Assigns teammates to send pre-alerts
- Each teammate runs the script on their assigned portion

---

## 3. Excel Data Structure (Console Rows)

Each row in the Excel sheet contains:

| Column | Example |
|--------|---------|
| Agent | Prabhat Vaish |
| Loc | DEL |
| Date | 7/9/2026 |
| AWB Numbers | 382407883458 |
| Consignee Name | AASHITA ENTERPRISES |
| BSO | 02,54 |
| Freight | 8610.4 |
| Currency | INR |
| End Result | FEBRK |
| Data Type | CONSOL-01 |
| Mode | C |
| PIN Code | 302012 |
| Standard Remarks | aashita_engg@yahoo.com;rajesh.n.osv@fedex.com |
| FedEx Broker | Jeena |
| Contact | 9.19414E+11 |
| ConsigneeEmailID | PGUPTA@AASHITA.AI |
| Duty Bill Account | 901146659 |
| Value | 4273927.04 |
| PieceQty | 1 |
| KiloWgt | 1.8 |
| AD CODE | 180212 |
| InstructionCD | ITEM IS PRECIOUS NATURE... |
| Commit date | 7/15/2026 |
| Account | IN |
| SQL Account Customer Name | AASHITA ENTERPRISES JVL.-PKG |
| Primary CEP | #N/A |
| Secondary CEP | |

**Key fields used by the system:**
- `AWB Numbers` — unique shipment identifier
- `ConsigneeEmailID` — primary recipient
- `Consignee Name` — used in email body
- `End Result` — determines NFBRK vs FEBRK template
- `FedEx Broker` — Jeena vs Sunimpex (for FEBRK)
- `Freight`, `Currency` — used in subject line for FEBRK
- `Standard Remarks` — CC recipients (semicolon separated)
- `Commit date` — delivery deadline

---

## 4. Email Templates

### 4.1 FEBRK — Jeena & Co.

**CC (always present):**
```
del-fedex.imports@jeena.co.in
madhikari@jeena.co.in
syogesh@jeena.co.in
adtaneja@jeena.co.in
sdutt@jeena.co.in
vjain1@jeena.co.in
ssingh@jeena.co.in
aanand1@jeena.co.in
kbihari@jeena.co.in
iphvdelcargo@corp.ds.fedex.com
```

**Subject format:**
```
CARGO ARRIVAL NOTICE- Pre Alert AWB and freight charges : {AWB} {CONSIGNEE_NAME} {FREIGHT}_{CURRENCY} | FEBRK-DDP
```

**Body template:**
- States clearance by FedEx's broker (Sunimpex)
- 3-step clearance process: Checklist → BOE Filing → Customs Clearance
- Charges: INR 3000 + GST clearance, Late BOE penalties (INR 5000/day → 10000/day)
- 3-hour action deadline for documents

### 4.2 FEBRK — Sunimpex

**CC (always):**
```
csdel@sunimpexcsa.com
iphvdelcargo@corp.ds.fedex.com
```

**Subject format:**
```
CARGO ARRIVAL NOTICE- Pre Alert AWB and freight charges : {AWB} {CONSIGNEE_NAME} {FREIGHT}_{CURRENCY} | FEBRK-DDU
```

Same body as Jeena template but with Sunimpex CCs.

### 4.3 NFBRK

**Subject format (no fixed pattern — team uses variations):**
```
Pre Alert - {AWB} / {CONSIGNEE_NAME}
```

**Body template:**
- States customer is using their own broker
- Attaches AWB/CI in .tiff format
- Provides DO (Delivery Order) process:
  - DO charges: INR 3068 (2600 + 18% GST)
  - Late fee: additional INR 1000 + 18% GST if not collected same day
  - Payment via NEFT with UTR details
- References Notification No. 34/2021 for late BOE penalties
- CCs the full team: darain.saad, jane.alam, ayush.saklani, neha.sambhyal, etc.

### 4.4 Standard Attachments per Template

| Template | Fixed Attachments | Dynamic Attachment |
|----------|------------------|-------------------|
| NFBRK | DO FORMAT.docx, BANK DETAILS.docx, Circular-No-08-2021.pdf, Celebi Tariff Sheet.pdf | Invoice (.tif) from ACCS |
| FEBRK-Jeena | None (body contains all info) | Invoice (.tif) from ACCS |
| FEBRK-Sunimpex | None (body contains all info) | Invoice (.tif) from ACCS |

---

## 5. System Requirements — Batch Flow

### Batch Creation
1. User creates a new batch
2. Selects **template** (NFBRK / FEBRK-Jeena / FEBRK-Sunimpex)
3. Selects **file location** — either:
   - A folder path containing `.tif` files named by AWB
   - A `.zip` archive containing the same
4. Uploads the **Excel sheet** (console rows)

### File Handling — Invoice Attachment
- Files are `.tif` (TIFF) format downloaded from **ACCS** (internal FedEx platform)
- Named as `{AWB_NUMBER}.tif` (e.g., `382407883458.tif`)
- **System logic**: Match `AWB_NUMBER` in Excel row → find matching `{AWB}.tif` → attach to email
- **TIFF-to-PDF**: If file is `.tif`, convert to PDF in-browser before attaching. If already `.pdf`, skip conversion.

### Email Dispatch
- Each Excel row → one email
- Recipient: `ConsigneeEmailID` (primary), `Standard Remarks` (CC)
- Subject dynamically filled from row data
- Body from selected template (variables filled)
- Attachments: fixed docs (per template) + matched invoice PDF

---

## 6. System Architecture Mapping

```
[Excel Upload] → [Column Mapping] → [Validation]
     ↓
[File Source Folder/ZIP] → [AWB Matching] → [TIFF→PDF Conversion]
     ↓
[Email Preview] → [Launch Batch]
     ↓
[SMTP Send] (one-by-one, ~150 per 3-5 min via API vs 1.5hr via Outlook)
```

### Key Differences from Current Process
| Current (Excel+VBA+Outlook) | New System |
|----------------------------|------------|
| 1.5 hours for 150 emails | ~3-5 minutes via SMTP API |
| Files on local machine | Uploaded to storage bucket |
| Script per teammate | Role-based batch assignment |
| Manual TIFF handling | Auto detect & convert |
| Hardcoded template in VBA | Configurable templates in DB |

---

## 7. Database Tables

| Table | Purpose |
|-------|---------|
| `app_users` | Team members with roles (admin, lead, operator, reviewer, viewer) |
| `mailbox_configs` | Outgoing mailbox config (per user) |
| `batch_runs` | Each pre-alert run instance |
| `batch_items` | Each row/shipment in a batch |
| `file_assets` | Attachments (invoices, DO docs, bank details, etc.) |
| `email_events` | Send tracking (sent, opened, failed) |
| `awb_cases` | Exception/case management for shipments needing follow-up |
| `templates` | Email templates (admin-customizable) |
| `ai_classifications` | AI-suggested categorization for human review |

---

## 7. Roles

| Role | Permissions |
|------|------------|
| `admin` | Full access — manage users, mailboxes, templates, all batches |
| `lead` | Create batches, assign work, view all |
| `operator` | Create and send batches (assigned portion) |
| `reviewer` | View and review, cannot send |
| `viewer` | Read-only access |

---

## 8. Future Capabilities

- **Human Review** queue: AI-classified ambiguous shipments waiting for manual check
- **Templates page**: Admin-customizable email templates (NFBRK/FEBRK bodies, CC lists)
- **Reminders**: Automated reminder jobs for pending cases
- **Call Tasks**: Phone call tracking for urgent follow-ups
- **Audit Logs**: Full trace of every action
- **3-hour SLA tracking**: Auto escalation if documents not received within window