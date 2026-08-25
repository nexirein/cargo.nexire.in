# Cargo PAF — Complete System HLD & User Flows

> **Product:** FedEx Cargo Pre-Alert + Follow-up Operations Platform
> **Location:** Delhi IGI Airport (DEL) Import Cargo Operations
> **Stack:** Next.js 16 · Supabase · Upstash · nodemailer · IMAP

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [User Roles & Permissions](#3-user-roles--permissions)
4. [Complete User Flows](#4-complete-user-flows)
5. [Navigation & Pages](#5-navigation--pages)
6. [API Reference](#6-api-reference)
7. [Database Schema Summary](#7-database-schema-summary)
8. [Infrastructure](#8-infrastructure)
9. [Security & RBAC](#9-security--rbac)

---

## 1. System Overview

### What It Replaces

The manual process that runs today:
- Operations extracts ~150 rows from the FedEx IGM Console into an Excel sheet
- A VBA script reads each row and places a formatted email in the Outlook outbox
- Sending ~150 emails takes ~90 minutes (one-by-one through Outlook)
- Reply handling is manual: Ravi exports replies from Outlook, distributes AWBs in Excel, each teammate searches Outlook for context
- No tracking, no analytics, no SLA enforcement
- ~50% of replies are auto-responses / info-only that don't need human attention, but everyone checks every one

### What This System Provides

| Problem | Solution |
|---------|----------|
| 90-min send time | 3-5 min batch send via SMTP |
| No send tracking | Per-AWB status, retry, audit trail |
| Manual reply distribution | Auto-ingest via IMAP, AWB extraction, case creation |
| Everyone checks every reply | AI classifier routes 50%+ to auto-handle |
| No ownership model | KYC-style claim/assign/release |
| No SLA enforcement | Reminder scheduler, slipped detection |
| No BOE/DO tracking | Full clearance lifecycle + penalty calculators |
| No team visibility | Dashboard, pipeline, per-operator metrics |

### Case Lifecycle (Full Tracker)

```
Pre-Alert Sent
    │
    ▼
awaiting_reply ──────────────────────────────────────────────────┐
    │  (consignee hasn't responded)                               │
    │  Reminder 1 @ 48h                                           │
    │  Reminder 2 @ 72h (final + penalty warning)                 │
    ▼                                                             │
reply_received ───→ documents_provided ───→ boe_filed            │
    │  (any reply)      (docs submitted)    (broker filed BOE)    │
    │                                   │                         │
    │                                   ▼                         │
    │                        assessment_pending                   │
    │                          (customs reviewing)                │
    │                                   │                         │
    │                                   ▼                         │
    │                         duty_assessed                       │
    │                          (duty amount set)                  │
    │                                   │                         │
    │                                   ▼                         │
    │                         out_of_charge                       │
    │                        (customs cleared)                    │
    │                                   │                         │
    │                                   ▼                         │
    │                            do_ready                         │
    │                       (DO issued by FedEx)                  │
    │                                   │                         │
    │                                   ▼                         │
    │    human_review ←── escalated ←── do_collected ───→ closed │
    │    (AI couldn't      (urgent/         (DO collected)  (done)│
    │     handle)          escalated)                             │
    └─────────────────────────────────────────────────────────────┘
```

### Three Clearance Types (Mixed in One Batch)

| Type | Broker | CC List | Attachments |
|------|--------|---------|-------------|
| **NFBRK** | Consignee's own CHA | FedEx internal only | DO FORMAT.docx + BANK DETAILS.docx |
| **FEBRK-Jeena** | Jeena & Co. | 10+ Jeena team + iphvdelcargo | None |
| **FEBRK-Sunimpex** | Sunimpex | csdel@sunimpexcsa.com + iphvdelcargo | None |

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CLIENTS (Browser)                              │
│  Next.js App Router · Tailwind · shadcn/ui · TanStack Query            │
│  Client-side TIFF→PDF (utif2 → Canvas → pdf-lib)                      │
└────────────────────┬────────────────────────────────────────────────────┘
                     │ HTTPS
                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     NEXT.JS SERVER (Vercel)                             │
│                                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐  │
│  │ Server      │  │ Route       │  │ Server      │  │ CRON          │  │
│  │ Components  │  │ Handlers    │  │ Actions     │  │ (Vercel Cron) │  │
│  │ (RSC)       │  │ (API)       │  │ (mutations) │  │ reminders,    │  │
│  └─────────────┘  └──────┬──────┘  └──────┬──────┘  │ requeue,      │  │
│                          │                │         │ DO overdue    │  │
│                          ▼                ▼         └───────┬───────┘  │
│                    ┌────────────────────────────┐           │          │
│                    │     Service Layer           │           │          │
│                    │  · ingest-email.ts          │           │          │
│                    │  · smtp.ts / graph/         │           │          │
│                    │  · classify-email.ts        │           │          │
│                    │  · reminders/scheduler.ts   │           │          │
│                    │  · cases/optimistic-update  │           │          │
│                    │  · audit/log.ts             │           │          │
│                    └───────────┬────────────────┘           │          │
│                                │                            │          │
└────────────────────────────────┼────────────────────────────┼──────────┘
                                 │                            │
              ┌──────────────────┼────────────────────────────┼──────────┐
              │                  ▼                            ▼          │
              │  ┌─────────────────────────────────────────────────────┐ │
              │  │                SUPABASE                             │ │
              │  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐  │ │
              │  │  │ Postgres │  │ Storage  │  │ Realtime         │  │ │
              │  │  │ (25+     │  │ invoices │  │ (batch progress) │  │ │
              │  │  │ tables)  │  │ templates│  └──────────────────┘  │ │
              │  │  └──────────┘  │ batch-   │                        │ │
              │  │                │ sources  │                        │ │
              │  │                └──────────┘                        │ │
              │  └─────────────────────────────────────────────────────┘ │
              │                                                         │
              │  ┌──────────────────────┐  ┌──────────────────────────┐ │
              │  │  UPSTASH REDIS       │  │  UPSTASH QSTASH          │ │
              │  │  · Locks (case claim)│  │  · Send job queue         │ │
              │  │  · Rate limiting     │  │  · Retry with backoff    │ │
              │  │  · Dashboard cache   │  │  · Webhook callbacks     │ │
              │  └──────────────────────┘  └──────────────────────────┘ │
              │                                                         │
              │  ┌──────────────────────────────────────────────────┐   │
              │  │              EMAIL SYSTEM                         │   │
              │  │  ┌──────────────────┐  ┌──────────────────────┐  │   │
              │  │  │  SMTP (nodemailer)│  │  IMAP (imapflow)    │  │   │
              │  │  │  · Pooled conns  │  │  · 5-min poll       │  │   │
              │  │  │  · 4 concurrent  │  │  · Dedupe by msgId  │  │   │
              │  │  │  · Cached trans.│  │  · AWB extraction    │  │   │
              │  │  └──────────────────┘  └──────────────────────┘  │   │
              │  └──────────────────────────────────────────────────┘   │
              └─────────────────────────────────────────────────────────┘
```

---

## 3. User Roles & Permissions

### Role Access Matrix

| Feature | admin | lead | operator | reviewer | viewer |
|---------|-------|------|----------|----------|--------|
| Dashboard | ✓ | ✓ | ✓ | ✓ | ✓ |
| Batches (create/send) | ✓ | ✓ | ✓ | ✗ | ✓(view) |
| Cases (master view) | ✓ | ✓ | ✓ | ✓ | ✓ |
| My Cases | ✓ | ✓ | ✓ | ✗ | ✗ |
| Human Review | ✓ | ✓ | ✗ | ✓ | ✗ |
| Reminders | ✓ | ✓ | ✓ | ✗ | ✗ |
| Calls (coming soon) | ✓ | ✓ | ✓ | ✗ | ✗ |
| Templates (CRUD) | ✓ | ✓ | ✓ | ✗ | ✗ |
| Mailboxes (admin) | ✓ | ✗ | ✗ | ✗ | ✗ |
| Team Users (admin) | ✓ | ✗ | ✗ | ✗ | ✗ |
| Team Analytics | ✓ | ✓ | ✗ | ✗ | ✗ |
| Audit Logs | ✓ | ✓ | ✗ | ✗ | ✗ |
| Training Guide | ✓ | ✓ | ✓ | ✓ | ✓ |
| Override case ownership | ✓ | ✓ | ✗ | ✗ | ✗ |
| Approve AI drafts | ✓ | ✓ | ✗ | ✓ | ✗ |

### Role Descriptions

| Role | Typical Persona | Responsibilities |
|------|----------------|-----------------|
| **Admin** | Operations Manager | Full system access, user management, mailbox config, templates, overrides, analytics |
| **Lead** | Team Lead | Case assignment, approvals, team oversight, escalation handling |
| **Operator** | Team Member | Batch creation, case claiming, follow-up, DO collection |
| **Reviewer** | Quality / AI Reviewer | Human review queue only, draft approval |
| **Viewer** | Stakeholder / Auditor | Read-only dashboard and case views |

---

## 4. Complete User Flows

### Flow A: Daily Pre-Alert Batch Creation

**Actor:** Operator or Admin

```
1. LOGIN → Dashboard
      │
2. NAVIGATE → Batches → "Create Batch"
      │
3. WIZARD STEP 1 — Setup
      │  · Enter run name (auto-suggested: PREALERT-YYYY-MM-DD-AM/PM)
      │  · Select send-from mailbox (configured in Mailboxes admin)
      │  · Select default email template (NFBRK / FEBRK-Jeena / FEBRK-Sunimpex)
      │  · Choose sub-batch size (25 or 50)
      │  → Click "Next"
      │
4. WIZARD STEP 2 — Upload & Map
      │  · Upload .xlsx file with shipment rows
      │  · System parses headers, shows preview
      │  · Map columns: AWB (required), Consignee Email (required),
      │    Consignee Name (optional), Template (optional per-row override)
      │  → Click "Validate"
      │
5. WIZARD STEP 3 — Validate
      │  · System validates each row:
      │    · AWB format (12-15 digit numeric)
      │    · Email format
      │    · Required fields present
      │    · Template resolves (per-row or batch default)
      │  · Shows errors per row with inline fixes
      │  → Click "Continue to Preview"
      │
6. WIZARD STEP 4 — Upload Invoices (optional)
      │  · Upload TIFF/PDF invoice files named by AWB
      │  · System matches files to rows
      │  → Click "Convert" (if TIFFs present)
      │
7. CONVERSION (if TIFFs)
      │  · Client-side conversion: utif2 decode → Canvas → pdf-lib
      │  · Shows progress per batch of 25 files, 4 concurrent workers
      │  · ZIP download available for partial results
      │  → Auto-proceeds to Preview
      │
8. WIZARD STEP 5 — Preview
      │  · Shows sample of rendered emails (subject, body, attachments)
      │  · Verify AWB, consignee, template, freight all correct
      │  → Click "Launch Batch"
      │
9. SEND PROGRESS
      │  · Real-time progress via Supabase Realtime
      │  · Shows: sent count, failed count, sub-batch progress
      │  · Failures auto-retry with exponential backoff
      │  · Manual "Retry" button for failed items
      │  → Auto-redirects to Summary when complete
      │
10. SUMMARY
       · Total sent / failed / pending
       · AI vs Human hero section with 50% target
       · Per-member involvement list
       · Case status breakdown
       · "Retry All Failed" button
       · Link to Cases page
```

**⏱️ Time saved:** From ~90 minutes (Excel+VBA+Outlook) to ~3-5 minutes (automated pipeline)

---

### Flow B: Reply Ingestion & Case Management

**Actor:** System (automated) → Operator

```
1. CONSIGNEE REPLIES to pre-alert email
      │
2. IMAP POLL (every 5 min via Vercel Cron)
      │  · imapflow connects to the monitoring mailbox
      │  · Fetches unseen messages
      │  · Does NOT mark as \Seen until ingested
      │
3. INGEST PIPELINE
      │  · Deduplicate by Message-ID
      │  · Parse email (mailparser)
      │  · Extract AWB via regex from subject/body
      │  · Match to existing case or create new case
      │  · If case was awaiting_reply → set to reply_received
      │
4. CLASSIFICATION (rules-first)
      │  · Layer 1: Deterministic rules
      │    · OOO / auto-reply → ignore
      │    · Bounce → flag
      │    · Payment received → auto-send confirmation
      │    · PDF invoice request → auto-send
      │    · Escalation keywords → human review
      │  · If unclear → flag for human review
      │
5. ROUTING
      │
      ├──→ AI-HANDLED (50% target)
      │    · info_only, payment_received, no_action
      │    · Auto-send reply (if needed)
      │    · Auto-close case
      │    · human_review_required = false
      │    → No human intervention needed
      │
      └──→ HUMAN REVIEW QUEUE
           · special_case, escalation, unclear, checklist_request
           · human_review_required = true
           · Case appears in Human Review page
           · Operator claims → works → updates status
```

---

### Flow C: Human Review & Case Work

**Actor:** Operator / Reviewer / Lead

```
1. HUMAN REVIEW PAGE
      │  Default view: unclaimed cases, AI-couldn't-handle
      │  Filters: status, issue type, urgency, AWB search, batch
      │
2. CLAIM A CASE (two ways)
      │
      ├──→ Individual: Click AWB → Modal → "Claim" button
      │    · Success popup: "Stay here" or "Go to My Cases"
      │    · Auto-refresh: claimed case disappears from HR queue
      │
      └──→ Bulk: Checkbox select → "Claim selected" bar
           · Claims up to selected count
           · Shows success count
           · Cases moved to My Cases
      │
3. MY CASES PAGE
      │  Shows only cases claimed by or assigned to current user
      │  Filters: AWB search, status dropdown
      │  Table columns: AWB, Status, Issue, Urgency, Claimed date, DO Number
      │
      │  FOR EACH CASE:
      │
4. VIEW CASE DETAIL (click AWB)
      │  Modal with full case context:
      │
      │  ┌──────────────────────────────────────────────────┐
      │  │ STICKY HEADER                                    │
      │  │ AWB-12345678901  [Awaiting Reply] [Claimed]      │
      │  │                           [Claim] [Release]      │
      │  ├────────────────────────────────┬─────────────────┤
      │  │ LEFT PANEL                     │ RIGHT PANEL     │
      │  │                                │                 │
      │  │ Email Thread                   │ Case Info       │
      │  │ ┌────────────────────────────┐ │ Issue, Urgency  │
      │  │ │ SENT To: consignee@...    │ │ Status, Owner    │
      │  │ │ Subject: Pre Alert ...    │ │ Emails count     │
      │  │ │ Body: ...                 │ │                 │
      │  │ └────────────────────────────┘ │ Clearance       │
      │  │ ┌────────────────────────────┐ │ Tracker         │
      │  │ │ REPLY From: consignee@... │ │ ┌─────────────┐ │
      │  │ │ Subject: Re: Pre Alert... │ │ │ IGM Provided │ │
      │  │ │ Body: ...                 │ │ │ BOE Filed    │ │
      │  │ └────────────────────────────┘ │ │ Out of Charge│ │
      │  │                                │ │ DO Ready     │ │
      │  │                                │ │ DO Collected │ │
      │  │                                │ │ [▓▓░░░] 2/5  │ │
      │  │                                │ └─────────────┘ │
      │  │                                │                 │
      │  │                                │ ⚠ BOE Penalty  │
      │  │                                │ ₹15,000 -      │
      │  │                                │ ₹30,000 accrued │
      │  │                                │                 │
      │  │                                │ Quick Actions   │
      │  │                                │ [Mark BOE] [Esc]│
      │  │                                │ [Close]         │
      │  │                                │                 │
      │  │                                │ Assign to: [▼]  │
      │  │                                │ [Assign]        │
      │  │                                │                 │
      │  │                                │ Remarks         │
      │  │                                │ [textarea]      │
      │  │                                │ [Save remarks]  │
      │  │                                │                 │
      │  │                                │ Timeline        │
      │  │                                │ · claim - User  │
      │  │                                │ · reply ...     │
      │  │                                │ · BOE filed ... │
      │  └────────────────────────────────┴─────────────────┘
      │
5. STATUS ADVANCEMENT (as cargo progresses)
      │
      │  a) Consignee sends docs → Click "Mark BOE Filed"
      │     (sets boe_filed_at, status → boe_filed)
      │
      │  b) Broker confirms assessment → Click "Assessment Pending"
      │     (sets assessment_pending_at, status → assessment_pending)
      │
      │  c) Customs assesses duty → Click "Duty Assessed"
      │     (sets duty_assessed_at, duty_amount, status → duty_assessed)
      │
      │  d) Customs clears → Click "Out of Charge"
      │     (sets out_of_charge_at, status → out_of_charge)
      │
      │  e) DO issued → Click "Mark DO Ready"
      │     (sets do_ready_at, status → do_ready)
      │
      │  f) DO collected → Enter DO number + Click "DO Collected"
      │     (sets do_number, do_collected_at, status → do_collected)
      │
      │  g) Case resolved → Click "Close"
      │     (status → closed)
      │
6. HANDLE EXCEPTIONS
      │  · Escalate: marks as escalated, notifies lead
      │  · Reassign: dropdown → select teammate → assign
      │  · Release: releases ownership back to pool
      │  · Remarks: add notes visible in timeline
```

---

### Flow D: Clearance & Penalty Tracking

**Actor:** Operator (monitoring)

```
DASHBOARD — Clearance Pipeline
┌─────────────────────────────────────────────────────────────┐
│  Reply Received  │  BOE Filed  │  Out of Charge  │  DO DoNe │
│       42         │     28      │       15        │    8     │
│  ████████████░░  │  ██████░░░  │  ████░░░░░░░░░  │  ██░░░░  │
└─────────────────────────────────────────────────────────────┘

PENALTY EXPOSURE
┌──────────────────────┬──────────────────────┬──────────────────┐
│ ⚠ BOE Late Penalty   │ 💲 DO Overdue Penalty │ ⚠ Stuck          │
│ ₹25K - ₹50K accrued  │ ₹4,000 + GST          │ 3 cases          │
│ 5 cases · 5 days     │ 2 cases · 2 days      │ >72h since BOE  │
└──────────────────────┴──────────────────────┴──────────────────┘

PER CASE — Clearance Tracker (shown in every case detail modal)
┌─────────────────────────────────────────────┐
│ Clearance Progress         [▓▓▓░░░░] 2/5    │
│                                             │
│ ✓ IGM Provided                              │
│ ✓ BOE Filed                                 │
│ ○ Assessment Pending                        │
│ ○ DO Ready                                   │
│ ○ DO Collected                               │
│                                             │
│ ⚠ BOE Filing Overdue                         │
│ ₹25,000 – ₹50,000 penalty accrued           │
│ 5 days late · ₹5K/day or ₹10K/day           │
│                                             │
│ Advance Status:                              │
│ [Assessment Pending] [Escalate] [Close]      │
│                                             │
│ Clearance References:                        │
│ IGM: DEL20241105-12345                       │
│ BOE: SB001-2024-98765                        │
└─────────────────────────────────────────────┘
```

---

### Flow E: Reminders & SLA Enforcement

**Actor:** System (automated) → Operator notification

```
TIMELINE
├── Pre-alert sent ─────────────────── Day 0, Hour 0
│
├── (3-hour SLA) ───────────────────── Day 0, Hour 3
│   System checks: did consignee reply with docs?
│   No → Flag as "SLA Urgent" in dashboard
│
├── Reminder 1 (soft) ──────────────── ~48 hours
│   System sends: "Reminder regarding pre-alert for AWB XXX"
│   Logged in case timeline + audit
│
├── Reminder 2 (final + penalty warn) ─ ~72 hours
│   System sends: "Final reminder — late BOE penalty may apply"
│   Logged in case timeline + audit
│
├── BOE Late Penalty Clock Starts ──── After 24h without BOE
│   Dashboard shows: ₹5K-₹10K/day accruing
│   Case modal shows: running total
│
├── Clearance Stuck ────────────────── >72h after BOE filed
│   Dashboard shows: stuck count
│   Case modal shows: "Clearance Stuck" warning
│
└── DO Overdue ─────────────────────── >24h after DO ready
    Dashboard shows: penalty accruing
    Case modal shows: ₹1K/day + GST
    Cron logs case_updates for visibility

AUTOMATED JOBS (Vercel Cron)
┌─────────────────────┬──────────┬──────────────────────────────┐
│ Job                 │ Interval │ What It Does                 │
├─────────────────────┼──────────┼──────────────────────────────┤
│ process-reminders   │ Every 1h │ Finds due reminders, sends   │
│                     │          │ emails, updates reminder_jobs│
├─────────────────────┼──────────┼──────────────────────────────┤
│ requeue-stalled     │ Every 5m │ Requeues stalled send jobs   │
├─────────────────────┼──────────┼──────────────────────────────┤
│ do-overdue-reminders │ Daily   │ Logs case_updates for DO     │
│                     │          │ overdue cases                 │
├─────────────────────┼──────────┼──────────────────────────────┤
│ inbox/poll          │ Every 5m │ IMAP poll for new replies    │
└─────────────────────┴──────────┴──────────────────────────────┘
```

---

### Flow F: DO Collection (Terminal Step)

**Actor:** Operator

```
1. CASE reaches out_of_charge (customs cleared)
      │
2. FedEx issues DO document
      │
3. Operator marks "DO Ready" in system
      │  → do_ready_at set, status = do_ready
      │
4. Consignee completes:
      │  · Submits DO FORMAT.docx (filled)
      │  · Pays ₹3,068 + GST → generates UTR
      │  · Submits authorization letter
      │
5. Operator enters DO number + clicks "DO Collected"
      │  → do_number set, do_collected_at set, status = do_collected
      │
6. CASE is complete → Click "Close" (optional)
      │  → status = closed
      │

⚠ If DO not collected within 24h of do_ready:
   ₹1,000/day + GST penalty starts accruing
   Dashboard shows penalty exposure
   Case modal shows orange "DO Overdue" warning
```

---

## 5. Navigation & Pages

### Main Navigation (Sidebar)

| Page | Path | Roles | Key Features |
|------|------|-------|-------------|
| **Dashboard** | `/dashboard` | All | AI ownership %, human review count, clearance pipeline, penalty exposure, sent/reply today, recent cases, slipped alert |
| **Batches** | `/batches` | admin, lead, operator, viewer | Batch list, create wizard, detail, mapping, validate, convert, preview, send progress, summary |
| **Cases** | `/cases` | All | Master table, bulk select/claim, filters (status/issue/urgency/AI/batch), AWB click → detail modal |
| **My Cases** | `/my-cases` | admin, lead, operator | My claimed cases only, DO collect per row, search/filter, AWB click → detail modal |
| **Human Review** | `/human-review` | admin, lead, reviewer | Unclaimed AI-flagged cases, claim, filters |
| **Reminders** | `/reminders` | admin, lead, operator | Due reminders list, send reminder buttons, batch-level send |
| **Calls** | `/calls` | admin, lead, operator | Coming soon — AI calling agent |
| **Templates** | `/templates` | admin, lead, operator | CRUD email templates, variable reference, attachment upload |
| **Mailboxes** | `/admin/mailboxes` | admin | SMTP/IMAP config per user |
| **Team** | `/admin/users` | admin | User management, role assignment |
| **Team Analytics** | `/team` | admin | Per-member case stats, involvement, performance |
| **Audit Logs** | `/audit-logs` | admin, lead | Full audit trail of every action |
| **Training Guide** | `/training` | All | Product documentation |

---

## 6. API Reference

### Batch API

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/batches` | Create batch run |
| POST | `/api/batches/[id]/parse` | Parse uploaded Excel |
| POST | `/api/batches/[id]/validate` | Validate rows + mappings |
| POST | `/api/batches/[id]/launch` | Enqueue send jobs |
| GET | `/api/batches/[id]/status` | Live send progress |
| POST | `/api/batches/[id]/attachments/register` | Register uploaded invoice files |
| POST | `/api/batches/[id]/attachments/mark-manual` | Mark attachment as manual |
| POST | `/api/batches/[id]/requeue-item` | Requeue failed send |
| POST | `/api/batches/[id]/send-reminders` | Send reminders for all awaiting cases in batch |

### Case API

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/cases/[id]/detail` | Full case with email thread, timeline, team |
| POST | `/api/cases/[id]/claim` | Claim case ownership (version-gated) |
| POST | `/api/cases/[id]/release` | Release ownership back to pool |
| POST | `/api/cases/[id]/assign` | Assign/reassign to teammate |
| POST | `/api/cases/[id]/update` | Update status, remarks (version-gated) |
| POST | `/api/cases/[id]/boe` | BOE filing tracking |
| POST | `/api/cases/[id]/clearance` | Clearance status advancement |
| POST | `/api/cases/[id]/do-ready` | Mark DO as ready for collection |
| POST | `/api/cases/[id]/do-collect` | Mark DO collected (with DO number) |
| POST | `/api/cases/[id]/send-reminder` | Send reminder email |
| POST | `/api/cases/[id]/send-final-reminder` | Send final reminder email |
| POST | `/api/cases/claim` | Bulk claim (multiple case IDs) |
| GET | `/api/cases/due-followups` | Cases due for follow-up |

### Inbox / Classification API

| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/inbox/ingest` | Ingest inbound reply (called by IMAP poll or webhook) |
| GET | `/api/inbox/poll` | Trigger IMAP poll manually |
| POST | `/api/inbox/reclassify` | Reclassify a case |
| GET | `/api/inbox/test` | Test IMAP connectivity |
| POST | `/api/classify` | Classify an email (rules-based) |
| POST | `/api/drafts/generate` | Generate AI draft reply |

### Cron / System API

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/cron/process-reminders` | Process due reminders (hourly) |
| GET | `/api/cron/requeue-stalled` | Requeue stalled send jobs (5min) |
| GET | `/api/cron/do-overdue-reminders` | Log DO overdue case_updates (daily) |
| POST | `/api/send/webhook` | QStash callback for send job completion |

---

## 7. Database Schema Summary

### Core Tables (25 migrations)

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `app_users` | User accounts & roles | id, auth_user_id, email, role (admin/lead/operator/reviewer/viewer), is_active |
| `mailbox_configs` | Per-user email config | operational_mailbox, tagged_mailbox, signature_html, smtp_*, imap_* |
| `batch_runs` | Pre-alert send runs | run_name, status (draft→sending→completed), total_rows, template_id, mailbox_config_id |
| `sub_batches` | Internal batch splits | batch_run_id, seq, status, sent_count, failed_count |
| `batch_items` | Per-AWB send records | batch_run_id, awb, consignee_email, shipment_data, send_status |
| `file_assets` | Invoice files | batch_run_id, batch_item_id, awb, source_format, storage_path |
| `email_events` | All outbound/inbound emails | awb, direction, message_id, subject, body_clean, sender/recipient |
| `awb_cases` | **Central case table** | awb, current_status (12 states), ownership fields, igm_number, boe_*, clearance_*, do_*, version (optimistic concurrency) |
| `case_assignments` | Ownership audit trail | case_id, from_user_id, to_user_id, assignment_type (claim/assign/release/override) |
| `case_updates` | Activity timeline | case_id, update_type, old/new values, remarks |
| `ai_classifications` | Classification results | case_id, email_event_id, issue_type, urgency, confidence, human_review_required |
| `draft_replies` | AI-generated drafts | case_id, draft_subject, draft_body, approval_status |
| `reminder_jobs` | Scheduled reminders | case_id, reminder_level, due_at, status (pending/sent/skipped/failed) |
| `call_tasks` | Phone call tracking | case_id, assigned_to, status, outcome, script_prompt |
| `templates` | Email templates | type (nfbrk/febrk-jeena/febrk-sunimpex), subject_template, body_html, cc_list, fixed_attachment_paths |
| `template_attachments` | DO FORMAT.docx, BANK DETAILS.docx etc. | template_id, storage_path |
| `audit_logs` | Full audit trail | actor_user_id, entity_type, entity_id, action, metadata |
| `training_examples` | AI training data (pgvector) | email_text, issue_type, embedding |

### awb_cases — The Central Table

```sql
-- Current status lifecycle (12 values):
awaiting_reply → reply_received → documents_provided → boe_filed →
assessment_pending → duty_assessed → out_of_charge → do_ready →
do_collected → closed
+ human_review (AI couldn't handle)
+ escalated (urgent escalation)

-- Ownership model:
ownership_status: unassigned | claimed | assigned | review | closed | released
version: int (auto-incremented on every UPDATE — optimistic concurrency)

-- Full tracker columns (migration 0026):
igm_number, igm_provided_at
boe_filed_at, boe_number, boe_penalty_started_at
assessment_pending_at, duty_assessed_at, duty_amount, out_of_charge_at
do_ready_at, clearance_type
```

---

## 8. Infrastructure

### Hosting & Services

| Service | Usage | Estimated Cost |
|---------|-------|---------------|
| **Vercel** | App hosting, serverless functions, cron jobs, edge middleware | $20-50/mo (Pro) |
| **Supabase** | Auth (email+pw+RBAC), Postgres (2GB), Storage (1GB), Realtime | $25/mo (Pro) |
| **Upstash Redis** | Distributed locks (case claiming), rate limiting, cache | $5-15/mo |
| **Upstash QStash** | Send job queue (up to 10k msg/mo), retry, webhook | Free tier |
| **SMTP** | Gmail / SendGrid / any SMTP provider for outbound email | Free-$15/mo |
| **IMAP** | Any email provider with IMAP access for reply polling | Included with email |
| **Google Gemini** | (Planned) AI classification + draft generation | Pay-per-token |

### Environment Variables (Required)

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_PROJECT_REF=

# Upstash
UPSTASH_REDIS_URL=
UPSTASH_REDIS_TOKEN=
QSTASH_TOKEN=
QSTASH_CURRENT_SIGNING_KEY=
QSTASH_NEXT_SIGNING_KEY=

# Email (SMTP Driver)
MAIL_DRIVER=smtp
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=

# Email (IMAP for reply ingestion)
IMAP_HOST=
IMAP_PORT=993
IMAP_USER=
IMAP_PASS=
MONITORING_MAILBOX=

# Vercel
CRON_SECRET=
APP_BASE_URL=

# (Optional) Microsoft Graph API upgrade path
AZURE_CLIENT_ID=
AZURE_CLIENT_SECRET=
AZURE_TENANT_ID=
```

### Cron Schedule (vercel.json)

```json
{
  "crons": [
    { "path": "/api/inbox/poll?cron_key=SECRET", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/requeue-stalled?cron_key=SECRET", "schedule": "*/5 * * * *" },
    { "path": "/api/cron/process-reminders?cron_key=SECRET", "schedule": "0 * * * *" },
    { "path": "/api/cron/do-overdue-reminders?cron_key=SECRET", "schedule": "0 8 * * *" }
  ]
}
```

---

## 9. Security & RBAC

### Authentication
- Supabase Auth with email + password
- Password reset flow via magic link
- Session managed via `@supabase/ssr` cookies

### Authorization (Two Layers)

1. **API Route Guard** — `requireRole()` at the top of every mutating route:
   ```typescript
   const user = requireRole(await getCurrentAppUser(), "admin", "lead", "operator");
   // Throws ForbiddenError if unauthorized
   ```

2. **Row-Level Security (RLS)** — Supabase policies on every table for direct browser queries:
   - `app_users`: users see own row; admins see all
   - `awb_cases`: operators see cases they own or unassigned; admins/leads see all
   - `audit_logs`: admins/leads only
   - Storage: active users only for invoices, batch-sources, template-attachments

### Optimistic Concurrency
- `awb_cases.version` auto-increments on every UPDATE (DB trigger)
- Mutations require the current version number
- 409 Conflict if version mismatch → "Case was updated by X; refresh to continue"
- Redis locks for short-lived contention (e.g., claim)

### Audit Trail
Every mutation is logged to `audit_logs`:
- actor + action + entity type/id + metadata
- Viewable by admin/lead on the Audit Logs page

---

## Appendix: Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **SMTP first, Graph later** | SMTP works with any email provider; Graph API is an upgrade path for M365 |
| **IMAP polling (not webhooks)** | Works universally (Gmail, Outlook, any IMAP provider); 5-min poll is sufficient |
| **Client-side TIFF→PDF** | No server upload bottleneck, no cold starts, no CPU throttling on serverless |
| **Sub-batches of 25-50** | Progress visibility + granular retry for 100-300 row batches |
| **Rules-first AI classification** | Deterministic rules handle common cases cheaply; LLM upgrade path for ambiguity |
| **Optimistic concurrency (not pessimistic locks)** | Long-lived DB locks are bad UX; version-gated updates + friendly conflicts |
| **KYC-style ownership** | Claim/release/assign semantics prevent two operators working the same case |
| **Full clearance lifecycle in schema** | Real financial impact (₹5K-₹10K/day BOE penalty) needs to be tracked, not skipped |
