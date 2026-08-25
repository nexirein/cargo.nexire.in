# FedEx Cargo Operations — End-to-End Process

> **Scope:** Pre-Alert → IGM → BOE → Customs Clearance → DO Collection
> **Context:** Delhi IGI Airport (DEL) import cargo operations
> **System:** Cargo PAF — automated pre-alert + follow-up + tracking

---

## 1. Overview of the Cargo Lifecycle

Every international air cargo shipment entering India through Delhi IGI Airport follows a regulatory pipeline before cargo is released to the consignee. The lifecycle has five distinct phases:

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────────┐    ┌──────────────┐
│  PRE-    │    │   IGM    │    │   BOE    │    │   CUSTOMS    │    │     DO       │
│  ALERT   │───▶│  FILING  │───▶│  FILING  │───▶│  CLEARANCE   │───▶│  COLLECTION  │
│ (Day 0)  │    │ (Day 0)  │    │ (Day 0+) │    │  (Day 1-3)   │    │  (Day 3-5)   │
└──────────┘    └──────────┘    └──────────┘    └──────────────┘    └──────────────┘
```

### Who Does What

| Phase | Responsible Party | System Role |
|-------|------------------|-------------|
| **Pre-Alert** | FedEx Ops Team | **Sends** notification to consignee |
| **IGM Filing** | FedEx / GSA | Automatic (FedEx internal) |
| **BOE Filing** | Consignee's Broker (CHA) | **Track** — ₹5K/₹10K daily late penalty |
| **Customs Clearance** | Customs Dept + Broker | **Track** — status monitoring |
| **DO Collection** | Consignee | **Track** — ₹3,068 fee + ₹1K/day late penalty |

### The Real Financial Stakes

| Penalty | Amount | Applies When |
|---------|--------|-------------|
| Late BOE filing (under ₹10L duty) | ₹5,000/day | BOE not filed by end of arrival day |
| Late BOE filing (above ₹10L duty) | ₹10,000/day | BOE not filed by end of arrival day |
| Late DO collection | ₹1,000/day + GST | DO not collected within 24h of clearance |
| DO base fee | ₹3,068 + GST | Standard release document fee |

---

## 2. Pre-Alert Phase (Day 0 — What the System Currently Does)

### What Happens

The operations team receives IGM data from the FedEx console (typically an Excel file with ~150 rows). Each row contains:

| Field | Example |
|-------|---------|
| AWB (Air Waybill) | 123-45678901 |
| Consignee Name | M/S ABC Electronics Pvt Ltd |
| Consignee Email | accounts@abc.com |
| Freight Amount | ₹1,25,000 |
| Currency | INR / USD |
| Clearance Type | NFBRK / FEBRK-Jeena / FEBRK-Sunimpex |
| Origin | HONG KONG |
| Pieces | 5 |
| Weight | 250 KGS |
| Commodity | ELECTRONIC COMPONENTS |

### The Pre-Alert Email

A pre-alert is sent to the consignee informing them of the cargo arrival, AWB, freight charges, and required next steps. The content differs based on clearance type (see Section 4).

### What the System Does

1. **Batch Creation** — Upload the Excel
2. **Column Mapping** — Map Excel columns to system fields
3. **Validation** — Validate emails, AWBs, required fields
4. **Template Assignment** — Auto-select NFBRK / FEBRK-Jeena / FEBRK-Sunimpex template per row
5. **Send** — Queue and send ~150 personalized emails via SMTP in ~3-5 minutes
6. **Track** — Per-AWB send status, failures, retries

### The 3-Hour SLA

- Pre-alerts must be sent **within 3 hours of receiving IGM data**
- This is because the consignee/broker needs time to prepare BOE documents
- The pre-alert email itself states: *"Please arrange BOE filing within 3 hours"*
- This is the first SLA urgency indicator in the system

---

## 3. IGM Filing (Day 0 — Automatic)

### What is IGM?

**Import General Manifest (IGM)** is the legal document filed by the carrier (FedEx/GSA) with Indian Customs listing all cargo arriving on a flight. It is a regulatory requirement under the Customs Act, 1962.

### Process

| Step | Description |
|------|-------------|
| 1. Flight Arrival | Cargo arrives at DEL |
| 2. IGM Generation | FedEx/GSA generates IGM from the flight manifest |
| 3. IGM Filing | Filed electronically with ICEGATE (Customs) |
| 4. IGM Number | A unique IGM number + line item per AWB is created |
| 5. Reference | IGM number is referenced in BOE filing |

### Why It Matters for the System

- The IGM number is needed by the broker to file the BOE
- Pre-alert email states: *"MAWB and IGM will be provided once generated"*
- Not tracked in current system — proposed for full tracker

### System Gap

Currently there is no `igm_number` field on a case. The IGM number must be communicated to the consignee/broker, but there is no field to record it. In the full tracker, the IGM number should be captured when it becomes available.

---

## 4. Clearance Types — NFBRK vs FEBRK

This is the most critical distinction in the workflow. Every AWB falls into one of three clearance categories, and the email template, CC list, and attachments are all determined by this.

### 4.1 NFBRK (Non-FedEx Broker)

**Meaning:** The consignee uses their own Customs House Agent (CHA) / broker — not a FedEx-nominated broker.

#### Characteristics

| Aspect | Detail |
|--------|--------|
| **Broker** | Consignee's own appointed CHA |
| **Email Recipient** | Consignee only (no broker CC) |
| **CC List** | FedEx internal team only (no external broker) |
| **Attachments** | `DO FORMAT.docx` + `BANK DETAILS.docx` |
| **Responsibility** | Consignee manages their broker entirely |
| **Template** | NFBRK — full process explanation |

#### NFBRK Email Structure

```
TO: Consignee
CC: (FedEx team — iphvdelcargo@corp.ds.fedex.com, ops team)

Subject: Pre Alert - {AWB} / {CONSIGNEE_NAME}

Body includes:
- Cargo arrival notification
- AWB, freight, pieces, weight, origin
- IMPORTANT: Consignee must arrange BOE filing within 3 hours
  through their CHA to avoid late BOE penalty
  (INR 5,000/day or INR 10,000/day)
- DO collection process after clearance
- DO format and bank details attached (consignee must fill DO FORMAT
  and submit along with authorization letter + UTR for payment)
- Late DO collection penalty: INR 1,000/day after 24h
```

#### NFBRK Process Flow

```
Pre-Alert Sent (Day 0)
    ↓
Consignee sends docs to their CHA (broker)
    ↓
Broker files BOE (Day 0-1) ←─── ₹5K/₹10K penalty if late
    ↓
Customs processes BOE, assesses duty (Day 1-3)
    ↓
Consignee:
  1. Fills DO FORMAT.docx
  2. Pays ₹3,068 (UTR generated)
  3. Substitutes authorization letter + UTR + DO FORMAT
    ↓
DO issued by FedEx ←─── ₹1K/day penalty if >24h
    ↓
Cargo released
```

### 4.2 FEBRK-Jeena (FedEx Broker — Jeena & Co.)

**Meaning:** FedEx's nominated broker Jeena & Co. handles customs clearance. The consignee does not need to arrange their own CHA.

#### Characteristics

| Aspect | Detail |
|--------|--------|
| **Broker** | Jeena & Co. (FedEx-nominated) |
| **Email Recipient** | Consignee |
| **CC List** | 10+ Jeena team members + `iphvdelcargo@corp.ds.fedex.com` |
| **Attachments** | None (no DO FORMAT or BANK DETAILS attached) |
| **Responsibility** | Jeena handles clearance; consignee provides KYC/payment |
| **Template** | FEBRK-Jeena |

#### FEBRK-Jeena CC List

The pre-alert email CCs ~10-12 members of the Jeena operations team including:
- `jeena.ops1@jeena.com`, `jeena.ops2@jeena.com`, etc.
- FedEx internal: `iphvdelcargo@corp.ds.fedex.com`

#### FEBRK-Jeena Process Flow

```
Pre-Alert Sent (Day 0) — CC Jeena team
    ↓
Jeena reaches out to consignee for KYC/payment docs
    ↓
Jeena files BOE with customs (Day 0-1)
    ↓
Customs clearance handled by Jeena (Day 1-3)
    ↓
FedEx issues DO once Jeena confirms clearance
    ↓
Consignee collects cargo
```

### 4.3 FEBRK-Sunimpex (FedEx Broker — Sunimpex)

**Meaning:** FedEx's nominated broker Sunimpex handles customs clearance. Same structure as Jeena but different CC list.

#### Characteristics

| Aspect | Detail |
|--------|--------|
| **Broker** | Sunimpex (FedEx-nominated) |
| **Email Recipient** | Consignee |
| **CC List** | `csdel@sunimpexcsa.com` + `iphvdelcargo@corp.ds.fedex.com` |
| **Attachments** | None |
| **Responsibility** | Sunimpex handles clearance |
| **Template** | FEBRK-Sunimpex |

### Key Differences Summary

| Aspect | NFBRK | FEBRK-Jeena | FEBRK-Sunimpex |
|--------|-------|-------------|-----------------|
| Who clears customs | Consignee's CHA | Jeena & Co. | Sunimpex |
| System CCs broker? | No | Yes (10+ Jeena) | Yes (Sunimpex) |
| Attachments | DO FORMAT + BANK DETAILS | None | None |
| Consignee must arrange CHA | Yes | No (FedEx handles) | No (FedEx handles) |
| DO collection by | Consignee fills DO FORMAT | Jeena coordinates | Sunimpex coordinates |
| Penalty risk for consignee | High (self-managed) | Moderate (broker managed) | Moderate (broker managed) |

### How the System Handles This

- Batches can contain **all three types mixed together** in one Excel file
- The `template_type` column (or auto-detection via `resolveTemplateType()`) determines which template each row gets
- The send engine applies the correct:
  - Email template (subject + body with variables)
  - CC list
  - Attachments (NFBRK only)
- The `columnMappingSchema` in the mapping wizard allows users to specify or override the template per row

---

## 5. BOE Filing (Day 0-1 — The Critical Compliance Milestone)

### What is BOE?

**Bill of Entry (BOE)** is the legal document filed by the importer (or their CHA/broker) with Indian Customs declaring the imported goods. It is filed electronically through the ICEGATE portal.

### BOE vs DO — Critical Distinction

| | BOE (Bill of Entry) | DO (Delivery Order) |
|---|---|---|
| **What** | Customs declaration | Cargo release document |
| **Filed by** | Broker/CHA | FedEx (after clearance) |
| **When** | Before or on arrival day | After customs clearance |
| **Penalty** | ₹5K/₹10K per day late | ₹1K/day + GST late collection |
| **Regulatory** | Customs Act, 1962 | FedEx internal |
| **Risk** | High (legal/regulatory) | Medium (financial) |

### BOE Filing Timeline

```
Arrival Day (Day 0)
├── Flight lands
├── IGM filed (FedEx)
├── Pre-alert sent ───────────── ✅ System does this
├── Consignee gets docs to broker
└── BROKER FILES BOE ─────────── 🔴 Must happen same day
                                 (before 5 PM customs cutoff)

Day 1 (if BOE not filed Day 0)
├── ₹5,000/day penalty starts ── 🔴 **Real money**
└── Broker files BOE ASAP

Day 2+
├── Penalty continues daily
└── BOE must be filed before cargo can be cleared
```

### BOE Processing (After Filing)

```
BOE filed by broker on ICEGATE
    ↓
Customs system assigns BOE number (SB001/BOE Number)
    ↓
Customs officer reviews declaration
    ↓
Three outcomes:
    ├── Green Channel → Auto-cleared (no inspection)
    ├── Yellow Channel → Document check required
    └── Red Channel → Physical inspection required
    ↓
Duty assessed + paid (if applicable)
    ↓
BOE assessed / "Out of Charge" granted
    ↓
Cargo legally cleared by customs
```

### Late BOE Penalty (Notification 34/2021)

Under the Customs (Import of Goods at Concessional Rate of Duty) Rules:

| Duty Amount | Late Fee Per Day | Max |
|-------------|-----------------|-----|
| Up to ₹10,00,000 | ₹5,000 | No cap specified |
| Above ₹10,00,000 | ₹10,000 | No cap specified |

**Business impact:** If a consignee delays BOE filing by 5 days on a high-value shipment, penalty = ₹50,000 — this is not trivial.

### What the System Should Track

| Field | Description |
|-------|-------------|
| `igm_number` | IGM number from FedEx/GSA |
| `boe_filed_at` | When broker confirmed BOE filing |
| `boe_number` | BOE reference number from customs |
| `boe_penalty_started_at` | When late BOE penalty clock started |
| `boe_penalty_amount` | Accumulated penalty amount |
| `boe_assessed_at` | When customs assessed the BOE ("Out of Charge") |

### Current System Gap

The system currently has **no BOE tracking**. It jumps from `reply_received` directly to `do_collected`, skipping the entire BOE phase where the real financial risk lives.

---

## 6. Customs Clearance (Day 1-3 — The Waiting Period)

### What Happens

After the BOE is filed, customs processes the declaration:

1. **Document Scrutiny** — Customs officer reviews the BOE, invoices, packing list, and supporting documents
2. **Assessment** — Customs determines:
   - Applicable duty rate (BCD, IGST, CVD, SWS, etc.)
   - Whether examination is needed
   - Valuation verification
3. **Examination (if required)** — Physical or scanning inspection of cargo
4. **Duty Payment** — Consignee/broker pays assessed duty
5. **Out of Charge** — Customs grants "Out of Charge" = cargo is legally cleared

### Typical Timeline

| Scenario | Duration |
|----------|----------|
| Green channel (no issues) | 4-6 hours |
| Document check only | 1-2 days |
| Physical inspection | 2-4 days |
| Valuation dispute | 5-15 days |

### What the System Should Track

| Field | Description |
|-------|-------------|
| `clearance_status` | Current clearance stage |
| `clearance_started_at` | When BOE was filed (clearance begins) |
| `out_of_charge_at` | When customs granted "Out of Charge" |
| `duty_amount` | Total duty assessed |

### Clearance Status Values

```
boe_filed → assessment_pending → duty_assessed → out_of_charge
```

---

## 7. DO Collection (Day 3-5+ — The Terminal Output)

### What is DO?

**Delivery Order (DO)** is the document issued by FedEx (the carrier) authorizing the custodian/warehouse to release cargo to the consignee. It is the terminal step in the entire process.

### DO Collection Process

```
CLEARANCE COMPLETE (Out of Charge)
    ↓
FedEx generates DO document
    ↓
Collect DO only after:
    1. DO FORMAT filled (NFBRK only)
    2. Authorization letter from consignee
    3. Payment of ₹3,068 + GST → UTR generated
    ↓
DO issued to consignee
    ↓
Consignee presents DO + ID at warehouse
    ↓
Cargo released
    ↓
DO COLLECTED ✔️
```

### DO Fees & Penalties

| Item | Amount |
|------|--------|
| DO Base Fee | ₹3,068 |
| GST (18%) | ~₹552 |
| **Total DO fee** | **~₹3,620** |
| Late collection (after 24h of DO issuance) | ₹1,000/day + GST |

### Current System Support

✅ DO tracking is partially implemented:
- `do_number` text field on `awb_cases`
- `do_collected_at` timestamptz on `awb_cases`
- `POST /api/cases/[id]/do-collect` API endpoint
- "DO Collected" button in My Cases + Cases table
- DO number input in the case detail modal

❌ Missing:
- DO overdue penalty calculator
- DO auto-reminder (if clearance complete but DO not collected in 24h)
- DO issuance tracking (when was DO actually issued?)

---

## 8. The Full Case Lifecycle

### Current (Gap)

```
awaiting_reply → reply_received → do_collected → closed
```

### Proposed (Full Tracker)

```
awaiting_reply
    → reply_received (or escalated)
    → documents_provided
    → boe_filed
    → assessment_pending
    → duty_assessed
    → out_of_charge
    → do_ready
    → do_collected
    → closed
```

### Status Definitions

| Status | Meaning | Who Updates |
|--------|---------|-------------|
| `awaiting_reply` | Pre-alert sent, waiting for consignee to respond | System (auto) |
| `reply_received` | Consignee replied (any reply) | System (auto via IMAP) |
| `documents_provided` | Consignee submitted KYC/invoice/docs | Operator |
| `boe_filed` | Broker confirmed BOE filed with customs | Operator |
| `assessment_pending` | Customs reviewing BOE | Operator |
| `duty_assessed` | Customs assessed duty amount | Operator |
| `out_of_charge` | Customs granted clearance ("Out of Charge") | Operator |
| `do_ready` | DO issued by FedEx, ready for collection | Operator |
| `do_collected` | DO collected by consignee (with DO number) | Operator |
| `closed` | Case closed (terminal state) | Operator / Lead |

---

## 9. System Architecture for the Full Tracker

### Schema Additions

```sql
-- New columns on awb_cases
igm_number text,
igm_provided_at timestamptz,
boe_filed_at timestamptz,
boe_number text,
boe_penalty_started_at timestamptz,
assessment_pending_at timestamptz,
duty_assessed_at timestamptz,
duty_amount numeric(12,2),
out_of_charge_at timestamptz,
do_ready_at timestamptz,
clearance_type text  -- 'nfbrk', 'febrk-jeena', 'febrk-sunimpex'
```

### Penalty Calculation

```
BOE Late Penalty:
  IF boe_filed_at IS NULL AND (now() - arrival_day) > 1 day:
    daily_rate = IF estimated_duty > 10L THEN 10000 ELSE 5000
    total_penalty = days_late * daily_rate

DO Late Penalty:
  IF do_collected_at IS NULL AND do_ready_at IS NOT NULL
     AND (now() - do_ready_at) > 1 day:
    days_late = (now() - do_ready_at) - 1 day
    total_penalty = days_late * 1000
```

### 3-Hour SLA Urgency

The pre-alert email tells consignees to arrange BOE filing within 3 hours. The system should:

1. Start a clock when pre-alert is sent
2. If no `documents_provided` or `boe_filed` within 3 hours → flag as **SLA Urgent**
3. Show SLA timer in case detail and dashboard

### Notification Triggers

| Event | Action |
|-------|--------|
| BOE not filed within 24h of pre-alert | Notify lead + operator (penalty risk) |
| BOE not filed within 48h | Escalate to admin |
| Clearance not done within 72h of BOE filing | Flag as stuck |
| DO not collected within 24h of `do_ready` | Trigger DO reminder |
| DO not collected within 48h of `do_ready` | Escalate (₹1K/day penalty) |

---

## 10. Dashboard Metrics (Full Tracker)

### New KPIs

| Metric | Calculation |
|--------|-------------|
| **BOE Filing Rate** | % of cases with BOE filed within 24h |
| **Avg Clearance Time** | Average time from BOE filed → Out of Charge |
| **At-Risk BOE Cases** | Cases where BOE not filed >24h after pre-alert |
| **DO Collection Rate** | % of cleared cases where DO collected |
| **Avg DO Collection Time** | Average time from DO ready → DO collected |
| **Total Penalty Exposure** | Sum of active BOE + DO late penalties |
| **SLA Breaches** | Cases where 3-hour SLA was missed |

### Filter Dimensions

- Clearance type (NFBRK / FEBRK-Jeena / FEBRK-Sunimpex)
- Current status (any of the full lifecycle statuses)
- BOE penalty risk (yes/no)
- DO overdue (yes/no)
- SLA breached (yes/no)

---

## 11. Implementation Plan for Full Tracker

### Phase 1: Schema + Status Migration
- Migration `0026_full_tracker.sql` — add new columns to `awb_cases`, extend `current_status` check constraint, add indexes
- Update `current_status` check constraint to include all new lifecycle statuses
- Add `clearance_type` field (denormalized for fast queries)

### Phase 2: BOE Tracking UI
- `/api/cases/[id]/boe` — BOE filing + assessment status updates
- BOE section in case detail modal (filed at, number, penalty calculator)
- BOE penalty warning badge

### Phase 3: Clearance Tracking UI
- Clearance progress bar in case detail (BOE → Assessment → Duty → Out of Charge)
- `/api/cases/[id]/clearance` — clearance status updates
- Stuck-case detection

### Phase 4: DO Enhancement
- DO overdue calculator
- DO auto-reminder trigger
- `/api/cases/[id]/do-ready` — mark DO as ready

### Phase 5: Dashboard Analytics
- Clearance pipeline view (funnel: sent → BOE filed → cleared → DO collected)
- Penalty exposure dashboard widget
- SLA breach reporting per operator/batch
