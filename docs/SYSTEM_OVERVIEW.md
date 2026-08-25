2# Cargo Pre-Alert Operations Platform — System Overview

**FedEx India operations platform that automates pre-alert clearance notifications, post-arrival cargo clearance tracking, AI-powered phone calling for clearance type resolution, and end-to-end AI decision assistance.**

---

## Table of Contents

1. [The Problems We Set Out to Solve](#1-the-problems-we-set-out-to-solve)
2. [Our Approach: Problems → Solutions](#2-our-approach-problems--solutions)
3. [System Architecture](#3-system-architecture)
4. [End-to-End Process Flow](#4-end-to-end-process-flow)
5. [Key Features Deep Dive](#5-key-features-deep-dive)
6. [AI Decision Engine](#6-ai-decision-engine)
7. [Data Stores](#7-data-stores)
8. [Key Files by Feature](#8-key-files-by-feature)

---

## 1. The Problems We Set Out to Solve

### 1.1 Operational Problems

| # | Problem | Impact Before Solution |
|---|---------|----------------------|
| P1 | **Manual Excel batch processing** — 100-500+ AWBs per day, each needing manual mapping, validation, template selection, and email sending | Hours per batch, human errors, no audit trail |
| P2 | **Ambiguous clearance types** — Excel has `CALLING` or empty `FEBRK`; operator must phone each consignee to confirm NFBRK vs FEBRK-Jeena vs FEBRK-Sunimpex | Delayed clearances, missed SLAs, expensive manual phone calls |
| P3 | **Manual email sending** — Each AWB needs correct template (NFBRK/FEBRK-Jeena/FEBRK-Sunimpex/Calling), correct attachments, correct recipients | Tedious, error-prone, no consistency |
| P4 | **No reply tracking** — After sending 100+ emails, no way to track who replied, who's pending, which cases slipped | Penalties for delayed BOE filing (₹5K-₹10K/day), DO collection (₹1K/day) |
| P5 | **No performance visibility** — Managers have no data on team performance, bottlenecks, penalty exposure | Decisions made on gut feel |
| P6 | **No uBond/Consol distinction** — No separation between pre-arrival alerts (uBond) and pre-IGM alerts (Consol), causing confusion and duplicate emails | Customers got same email twice, different processes mixed together |
| P7 | **Manual post-arrival tracking** — No centralized system for arrival notices, IGM filing, BOE status, DO collection across 100+ AWBs | Missed deadlines, no SLA enforcement |

### 1.2 AI-Specific Problems

| # | Problem | Impact |
|---|---------|--------|
| A1 | **Pure keyword rules for classification** — 13 hard-coded regex rules in `ingest-email.ts` miss context, produce false positives | Compliance risk from wrong classifications |
| A2 | **Static templates only** — 4 hard-coded auto-reply templates cannot handle nuanced queries | Poor CSAT, repetitive operator work |
| A3 | **No learning loop** — Rules never improve from human corrections | Same errors repeat indefinitely |
| A4 | **No confidence thresholds** — Cannot distinguish high vs low certainty | Overconfident wrong replies or missed auto-send opportunities |
| A5 | **No VIP/legal gates** — All emails treated equally | Risk of auto-replying to VIP or legal emails |
| A6 | **No follow-up automation** — Operator manually tracks and sends follow-ups | Missed SLAs, dropped threads |
| A7 | **No uBond/Consol awareness in AI** — AI didn't know which phase the batch was in | Wrong dedup decisions, wrong context |

---

## 2. Our Approach: Problems → Solutions

### 2.1 Batch Processing Pipeline (P1, P6, P7)

**Problem:** Manual Excel-based batch operations with no uBond/Consol separation.

**Solution:** A 9-step wizard pipeline with uBond/Consol sub-tabs, going from Excel upload to sent email in minutes.

```
  uBond (Pre-Arrival)     Consol (Pre-IGM Alert)
  ───────────────────     ─────────────────────
  • RAISE/LV/MV/HV        • Same NFBRK/FEBRK templates as uBond
  • Clearance team says   • Pre-IGM alert to customer
    "ye cargo me ane      • Emails already sent in uBond NOT
    wale hai"               re-sent (dedup)
  • Fresh AWBs, sometimes
    same AWBs repeat
  • Sent 2-3x/day
```

**Pipeline Steps:**

| Step | What Happens | AI Involvement |
|------|-------------|----------------|
| **1. Create Batch** | Select uBond or Consol. Auto-names: `UBOND-YYYY-MM-DD-AM/PM` or `CONSOL-YYYY-MM-DD-AM/PM` | Name suggestion |
| **2. Map Columns** | Drag-and-drop Excel. Auto-guesses column mappings (AWB, email, consignee, etc.) from known synonyms | Column mapping hints |
| **3. Validate** | Master data clearance lookup + courier check (Consol) + email validation + clearance counts | Company → clearance type lookup from `company_clearance_master` |
| **4. Review** | uBond: group by template, AI draft per group. Consol: Cargo→Courier, FEBRK Confirmation, NFBRK Confirmation panels | AI draft generation per clearance group |
| **5. Attachments** | Upload invoice PDFs (uBond only — Consol skips to preview) | — |
| **6. Convert** | Browser-side TIFF→PDF conversion | — |
| **7. Preview** | Final verification with AI pre-flight checks | Missing attachments, duplicate AWB detection |
| **8. Send** | SMTP dispatch with idempotency, locking, retries | Consol dedup: skip items already sent in uBond |
| **9. Summary** | Results: sent/failed, clearance breakdown, case status | — |

### 2.2 Clearance Type Resolution (P2)

**Problem:** Ambiguous clearance types require phone calls.

**Solution:** A three-tier resolution system:

```
  Tier 1: Master Data Lookup (≈90% of cases)
  ───────────────────────────────────────────
  Upload company_clearance_master from Excel
  → Maps company_name → clearance_type (NFBRK/FEBRK)
  → On Validate page, auto-fill clearance type
  → Badge: "✓ From Master Data"
  → No human action needed

  Tier 2: Human Research (≈8% of cases)
  ──────────────────────────────────────
  If company NOT in master data → Unresolved Panel
  → Operator searches each AWB in Outlook
  → Found → update clearance type → auto-saves to master data
  → Not found → flag for AI calling

  Tier 3: AI Voice Calling (≈2% of cases)
  ────────────────────────────────────────
  Only rows where human found nothing
  → Vapi AI calls customer
  → "For AWB X, NFBRK or FEBRK clearance?"
  → Result updates row + saves to master data
```

### 2.3 uBond/Consol Split (P6)

**Problem:** No separation between two distinct pre-alert phases.

**Solution:** Full architectural split:

| Dimension | uBond | Consol |
|-----------|-------|--------|
| **Timing** | Pre-arrival (before cargo lands) | Pre-IGM alert (before IGM filed) |
| **Classification** | RAISE/LV/MV/HV by clearance team | Same day / next day after uBond |
| **Templates** | NFBRK, FEBRK-Sunimpex, FEBRK-Jeena, Calling, Hold | Same templates as uBond |
| **Dedup** | Fresh AWBs, sometimes repeats | Emails sent in uBond NOT re-sent |
| **Frequency** | 2-3x per day | Same day or next day |
| **Attachments** | Required (invoices, DO format, bank details) | Skipped (redirect to preview) |
| **Review panels** | Group by template | Cargo→Courier, FEBRK Confirm, NFBRK Confirm |

### 2.4 AI Decision Engine (A1-A7)

**Problem:** Pure keyword rules, no ML, no learning, no safety gates.

**Solution:** Full-spectrum AI decision layer with data-determined autonomy.

```
  Inbound Email → IMAP Poll
       ↓
  Pre-Classification Hard Gates:
    • VIP sender? → HUMAN_REVIEW ⛔
    • Legal keywords? → HUMAN_REVIEW ⛔
    • OOO/Bounce? → IGNORE
       ↓
  Ensemble Classifier (5 stages):
    1. Rule Fast-Path (13 rules)
    2. Embedding Classifier (text-embedding-3-small → Logistic Regression)
    3. LLM Verifier (GPT-4o-mini)
    4. Ensemble Fusion (combine all 3 + confidence calibration)
    5. Audit Log (store in ai_classifications)
       ↓
  Route Decision:
    ┌─────────────────────────────────────────────────────┐
    │ Pattern data-proven safe + conf ≥ threshold         │
    │ NOT urgent, NOT VIP, NOT legal                     │
    │ → AI_AUTO_SEND (AI sends + closes. Audit logged.)   │
    ├─────────────────────────────────────────────────────┤
    │ Known pattern but needs human judgment              │
    │ → AI_DRAFT_HOLD (AI drafts → Human approves → Send) │
    ├─────────────────────────────────────────────────────┤
    │ Novel / urgent / VIP / legal / low confidence       │
    │ → HUMAN_REVIEW (Human Review Queue)                 │
    └─────────────────────────────────────────────────────┘
```

**Autonomy is determined by DATA, not assumption:**
1. Extract all historical emails via VBA script
2. Analyze patterns: which always get same reply? Zero variance? Zero errors?
3. Define auto-send conditions from data (confidence threshold, pattern match)
4. Start conservative — expand as data proves safety

### 2.5 Follow-Up Automation (A6)

**Problem:** No follow-up automation — missed SLAs, dropped threads.

**Solution:** AI-authored follow-ups queued for human approval.

| Trigger | After | Content |
|---------|-------|---------|
| NFBRK sent, no reply | 24h | Gentle reminder — docs pending |
| FEBRK sent, broker not confirmed | 48h | Broker confirmation escalation |
| Calling sent, no callback log | 4h | Callback reminder to operator |
| Case on hold >24h | Daily | Status check — escalate or close? |
| Thread inactive >7d | 7d | Check-in: any updates? |

**Every follow-up is AI-authored → human approves → sent. Never auto-sent.**

### 2.6 Case Management (P4, P5)

**Problem:** No reply tracking, no performance visibility.

**Solution:** Full case lifecycle + dashboards.

```
  Case Statuses:
  awaiting_reply → reply_received → documents_provided → boe_filed →
  assessment_pending → duty_assessed → out_of_charge → do_ready →
  do_collected → closed

  AI Features:
  • Auto-prioritization (urgency + SLA + customer tier)
  • Smart Compose (AI-written draft in reply editor)
  • Knowledge retrieval ("What was replied last time for this AWB?")
  • Smart assignment (skill match + workload)
  • Follow-up generation (timer-based)

  Dashboards:
  • Pre-alert: AI impact, volume, confirmed status, AI calling pipeline,
    send status, clearance pipeline, penalty exposure
  • Post-arrival: IGM status, DO collection, TP holds, BOE status
```

---

## 3. System Architecture

### 3.1 Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Framework** | Next.js 16 (App Router, Turbopack) | Full-stack web application |
| **Database** | Supabase (PostgreSQL + pgvector) | Data storage + vector search |
| **Auth** | Supabase Auth + Row Level Security | Authentication + authorization |
| **Email (outbound)** | Nodemailer (SMTP) or Microsoft Graph API | Send pre-alert emails |
| **Email (inbound)** | IMAP polling via imapflow | Receive and classify replies |
| **Queue** | Upstash QStash (production) / inline (dev) | Async send pipeline |
| **Locks** | Upstash Redis | Distributed locking for send |
| **Storage** | Supabase Storage | Invoice PDFs, batch sources, attachments |
| **Voice AI** | Vapi (Vapi.ai) | AI phone calling for clearance type |
| **AI Embeddings** | OpenAI text-embedding-3-small | 1536-dim vector embeddings |
| **AI Classifier** | Logistic Regression + GPT-4o-mini | Ensemble classification |
| **AI Draft** | GPT-4o-mini + RAG | Context-aware reply generation |
| **Templates** | Handlebars-style `{VARIABLE}` replacement | Email template rendering |
| **State** | Supabase Realtime | Live send progress updates |
| **CI** | GitHub Actions | Lint, typecheck, build, e2e |
| **Hosting** | Vercel | Production deployment |

### 3.2 Architecture Diagram

```
  ┌─────────────────────────────────────────────────────────────────┐
  │                        CLIENT (Next.js 16)                      │
  │  ┌─────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────────┐  │
  │  │ Batches │ │  Cases   │ │  Calls   │ │  AI Drafts Queue  │  │
  │  │ Wizard  │ │  Pages   │ │  Page    │ │  Follow-Up Queue  │  │
  │  └────┬────┘ └────┬─────┘ └────┬─────┘ └────────┬──────────┘  │
  │       │           │            │                 │              │
  └───────┼───────────┼────────────┼─────────────────┼──────────────┘
          │           │            │                 │
  ┌───────┼───────────┼────────────┼─────────────────┼──────────────┐
  │       ▼           ▼            ▼                 ▼              │
  │                     API LAYER (Next.js API Routes)              │
  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
  │  │ /batches │ │ /cases   │ │ /vapi    │ │ /ai/*            │  │
  │  │ /api/*   │ │ /api/*   │ │ /webhook │ │ classify, draft, │  │
  │  │          │ │          │ │          │ │ similar, followup│  │
  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────────┬─────────┘  │
  │       │            │            │                 │              │
  └───────┼────────────┼────────────┼─────────────────┼──────────────┘
          │            │            │                 │
  ┌───────┼────────────┼────────────┼─────────────────┼──────────────┐
  │       ▼            ▼            ▼                 ▼              │
  │                      SERVICE LAYER                              │
  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
  │  │ Send     │ │ Ingest   │ │ Vapi     │ │ AI Services      │  │
  │  │ Pipeline │ │ Email    │ │ Client   │ │ classify, embed, │  │
  │  │          │ │          │ │          │ │ rag, draft       │  │
  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────────┬─────────┘  │
  │       │            │            │                 │              │
  └───────┼────────────┼────────────┼─────────────────┼──────────────┘
          │            │            │                 │
  ┌───────┼────────────┼────────────┼─────────────────┼──────────────┐
  │       ▼            ▼            ▼                 ▼              │
  │                      EXTERNAL INTEGRATIONS                       │
  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐  │
  │  │ SMTP /   │ │ Outlook  │ │ Vapi AI  │ │ OpenAI           │  │
  │  │ Graph    │ │ IMAP     │ │ Voice    │ │ Embed + Chat     │  │
  │  └──────────┘ └──────────┘ └──────────┘ └──────────────────┘  │
  │                                                                  │
  └──────────────────────────────────────────────────────────────────┘
          │            │            │                 │
  ┌───────┼────────────┼────────────┼─────────────────┼──────────────┐
  │       ▼            ▼            ▼                 ▼              │
  │                      DATA LAYER                                 │
  │  ┌──────────────────────────────────────────────────────────┐  │
  │  │                   Supabase (PostgreSQL)                   │  │
  │  │  ┌────────────┐ ┌────────────┐ ┌────────────────────┐   │  │
  │  │  │ batch_runs │ │ awb_cases  │ │ email_events       │   │  │
  │  │  │ batch_items│ │            │ │                    │   │  │
  │  │  ├────────────┤ ├────────────┤ ├────────────────────┤   │  │
  │  │  │ company_   │ │ templates  │ │ ai_classifications │   │  │
  │  │  │ clearance_ │ │ (w/vector) │ │ ai_drafts          │   │  │
  │  │  │ master     │ │            │ │                    │   │  │
  │  │  ├────────────┤ ├────────────┤ ├────────────────────┤   │  │
  │  │  │ followup_  │ │ training_  │ │ app_config         │   │  │
  │  │  │ schedules  │ │ examples   │ │ inference_log      │   │  │
  │  │  └────────────┘ └────────────┘ └────────────────────┘   │  │
  │  └──────────────────────────────────────────────────────────┘  │
  │                                                                  │
  │  ┌──────────────────┐  ┌──────────────────┐                    │
  │  │   Redis (Upstash) │  │   Supabase       │                    │
  │  │   Distributed     │  │   Storage        │                    │
  │  │   Locks + Queue   │  │   (PDFs, assets) │                    │
  │  └──────────────────┘  └──────────────────┘                    │
  └──────────────────────────────────────────────────────────────────┘
```

---

## 4. End-to-End Process Flow

### 4.1 Complete Data Flow

```
  OUTLOOK ──VBA Extract──→ email_extract.csv ──Clean──→ Supabase emails (w/ embeddings)
  EXCEL   ──Upload────────→ company_clearance_master (company → clearance_type)

  OPERATOR ──Create Batch (uBond/Consol)
       ↓
  OPERATOR ──Upload Excel → Map Columns
       ↓
  ┌─────────────────────────────────────────────────────────────────┐
  │  VALIDATE PAGE                                                  │
  │                                                                 │
  │  For each row:                                                  │
  │    Lookup company_clearance_master by consignee name            │
  │    ──Found?──→ Auto-fill NFBRK/FEBRK ✓                         │
  │    ──Not Found?──→ Unresolved Panel                             │
  │       → Human searches Outlook                                  │
  │       → Found? → Update + save to master                        │
  │       → Not Found? → Flag for AI Calling                        │
  │                                                                 │
  │  Also: Courier check (Consol), email validation, dupe check    │
  └─────────────────────────────────────────────────────────────────┘
       ↓
  ┌─────────────────────────────────────────────────────────────────┐
  │  REVIEW PAGE                                                    │
  │                                                                 │
  │  uBond:                                                         │
  │    Group by NFBRK/FEBRK/Calling/Hold                            │
  │    AI generates draft reply per group                           │
  │                                                                 │
  │  Consol:                                                        │
  │    Panel 1: Cargo→Courier move (≥70kg/10pc)                    │
  │    Panel 2: FEBRK Confirmation (Sunimpex/Jeena)                │
  │    Panel 3: NFBRK Confirmation                                  │
  └─────────────────────────────────────────────────────────────────┘
       ↓
  ATTACHMENTS (uBond only) ──→ PREVIEW ──→ AI Pre-flight Check ──→ SEND
       ↓
  POST-SEND: Follow-ups scheduled per clearance type
       ↓
  INBOUND: IMAP poll → AI classify → route → update case
```

### 4.2 AI Decision Engine Flow

```
  INBOUND EMAIL
       ↓
  IMAP Poll (every 60s)
       ↓
  Pre-Classification Hard Gates:
    ├─ VIP? → HUMAN_REVIEW
    ├─ Legal keywords? → HUMAN_REVIEW
    ├─ OOO/Bounce? → IGNORE
    └─ None triggered → Continue
       ↓
  Ensemble Classifier:
    ├─ Stage 1: Rule Fast-Path (13 keyword rules → baseline)
    ├─ Stage 2: Embedding Classifier (1536d → Logistic Regression)
    ├─ Stage 3: LLM Verifier (GPT-4o-mini → structured JSON)
    ├─ Stage 4: Ensemble Fusion (combine + calibrate confidence)
    └─ Stage 5: Audit Log (store in ai_classifications)
       ↓
  Route Decision:
    ├─ Pattern data-proven safe + conf ≥ threshold?
    │  ├─ NOT urgent, NOT VIP, NOT legal?
    │  └─ Yes → AI_AUTO_SEND (send reply, close case, audit)
    ├─ Known pattern but needs judgment?
    │  └─ Yes → AI_DRAFT_HOLD (draft → human approves → send)
    └─ Novel/urgent/VIP/legal/low conf?
       └─ Yes → HUMAN_REVIEW (Human Review Queue)
```

---

## 5. Key Features Deep Dive

### 5.1 uBond/Consol Split

The entire batch pipeline is aware of whether it's processing uBond or Consol:

| Feature | uBond Behavior | Consol Behavior |
|---------|---------------|-----------------|
| Batch name | `UBOND-YYYY-MM-DD-AM/PM` | `CONSOL-YYYY-MM-DD-AM/PM` |
| Validate: courier check | Skipped | Check >70kg/pc, ≥10 pieces |
| Review panels | Group by template | Cargo→Courier, FEBRK Confirm, NFBRK Confirm |
| Attachments | Required | Skipped (redirect to preview) |
| Preview: attachment column | Shown | Hidden |
| Send: dedup | Normal | Skip items already sent in uBond |
| Post-send: awb_cases | pre_alert_type = 'ubond' | pre_alert_type = 'consol' |

### 5.2 Clearance Type Resolution (Three Tiers)

**Tier 1 — Master Data (≈90%):**

```
  Source: Excel upload → company_clearance_master table
  Lookup: By consignee company name (normalized)
  Result: Auto-fill clearance type + badge "From Master Data"
  Learning: When human resolves an unknown company, auto-saves to master
```

**Tier 2 — Human Research (≈8%):**

```
  Trigger: Company not found in master data
  UI: Unresolved Panel with list of AWBs
  Action: Operator searches each AWB one-by-one in Outlook
  Outcome 1: Found → update clearance type + save to master
  Outcome 2: Not found → flag for AI calling
```

**Tier 3 — AI Calling (≈2%):**

```
  Trigger: Human could not find any historical data
  System: Vapi AI voice call to customer
  Script: "For AWB X, will this be NFBRK or FEBRK clearance?"
  Result: Updates row + saves to master data
```

### 5.3 Consol Review (Three Confirmation Rules)

```
  ✓ 1. Cargo → Courier Move
       Courier compliance is higher. Cargo has weight issues per piece.
       Threshold: >70kg per piece, ≥10 pieces → flag for move

  ✓ 2. Confirm Sunimpex or Jeena in FEBRK
       Every FEBRK shipment must have a confirmed broker.
       If broker email is missing → fetch it.

  ✓ 3. Confirm NFBRK or FEBRK
       For NFBRK: confirm it's actually NFBRK
       For FEBRK: confirm Sunimpex or Jeena is assigned
```

### 5.4 AI Draft Generation

```
  Trigger: Review page (per clearance type group)
  Input: Classified email + RAG context + case data
  RAG: Vector search → 5 similar historical emails + best template
  Model: GPT-4o-mini with FedEx system prompt
  Output: { subject, body_html, body_text, confidence, flags }
  Lifecycle: pending → approved | edited | rejected → sent
  Gate: Human MUST approve before send
```

### 5.5 Follow-Up Scheduler

```
  NFBRK no reply @24h  → Draft reminder (AI → human approve → send)
  FEBRK no confirm @48h → Draft escalation
  Calling no log @4h   → Draft callback reminder
  Hold >24h            → Draft status check
  Inactive >7d         → Draft check-in
  Escalation no action  → Draft supervisor notification

  Every follow-up: AI-authored → Human approved → Sent. NEVER auto-sent.
```

### 5.6 Inbound Email Classification

| Route | Condition | Human Gate |
|-------|-----------|------------|
| **AI_AUTO_SEND** | Data-proven safe pattern + conf ≥ threshold + not urgent + not VIP + not legal | ❌ Auto |
| **AI_DRAFT_HOLD** | Known pattern but needs judgment | ✅ Must approve |
| **HUMAN_REVIEW** | Novel / urgent / VIP / legal / low confidence | ✅ Mandatory |
| **IGNORE** | OOO, bounce, auto-reply | ❌ Auto |

### 5.7 Safety Gates

| Gate | Rule |
|------|------|
| SG-01 | No auto-send for urgent emails |
| SG-02 | No auto-send for legal/compliance emails |
| SG-03 | VIP customers always → human review |
| SG-04 | All drafts require human approval |
| SG-05 | No auto-send of follow-ups |
| SG-06 | Configurable confidence thresholds |
| SG-07 | Full audit trail for every AI decision |
| SG-08 | Kill-switch: AI_ENABLED=false reverts to rule-based |
| SG-09 | Model rollback (previous 3 versions kept) |
| SG-10 | PII protection in LLM calls |
| SG-11 | Rate limiting on AI API calls |
| SG-12 | Human override always possible |

---

## 6. AI Decision Engine

### 6.1 Architecture

```
  Input: subject + body + sender + thread_history
         │
         ▼
  ┌─────────────────────────────────────────────┐
  │  STAGE 1: RULE FAST-PATH                    │
  │  13 keyword rules → baseline classification │
  │  Runs first for OOO, bounce, clear matches  │
  └─────────────────────────────────────────────┘
         │
         ▼
  ┌─────────────────────────────────────────────┐
  │  STAGE 2: EMBEDDING CLASSIFIER              │
  │  text-embedding-3-small → 1536d vector      │
  │  Logistic Regression → clearance_type (95%) │
  │                       → intent (85%)        │
  └─────────────────────────────────────────────┘
         │
         ▼
  ┌─────────────────────────────────────────────┐
  │  STAGE 3: LLM VERIFIER                      │
  │  GPT-4o-mini → structured JSON              │
  │  Includes reasoning, entities, flags        │
  │  Fallback: skip if API unavailable          │
  └─────────────────────────────────────────────┘
         │
         ▼
  ┌─────────────────────────────────────────────┐
  │  STAGE 4: ENSEMBLE FUSION                   │
  │  Combine rule + ML + LLM confidences        │
  │  Apply temperature-scaled calibration       │
  │  Determine route from decision matrix       │
  └─────────────────────────────────────────────┘
         │
         ▼
  ┌─────────────────────────────────────────────┐
  │  STAGE 5: AUDIT LOG                         │
  │  Store in ai_classifications table          │
  │  classifier_version, latency, all outputs   │
  └─────────────────────────────────────────────┘
```

### 6.2 RAG Retriever

```
  Query: new email → embed (1536d) → vector search
  Filter: same clearance_type + intent
  Returns: top 5 similar historical emails + best template
  Context: fed to LLM for draft generation
```

### 6.3 Retraining Pipeline

```
  Sources: draft_rejection, human_review_correction, call_log_override
  Trigger: 100 new corrections OR weekly cron
  Process: re-embed → retrain classifier → evaluate → deploy
  Versioning: major.minor.patch, previous 3 versions kept
  Rollback: CLASSIFIER_VERSION env var pin
```

---

## 7. Data Stores

### 7.1 Database Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `batch_runs` | Batch state, wizard progress | pre_alert_type (uBond/Consol), phase, status |
| `batch_items` | Per-AWB data in batch | clearance_type, email, send_status |
| `awb_cases` | Full case lifecycle | current_status, clearance_type, pre_alert_type |
| `company_clearance_master` | Company → clearance type | company_name, clearance_type, times_seen |
| `emails` | Extracted emails w/ embeddings | subject, body, awb, embedding (1536d) |
| `templates` | Email templates w/ embeddings | clearance_type, subject, body, embedding |
| `ai_classifications` | Every AI decision | route, confidence, classifier_version |
| `ai_drafts` | AI-generated drafts | subject, body, status (pending→sent) |
| `followup_schedules` | Scheduled follow-ups | trigger_rule, scheduled_at, status |
| `training_examples` | Human corrections | field_name, predicted, corrected |
| `app_config` | Runtime configuration | key, value (JSONB) |
| `inference_log` | Model performance | predicted, actual, confidence, latency |
| `call_tasks` | AI phone call tracking | call_type, status, result |
| `email_events` | Email log | direction, status, message_id |
| `case_updates` | Audit trail | actor_type (ai/human), action, details |

### 7.2 External Storage

| Storage | Purpose |
|---------|---------|
| Supabase Storage (invoices) | Invoice PDFs per batch |
| Supabase Storage (batch-sources) | Original Excel files |
| Supabase Storage (template-attachments) | DO FORMAT.docx, BANK DETAILS.docx |
| Upstash Redis | Distributed locks, queue state |

---

## 8. Key Files by Feature

| Feature | Files |
|---------|-------|
| **Batch creation** | `src/app/(app)/batches/new/page.tsx`, `src/app/api/batches/route.ts` |
| **uBond/Consol split** | `src/app/(app)/batches/page.tsx` (sub-tabs), `batch-form.tsx` (radio toggle) |
| **Excel parsing + mapping** | `src/lib/excel/parse.ts`, `src/lib/excel/map-rows.ts` |
| **Validate page** | `src/app/api/batches/[id]/validate/route.ts`, `email-issues-panel.tsx` |
| **Clearance master data** | `company_clearance_master` table, lookup in validate route |
| **Review page** | `src/app/(app)/batches/[id]/review/`, `consol-review-panel.tsx` |
| **AI Drafts** | `src/lib/ai/draft.ts`, `POST /api/ai/draft-reply` |
| **Send pipeline** | `src/lib/send/process-send-job.ts`, `finalize-send.ts` |
| **Follow-up scheduler** | `src/lib/ai/followup.ts`, `followup_schedules` table |
| **Inbound email** | `src/lib/email/ingest-email.ts`, `src/lib/email/imap.ts` |
| **AI Classifier** | `src/lib/ai/classify.ts`, `src/lib/ai/embed.ts` |
| **RAG** | `src/lib/ai/rag.ts` |
| **AI Calling** | `src/lib/vapi/`, `src/app/api/vapi/webhook/route.ts` |
| **Case management** | `src/app/(app)/cases/`, `src/app/(app)/my-cases/`, `src/lib/cases/` |
| **Human Review** | `src/app/(app)/human-review/page.tsx` |
| **Calls page** | `src/app/(app)/calls/page.tsx` |
| **Dashboards** | Prior (`/dashboard/prior`), Post (`/dashboard/post`) |
| **Templates** | `src/app/(app)/templates/` |
| **Migrations** | `supabase/migrations/0001-0038.sql` |
| **VBA Extraction** | `scripts/outlook_awb_extractor.bas` |
| **AI Training** | `scripts/train_classifier.py`, `scripts/embed_and_store.py` |
| **Safety Gates** | `src/lib/ai/safety.ts` |

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-07-23 | Initial comprehensive rewrite — covers all problems (P1-P7, A1-A7), full solutions, uBond/Consol split, master data clearance resolution, AI decision engine with data-determined autonomy, three-tier clearance type resolution, Consol review rules, safety gates, end-to-end process flows |
