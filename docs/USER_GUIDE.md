# Cargo PAF — User Guide

## Overview

Cargo PAF (Pre-Alert & Follow-up) is the operations platform for FedEx cargo
clearance at Delhi IGI Airport. It replaces the manual Excel + Outlook workflow
with an automated system covering the full lifecycle: **Pre-Alert → IGM Filing →
Cargo Arrival Notice → BOE Tracking → DO Collection**.

---

## Sidebar Architecture

The sidebar is organized into **four sections** corresponding to the team's
two primary workflows plus shared/admin tools.

```
PRE-ALERT                          ARRIVAL & CLEARANCE
──────────────────────             ──────────────────────
  Dashboard                          Dashboard
  My Cases                           Arrival Batches
  Pre-alert Batches                  Hold Tracker
                                     Upload Hold Data
  Confirmation Calls                 Follow-up Calls
  Review Queue                       Exception Review
  Reminders                          Reminders

SHARED                            ADMIN
──────────────────────             ──────────────────────
  All Batches                        Mailboxes
  All Cases                          Team
  AWB Tracker                        Team Analytics
  Templates                          Training Data
  Training Guide                     Audit Logs
```

### Nav Items with Shared Pages

Some pages are accessible from **both** workflow sections with different default
filters:

| Nav Item | Section | Pre-set Filters | Purpose |
|----------|---------|----------------|---------|
| Review Queue | Pre-alert | `phase=pre_alert` | AI-flagged replies needing human review |
| Exception Review | Arrival | `phase=post_arrival` | Clearance issues flagged by AI |
| Confirmation Calls | Pre-alert | `call_type=confirmation` | NFBRK/FEBRK clearance confirmation calls |
| Follow-up Calls | Arrival | `call_type=follow_up,reminder` | DO/BOE follow-up calls |
| Reminders (both) | Both | `phase=...` | Workflow-specific follow-up reminders |

These items share the same underlying page but apply a default filter so each
team sees only their relevant data.

---

## 1. Pre-alert Workflow

**Purpose:** Send pre-alert notifications to consignees before cargo arrival.

### Step 1: Create a Batch

1. Navigate to **All Batches** (SHARED section) or **Pre-alert Batches**
2. Click **Create Batch** → select "Pre-alert" as phase
3. Choose mailbox configuration, optional template, sub-batch size

### Step 2: Upload & Map

4. Upload the Excel sheet (typically 100–300 rows from FedEx console)
5. Map columns: AWB, consignee email, name, template type (End Result)
6. System auto-detects column headers via synonym matching
7. Click **Validate**

### Step 3: Validate

8. Review validation issues (errors = excluded, warnings = included)
9. Fix and re-upload if needed, or proceed

### Step 4: Attachments & Convert

10. Upload invoice PDFs and match them to AWBs
11. Convert TIFF files to PDF (client-side, no server upload)
12. Preview recipient list

### Step 5: Launch

13. Click **Launch batch** to enqueue ~150 personalized emails
14. Watch live send progress with sub-batch breakdown
15. Batch completes when all emails are sent

### Step 6: Follow-up

16. Consignees reply to the pre-alert email in the monitored mailbox
17. AI classifies each reply (9 categories, 70–95% confidence)
18. **AI-handled:** Auto-replied, auto-closed (no human needed)
19. **Needs review:** Appears in **Review Queue** (PRE-ALERT section)
20. Operator claims the case → reviews AI draft → sends or edits reply
21. **No reply:** Appears in **Reminders** after SLA threshold
22. Send reminder → final reminder → escalate if still no reply

### Pre-alert Roles

| Item | Who Uses It |
|------|-------------|
| Dashboard | Everyone — daily KPIs, pipeline, penalties |
| My Cases | Operators — claimed cases needing follow-up |
| Pre-alert Batches | Operators + Leads — create and manage batches |
| Confirmation Calls | Operators — NFBRK/FEBRK clearance calls |
| Review Queue | Operators + Reviewers — AI-flagged replies |
| Reminders | Everyone — no-reply follow-ups |

---

## 2. Arrival & Clearance Workflow

**Purpose:** Manage cargo after arrival — IGM data, TP holds, DO collection.

### Step 1: Import Arrival Data

1. Navigate to **Arrival Batches** (ARRIVAL section)
2. Click **Create Batch** → select "Post-arrival" as phase
3. Upload the MAWB/IGM Excel dump from FedEx system
4. Map columns: MAWB, IGM number, flight, origin, destination, HSN, etc.
5. Validate → system checks that AWBs already exist (pre-alerted)
6. Preview → Launch → cargo arrival notice emails sent automatically

### Step 2: Import TP Holds

7. Navigate to **Arrival Batches**
8. Click **Create Batch** → select "TP Hold" as phase
9. Upload TP hold report from IGM team
10. Map columns: AWB, hold reason, status code, arrival source
11. Validate → system auto-processes (no manual launch needed)
12. Batch completes immediately — case fields updated

### Step 3: Upload & Manage Holds

13. Navigate to **Upload Hold Data** (ARRIVAL section)
14. Upload the TP hold Excel from IGM team (columns: AWB, ORG, DEST, PCS ARRIVED, REASON, STAT, ARRIVAL SOURCE, ARRIVAL DATE)
15. System auto-detects columns and processes each row:
    - **AWB exists** → updates TP hold fields (reason, status, source, date, origin, dest, pieces)
    - **New AWB** → creates a fresh case with `shipment_phase = ['pre_alert', 'post_arrival']`
16. Results show: total rows, updated, created (new AWBs), skipped
17. Navigate to **Hold Tracker** to view and search all TP-held cases
18. Click **Release hold** when the IGM team clears it
19. Released AWBs leave the Hold Tracker automatically

### Step 4: Track Clearance

17. Navigate to **Dashboard** (ARRIVAL section)
18. Monitor: DO collection rate, IGM filed vs pending, TP hold count
19. Track overdue alerts: DO not collected within 24h → ₹1K/day penalty
20. View recent arrival cases with MAWB/IGM/Flight/Dest status

### Step 5: Follow-up Calls

21. Navigate to **Follow-up Calls**
22. See pending call tasks for DO collection and BOE filing
23. Complete the call → mark as Done or Skip
24. Case updated automatically

### Arrival Roles

| Item | Who Uses It |
|------|-------------|
| Dashboard | Everyone — arrival KPIs, DO rates, IGM status |
| Arrival Batches | Operators — import post-arrival and TP hold data |
| Hold Tracker | Operators — view and release TP holds |
| Upload Hold Data | Operators — import TP hold Excel from IGM team |
| Follow-up Calls | Operators — DO/BOE reminder calls |
| Exception Review | Operators + Reviewers — AI-flagged clearance issues |
| Reminders | Everyone — DO/BOE follow-ups |

---

## 3. Shared Features

### All Batches (`/batches`)

Master list of ALL batch runs across all phases. Filter by:
- **Phase tab:** All / Pre-alert / Post-arrival / TP Hold
- Status, date, mailbox

Each row shows: name, phase badge (sky/emerald/slate), status badge, row
counts, sent/failed counts, creation date.

### All Cases (`/cases`)

Master list of ALL AWB cases. Filter by:
- **Phase:** All / Pre-alert / Arrival / TP Hold
- Status (13 lifecycle statuses), issue type, urgency
- Clearance type, AI handled vs human review, slipped
- Batch, AWB search

Metrics bar: Total Cases, AI Handled, Human Review, Awaiting Reply, AI Ownership %.

### AWB Tracker

Shows pre-alerted AWBs that have NOT yet received IGM update or TP hold.
Used to identify gaps between pre-alert and IGM filing.

- Auto-populates from cases in pre-alert phase without `igm_number`
- Auto-removes when IGM is entered or TP hold is marked
- Columns: AWB, clearance type, status, pre-alert date, days since

### Templates

Manage email templates for both pre-alert and post-arrival workflows.
- **Pre-alert types:** nfbrk, febrk-jeena, febrk-sunimpex, calling, hold
- **Arrival types:** cargo_arrival_notice, post_day_1, post_day_2, post_reminder, post_igm_retry

### Training Guide

Onboarding documentation for new team members.

---

## 4. Admin Features

| Item | Purpose |
|------|---------|
| Mailboxes | Configure SMTP/Graph outbound mailboxes and monitoring inboxes |
| Team | Manage users, roles (admin/lead/operator/reviewer/viewer) |
| Team Analytics | Slip tracking, operator workload, productivity |
| Training Data | (Phase 2) — Upload/export labeled email data for AI model training |
| Audit Logs | Full audit trail of all state-changing actions |

---

## 5. Case Lifecycle

Every AWB flows through this lifecycle:

```
Pre-alert sent → awaiting_reply
                      ↓ (consignee replies)
                 reply_received → (AI classifies → auto/human)
                      ↓
              documents_provided
                      ↓
                  boe_filed  ←── ₹5K/₹10K daily late penalty
                      ↓
            assessment_pending
                      ↓
               duty_assessed
                      ↓
              out_of_charge (customs cleared)
                      ↓
                do_ready  ←── DO issued by FedEx
                      ↓
             do_collected  ←── ₹1K/day late collection penalty
                      ↓
                 closed
```

### Shipment Phase Tracking

Each AWB case has a `shipment_phase` array that tracks which phases
it has passed through:

| Phase | When Set | Meaning |
|-------|----------|---------|
| `pre_alert` | Auto (default) | Pre-alert batch was sent |
| `post_arrival` | When cargo arrival notice is sent | AWB entered arrival workflow |

### Phase-based Filtering

Throughout the system, the `shipment_phase` column enables clean filtering:

- **Pre-alert:** `shipment_phase @> ARRAY['pre_alert']`
- **Arrival:** `shipment_phase @> ARRAY['post_arrival']`
- **TP Hold:** `tp_hold_status IS NOT NULL`

---

## 6. Key Concepts

### Batch Phases

| Phase | Batch Flow | Email Sent? | Creates Case? |
|-------|-----------|-------------|---------------|
| `pre_alert` | Upload → Map → Validate → Attach → Convert → Preview → Launch → Send | Yes | Yes (upsert by AWB) |
| `post_arrival` | Upload → Map → Validate → Preview → Launch → Send | Yes (cargo arrival notice) | No (updates existing) |
| `tp_hold` | Upload → Map → Validate → Auto-process | No | No (updates tp_hold fields) |

### Clearance Types

| Type | Meaning | Template |
|------|---------|----------|
| NFBRK | Non-FedEx Broker (consignee's own CHA) | nfbrk |
| FEBRK-Jeena | FedEx Broker — Jeena & Co. | febrk-jeena |
| FEBRK-Sunimpex | FedEx Broker — Sunimpex | febrk-sunimpex |
| Calling | Phone confirmation needed | calling (skips email) |
| Hold | TP hold by IGM team | hold (not sent) |

### Penalties

| Penalty | Amount | Trigger |
|---------|--------|---------|
| Late BOE (duty ≤ ₹10L) | ₹5,000/day | BOE not filed by end of arrival day |
| Late BOE (duty > ₹10L) | ₹10,000/day | BOE not filed by end of arrival day |
| Late DO collection | ₹1,000/day + GST | DO not collected within 24h of issuance |
| DO base fee | ₹3,068 + GST | Standard release document fee |

### Roles & Permissions

| Role | Batches | Cases | Review | Admin |
|------|---------|-------|--------|-------|
| Admin | Full | Full | Full | Full |
| Lead | Create, Launch | Claim, Reassign | Approve | View audit |
| Operator | Create, Launch | Claim, Update | Review drafts | — |
| Reviewer | — | View | Review queue | — |
| Viewer | View | View | — | — |

---

## 7. AI Classification Loop

```
Incoming reply email
    ↓
Rule-based classifier (9 categories)
    ↓
Confidence ≥ 70% ──→ Auto-reply (if ai_reply_allowed)
    ↓                        ↓
Confidence 50-70% ──→ AI suggests draft → human approves/sends
    ↓
Confidence < 50% ──→ Human Review Queue
    ↓
All paths → audit log → case updated
```

### Issue Types

- `no_action` / `info_only` / `pdf_invoice_request` / `checklist_request`
- `status_query` / `payment_received` / `reminder_needed`
- `final_reminder_needed` / `special_case` / `escalation` / `unclear`

### Training Data (Phase 2)

For model improvement, export historical emails via **Admin > Training Data**
(expected format: Excel with 16 columns including awb, body_clean, issue_type,
action_taken, confidence, resolution, etc.)

---

## 8. Tips & Best Practices

### Batch Naming

Use a structured naming format for traceability:
- `PREALERT-2026-07-20-AM`
- `POST-2026-07-20-01`
- `TPHOLD-2026-07-20`

### Daily Routine

**Morning (Pre-alert focus):**
1. Check Pre-alert Dashboard → review pipeline and penalties
2. Review Queue → clear AI-flagged cases
3. My Cases → follow up on claimed cases
4. Reminders → send due reminders

**Afternoon (Arrival focus):**
5. Check Arrival Dashboard → DO rates, IGM status, overdue
6. Import new IGM/MAWB data via Arrival Batches
7. Import TP hold reports via TP Hold batches
8. Hold Tracker → release cleared holds
9. Follow-up Calls → complete pending calls

**End of day:**
10. AWB Tracker → review pre-alerted AWBs awaiting IGM
11. All Cases → verify no cases stuck in wrong status

### Common Pitfalls

- **Post-arrival batch fails validation:** AWB must already exist in the
  system (from a pre-alert batch). Send the pre-alert first.
- **TP Hold batch appears empty:** If no AWBs match, check that the
  pre-alert was sent for those AWBs first.
- **Review Queue is empty:** Either AI is handling everything (good!), or
  no new replies have come in. Check the dashboard for reply rates.
- **Hold Tracker not updating:** TP hold data comes from Upload Hold Data.
  Check that the latest upload completed without errors.
