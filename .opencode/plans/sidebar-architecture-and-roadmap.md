# Full Sidebar Architecture & Product Roadmap

## Current Problem

The ALL section is a dumping ground. Items serving both Prior and Post workflows are lumped together, creating confusion about which tool belongs to which workflow.

## Core Design Principle

**Each workflow section should contain everything an operator needs for THAT workflow. Duplicate nav items are allowed with distinct labels. Only truly cross-cutting items go in SHARED.**

---

## 1. Final Sidebar Architecture

```
PRE-ALERT (7 items)
┌──────────────────────────────────────┐
│  Dashboard                            │  ← pre-alert KPIs (send rate, reply rate, AI impact, pipeline, penalties)
│  My Cases                             │  ← claimed cases, pre-alert phase
│  Pre-alert Batches                    │  ← /batches?phase=pre_alert (pre-filtered)
│  Confirmation Calls                   │  ← /calls?call_type=confirmation&phase=pre_alert
│  Review Queue                         │  ← /human-review?phase=pre_alert (AI-flagged pre-alert replies)
│  Reminders                            │  ← /reminders?phase=pre_alert (no-reply follow-ups)
└──────────────────────────────────────┘

ARRIVAL & CLEARANCE (6 items)
┌──────────────────────────────────────┐
│  Dashboard                            │  ← arrival KPIs (DO rate, IGM status, holds, overdue penalties)
│  Arrival Batches                      │  ← /batches?phase=post_arrival (post-arrival + tp-hold imports)
│  Hold Tracker                         │  ← /holds (TP hold release)
│  Follow-up Calls                      │  ← /calls?call_type=follow_up,reminder&phase=post_arrival
│  Review Queue                         │  ← /human-review?phase=post_arrival (AI-flagged arrival issues)
│  Reminders                            │  ← /reminders?phase=post_arrival (DO/BOE follow-ups)
└──────────────────────────────────────┘

SHARED (5 items)
┌──────────────────────────────────────┐
│  All Batches                          │  ← /batches (unfiltered, all phases)
│  All Cases                            │  ← /cases (unfiltered master list)
│  AWB Tracker                          │  ← NEW — see Section 2
│  Templates                            │
│  Training Guide                       │
└──────────────────────────────────────┘

ADMIN (5 items)
┌──────────────────────────────────────┐
│  Mailboxes                            │
│  Team                                 │
│  Team Analytics                       │
│  Training Data                        │  ← NEW — upload/export training dataset
│  Audit Logs                           │
└──────────────────────────────────────┘
```

### What changed vs current sidebar

| Item | Old Section | New Section |
|------|-------------|-------------|
| Dashboard | PRIOR | PRE-ALERT |
| My Cases | ALL | PRE-ALERT |
| Balises | PRIOR | Split: Pre-alert Batches in PRE-ALERT, All Batches in SHARED |
| Cases | PRIOR | SHARED (All Cases) |
| Post Dashboard | POST | ARRIVAL & CLEARANCE |
| Hold Tracker | POST | ARRIVAL & CLEARANCE |
| Calls | POST | Split: Confirmation Calls in PRE-ALERT, Follow-up Calls in ARRIVAL |
| Human Review | ALL | Split: Review Queue in both PRE-ALERT and ARRIVAL |
| Reminders | ALL | Split: Reminders in both PRE-ALERT and ARRIVAL |
| Templates | ALL | SHARED |
| Training Guide | ALL | SHARED |
| AWB Tracker | — | NEW in SHARED |
| Training Data | — | NEW in ADMIN |

---

## 2. AWB Tracker (NEW)

**Purpose:** Show AWBs that were pre-alerted but never received IGM/TP hold update after filing.

### Logic
- Query: `awb_cases WHERE shipment_phase contains 'pre_alert' AND (shipment_phase DOES NOT contain 'post_arrival' OR igm_number IS NULL)`
- When a TP hold is placed → AWB auto-removes from this list
- When IGM is updated → AWB auto-removes from this list

### Columns
- AWB, Consignee, Pre-alert sent date, Days since pre-alert, Current status, Action
- Action button: "Mark as Arrived" (manual override if IGM data entered separately)

### Nav Item
- Label: "AWB Tracker"
- Icon: `Search` or `Crosshair`
- Roles: admin, lead, operator
- Section: SHARED (cross-cutting concern)

---

## 3. Calls Split Architecture

### Current calls page (`/calls/page.tsx`)
- Has filters: status (Pending/Completed/Skipped), call_type (confirmation/reminder/follow_up)
- Links to case detail page

### Changes needed for split
- Add phase filter to calls page (pre_alert / post_arrival / all)
- "Confirmation Calls" nav item → /calls?call_type=confirmation&phase=pre_alert
- "Follow-up Calls" nav item → /calls?call_type=follow_up,reminder&phase=post_arrival

### Call Types by Workflow
| Workflow | Call Types | Purpose |
|----------|-----------|---------|
| Pre-alert | confirmation | NFBRK/FEBRK clearance confirmation |
| Arrival | follow_up, reminder | DO collection, BOE filing follow-up |

---

## 4. Review Queue Split

### Current human-review page (`/human-review/page.tsx`)
- Shows cases needing human review
- Filters: status, issue_type, urgency

### Changes needed
- Add phase filter: pre_alert / post_arrival / all
- Pre-alert Review Queue: AI-flagged replies needing human review
- Arrival Review Queue: Clearance issues, DO disputes, exception cases

---

## 5. Reminders Split

### Current reminders page (`/reminders/page.tsx`)
- Shows cases needing follow-up based on SLA
- Send reminder / final reminder actions

### Changes needed
- Add phase filter: pre_alert / post_arrival / all
- Pre-alert reminders: No-reply follow-ups (Day 1, Day 3, Final)
- Arrival reminders: DO collection, BOE filing follow-ups

---

## 6. My Cases Enhancement

### Current my-cases (`/my-cases/page.tsx`)
- Shows claimed/assigned cases for current user
- No phase filter

### Changes needed
- Add phase filter: pre_alert (default) / post_arrival / all
- Pre-alert My Cases: Reply follow-up cases
- Arrival My Cases: Clearance tracking cases

---

## 7. Phase 2 — AI/ML Roadmap

### 7.1 Training Data Format

Best format for RAG model training from exported emails:

**Excel Columns:**

| Column | Example | Purpose |
|--------|---------|---------|
| `awb` | 123-45678901 | Link to shipment |
| `direction` | inbound / outbound | Who sent |
| `subject` | "Re: Pre Alert - {AWB} / {NAME}" | Thread context |
| `body_clean` | "Please send the invoice..." | Full cleaned body |
| `issue_type` | pdf_invoice_request / status_query / etc | Human-labeled category |
| `urgency` | low / normal / urgent | Human-labeled urgency |
| `action_taken` | ai_draft / human_review / ai_send / call | What was done |
| `ai_confidence` | 0.85 | Optional — AI confidence if applicable |
| `human_review_required` | TRUE / FALSE | Was human needed |
| `call_required` | TRUE / FALSE | Did it need a call |
| `clearance_type` | nfbrk / febrk-jeena / febrk-sunimpex | Context |
| `customer_email` | accounts@abc.com | Sender |
| `attachments_text` | "INV-001.pdf: 5 pages..." | OCR text if relevant |
| `resolution` | "Sent invoice via email" | Final outcome |
| `thread_length` | 3 | How many emails in thread |
| `time_to_first_reply_hrs` | 2.5 | Response time |

### 7.2 AI Feature Rollout

```
Phase 1 (Current — Rules-first)
├── Rule-based classification (9 categories)
├── Keyword matching for simple intents
└── Human review for low-confidence

Phase 2a — RAG Email Assistant (Next)
├── Train model on historical email data
├── Auto-reply for: freight amount queries, invoice requests, status queries
├── Fetch from DB before replying: {FREIGHT}, {CURRENCY}, {CLEARANCE_STATUS}
├── Escalate to human: unclear requests, escalations, payment disputes
└── Inbound email → classify → DB lookup → auto-reply → case update

Phase 2b — AI Calling Assistant (Next+)
├── Outbound AI calls for: DO collection reminders, payment reminders
├── Live DB lookup during call: {DO_READY_STATUS}, {BOE_STATUS}, {PENALTY_AMOUNT}
├── Script: "Your DO is ready at FedEx office. Please collect within 24h to avoid ₹1K/day penalty."
├── NO auto-inbound calls in Phase 2b
└── Call result → update case → trigger email if needed

Phase 3 — Full AI Agent
├── End-to-end auto handling for 80% of cases
├── AI calling for confirmation calls (NFBRK/FEBRK)
├── Auto email + auto call for DO collection
└── Human only for exceptions and escalations
```

### 7.3 Live Shipment Update in Calls

When an AI or human call happens:
1. System fetches case data from DB
2. During call, agent/AI reads: AWB, current_status, clearance_type, igm_number, mawb, flight, etc.
3. Customer asks: "What's the status of my shipment?"
4. System replies from DB: "Your shipment AWB 123-45678901 has arrived. IGM is filed. BOE is pending. Please arrange filing."
5. After call: update call_tasks with outcome, update case status if needed

---

## 8. Implementation Order

### Phase 1a: Sidebar Restructure (NOW)
1. Update nav-config.ts — new sections, items, labels
2. Add phase filters to: calls page, human-review page, reminders page, my-cases page
3. Create AWB Tracker page
4. Rename dashboard labels
5. Verify build

### Phase 1b: AI Inbound Mail (NEXT)
1. Build training data export from email_events table
2. Create training data upload UI under ADMIN
3. Build RAG model endpoint (external or in-app)
4. Implement auto-reply for simple intents
5. Wire up inbound email → classify → DB lookup → auto-reply pipeline

### Phase 2: AI Calling + Live Updates (FUTURE)
1. Outbound AI calling for reminders
2. Live DB data integration in call scripts
3. Auto-update case after call completion
4. Training data collection from call results

---

## 9. Technical Changes Required

### Files to modify (Phase 1a)

| File | Change |
|------|--------|
| `nav-config.ts` | New sections, items, labels per architecture above |
| `app-shell.tsx` | Handle section rendering for duplicated section keys |
| `calls/page.tsx` | Add phase filter, update query params handling |
| `calls/actions.ts` | No changes needed |
| `human-review/page.tsx` | Add phase filter, update queries |
| `reminders/page.tsx` | Add phase filter, update queries |
| `my-cases/page.tsx` | Add phase filter to queries |
| `dashboard/page.tsx` | New card labels |
| `dashboard/prior/page.tsx` | "Prior Dashboard" → "Pre-alert Dashboard" |
| `dashboard/post/page.tsx` | "Post Dashboard" → "Arrival & Clearance Dashboard" |
| `batches/page.tsx` | New subtitle, handle query param default filtering |
| `cases/page.tsx` | Phase filter label updates |
| NEW: `awb-tracker/page.tsx` | AWB Tracker page |
| NEW: `awb-tracker/actions.ts` | AWB Tracker actions |

### How duplicated nav items work

Items like "Confirmation Calls" and "Follow-up Calls" are separate nav entries pointing to the same page `/calls` but with different default query params:
```
{ label: "Confirmation Calls", href: "/calls?call_type=confirmation&phase=pre_alert", section: "prior" }
{ label: "Follow-up Calls", href: "/calls?call_type=follow_up,reminder&phase=post_arrival", section: "post" }
```
The page reads query params and sets defaults accordingly.

### Section key naming (kept for backward compatibility)
- `"prior"` → displayed as "PRE-ALERT"
- `"post"` → displayed as "ARRIVAL & CLEARANCE"
- `"all"` → displayed as "SHARED"
- `"admin"` → displayed as "ADMIN"

---

## 10. Open Questions

1. **AWB Tracker**: Should it also show AWBs that were post-arrival'd but have no IGM number? Or only pre-alerted-without-IGM?
2. **Review Queue split**: Should arrival review queue include post-batch validation failures or only AI-flagged cases?
3. **Reminders**: Pre-alert reminders = no-reply. Arrival reminders = DO/BOE. Should arrival reminders also include pre-alert no-reply for cases that have entered both phases?
4. **My Cases**: Should "My Cases" in Pre-alert only show pre-alert phase cases? What if an operator works both workflows?
