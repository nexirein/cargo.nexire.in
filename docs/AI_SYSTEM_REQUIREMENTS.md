# AI System Requirements & Design — Cargo Pre-Alert Intelligence

**Status:** Planning Phase (Pre-Build)
**Priority Hierarchy:** Customer Satisfaction → Team Efficiency → Zero FedEx Operational Errors
**Design Principle:** AI is autonomous in data-proven safe patterns, assistant in all others. Auto-send allowed when pattern is proven safe by historical data analysis. Every novel, urgent, VIP, legal, or low-confidence case requires human gate. Safety over autonomy always.

***

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Business Domain Context](#2-business-domain-context)
3. [Current System Analysis](#3-current-system-analysis)
4. [Complete AI Touchpoints Across the System](#4-complete-ai-touchpoints-across-the-system)
5. [Decision Matrix: AI vs Human Review](#5-decision-matrix-ai-vs-human-review)
6. [AI Model Architecture](#6-ai-model-architecture)
7. [RAG Retriever](#7-rag-retriever)
8. [Response Generator](#8-response-generator)
9. [Follow-Up Engine](#9-follow-up-engine)
10. [Call Logging AI Integration](#10-call-logging-ai-integration)
11. [Data Schema Extensions](#11-data-schema-extensions)
12. [Safety & Compliance Requirements](#12-safety--compliance-requirements)
13. [Metrics & Success Criteria](#13-metrics--success-criteria)
14. [Implementation Phases](#14-implementation-phases)
15. [Clarifying Questions Before Build](#15-clarifying-questions-before-build)
16. [File Structure for Implementation](#16-file-structure-for-implementation)
17. [Appendix: Comparison — Current Rule-Based vs Future AI System](#17-appendix-comparison--current-rule-based-vs-future-ai-system)

***

## 1. Executive Summary

This document defines the complete requirements for transforming the current **rule-based email classifier** into a **full-spectrum AI decision layer** that powers the entire Cargo Pre-Alert Operations system.

### What This System Is

This is a comprehensive AI architecture that:

- **Routes every inbound email** to the correct path — AI-auto-send (data-determined safe conditions), AI-draft-hold (human must approve), or human-review (must-have human eyes)
- **Auto-sends replies in safe, data-determined conditions** — where the Excel data proves the pattern is routine and error-free
- **Holds AI replies in draft** for cases that need human judgment (urgent, VIP, legal, novel, low-confidence)
- **Generates contextual follow-up emails** authored by AI — auto-sent for routine reminders, held for escalation-grade follow-ups
- **Tracks checklist completion** (documents for BOE filing) and surfaces gaps to the operator
- **Learns continuously** from human corrections via a feedback loop

### Autonomy Rule

```
  AI CAN auto-send when:
  ──────────────────────
  • Pattern is proven safe by data analysis of historical emails
  • Confidence ≥ data-determined threshold (not assumed — measured)
  • Not urgent, not VIP, not legal, not escalation
  • Case type is routine (payment received, freight query,
    pdf invoice request, info only, etc.)

  AI MUST hold for human review when:
  ─────────────────────────────────────
  • Urgency = urgent (any confidence)
  • Sender is VIP customer
  • Body contains legal/compliance keywords
  • Novel pattern not seen in training data
  • Confidence < data-determined threshold
  • Escalation or special_case
```

### The Real Business Objective

The pre-alert process exists for one reason: **get the checklist done**. "Checklist" means the required documents the customer needs to file in order to clear the Bill of Entry (BOE). This applies to both NFBRK and FEBRK clearance types. Every AI feature must be evaluated against this core question: does it help get the checklist done faster?

### Core Philosophy

```
                          ┌──────────────────────────────────┐
                          │  AI IS AUTONOMOUS IN SAFE       │
                          │  PATTERNS, ASSISTANT IN ALL     │
                          │  OTHERS                         │
                          ├──────────────────────────────────┤
                          │  • Auto-sends → when data proves pattern    │
                          │                   is routine & safe         │
                          │  • Drafts      → when human judgment needed │
                          │  • Retrieves   → finds similar cases        │
                          │                   from history               │
                          │  • Suggests    → proposes next actions      │
                          │  • Schedules   → queues follow-ups          │
                          │  • Tracks      → checklist items done       │
                          │                   vs pending                 │
                          │                                             │
                          │  ✓ CAN auto-send routine replies            │
                          │  ✓ CAN auto-close non-operational cases     │
                          │  ✓ CAN auto-send routine follow-ups         │
                          │                                             │
                          │  ✗ NEVER auto-sends urgent                 │
                          │  ✗ NEVER auto-sends VIP/legal              │
                          │  ✗ NEVER auto-sends novel/unseen patterns  │
                          │  ✗ NEVER bypasses safety gates             │
                          └──────────────────────────────────┘
```

### How Autonomy Is Determined

The specific conditions for auto-send are NOT assumed or hard-coded. They are determined by **analyzing the Excel data** from the VBA extraction:

```
  Step 1: Extract all historical emails via VBA script
  Step 2: Analyze patterns:
          • Which email types always get the same reply?
          • Which have zero variance in response?
          • Which have never caused a compliance issue?
          • What is the historical accuracy of rule-based classification?
  Step 3: Define auto-send conditions from data:
          • Threshold: confidence ≥ 0.97 (or data-determined value)
          • Pattern: must match known safe pattern in training data
          • Exclusions: urgent, VIP, legal, novel
  Step 4: Start conservative — only auto-send patterns with
          100% historical accuracy in training data
  Step 5: Expand as data proves more patterns are safe
```

### Scope of This Document

| What Is Covered                                     | What Is NOT Covered                      |
| --------------------------------------------------- | ---------------------------------------- |
| AI decision engine for inbound email routing        | Batch creation workflow (existing)       |
| AI-assisted validation, review, and send pages      | uBond/Consol split (already implemented) |
| AI-generated draft replies with human approval      | IMAP polling infrastructure (existing)   |
| AI-authored follow-up scheduler                     | VBA email extraction (existing)          |
| RAG retrieval for context-aware replies             | Template management (existing)           |
| Call logging AI (speech-to-text, action extraction) | Basic case management CRUD (existing)    |
| Classification model training + feedback loop       | User authentication / RBAC (existing)    |
| Safety gates, audit trail, compliance               | Infrastructure / deployment (existing)   |
| Human-in-the-loop UI for draft approval             | UI component library decisions           |

***

## 2. Business Domain Context

Before designing any AI system, we must understand the actual business domain. These truths are non-negotiable and every AI decision must align with them.

### 2.1 The Objective of Pre-Alert

The single purpose of pre-alert is: **GET THE CHECKLIST DONE**.

"Checklist" means the required documents the customer needs to file to clear the Bill of Entry (BOE). This applies to both NFBRK and FEBRK clearance types. The operator's job is to:

1. Send the pre-alert email with the checklist of required documents
2. Follow up until all checklist items are received
3. Confirm broker (Sunimpex/Jeena) for FEBRK
4. Ensure BOE filing can proceed

AI must be judged by one question: **does it help get the checklist done faster?**

### 2.2 uBond vs Consol — The Split

These are two distinct pre-alert phases with different timing, purpose, and rules.

```
TIMELINE:
                         uBond                          Consol                   IGM Filed
  ───────────────────────┼──────────────────────────────┼─────────────────────────▶ Time
                         │                              │
                    Before arrival                  Pre-IGM alert
                  (pre-arrival)                  (same templates as uBond)
```

#### uBond (Pre-Arrival)

| Aspect        | Detail                                                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------------------------------------- |
| **When**      | Before cargo arrives. Can happen even a day before in line (ligne).                                                     |
| **What**      | A classification: **RAISE / LV / MV / HV**. Clearance team says "ye cargo me ane wale hai" (these are coming in cargo). |
| **Frequency** | Sent 2–3 times per day.                                                                                                 |
| **AWBs**      | Mostly fresh AWBs. Sometimes same AWBs repeat from previous uBond batches (dedup needed).                               |
| **Emails**    | Same pre-alert email templates (NFBRK, FEBRK, Calling, Hold).                                                           |
| **Certainty** | Lower — cargo hasn't arrived yet, details may change.                                                                   |

#### Consol (Pre-IGM Alert)

| Aspect              | Detail                                                                                                                                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **When**            | Before IGM (Import General Manifest) is filed. Same day or next day.                                                                                                                                                                 |
| **What**            | Pre-IGM file alert to the customer — informing them that the IGM is about to be filed. Same templates as uBond (NFBRK, FEBRK-Sunimpex, FEBRK-Jeena).                                                                                 |
| **Dedup**           | Emails already sent in uBond are **NOT re-sent** in Consol. If the broker already got the NFBRK email in uBond, they do not get it again in Consol.                                                                                  |
| **Relation to IGM** | Consol goes out BEFORE the IGM is filed. IGM will be final — cargo details won't change after this. That is why uBond is sent first (to get ahead of the process), and Consol is sent closer to arrival as a final pre-IGM heads-up. |

### 2.3 Consol Review Actions (The 3 Confirmation Rules)

When processing a Consol batch, the operator must confirm three things:

```
CONSOL REVIEW CHECKLIST
────────────────────────

□ 1. CARGO → COURIER MOVE
     • Courier compliance is higher (courier has stricter rules)
     • Cargo has weight issues per piece
     • Threshold: > 70kg per piece, ≥ 10 pieces
     • If a shipment meets this threshold → flag for Cargo→Courier move

□ 2. CONFIRM SUNIMPEX OR JEENA IN FEBRK
     • Every FEBRK shipment must have a confirmed broker
     • Broker is either Sunimpex or Jeena
     • If the broker's email ID is missing → fetch it
     • This is a mandatory check before sending

□ 3. CONFIRM NFBRK OR FEBRK
     • For NFBRK: confirm it's actually NFBRK
     • For FEBRK: confirm Sunimpex or Jeena is assigned
     • This clearance type confirmation is the foundation of everything
```

### 2.4 Why This Matters for AI

| Misconception                             | Correction                                                                                                                               | AI Implication                                      |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- |
| "Auto-close means AI closes the case"     | AI CAN auto-close operational cases IF the pattern is data-proven safe. Otherwise, only OOO/bounce/auto-reply can be auto-ignored.       | `ai_auto_send` route is data-conditioned            |
| "Auto-reply means AI sends without human" | Every AI reply is held in draft for human approval.                                                                                      | Draft queue is mandatory                            |
| "Classification is the end goal"          | Classification is only useful if it helps get the checklist done.                                                                        | Every feature must tie back to checklist completion |
| "uBond and Consol are the same"           | They have different timing (pre-arrival vs pre-IGM), same templates (NFBRK/FEBRK), and dedup rules (uBond emails NOT re-sent in Consol). | AI must respect uBond vs Consol dedup and timing    |

***

## 3. Current System Analysis

### 3.1 Outbound Flow (Batch Send — Already Implemented)

```
Create Batch (uBond/Consol)
       ↓
  Map Columns (AWB, HAWB, Consignee, etc.)
       ↓
  Validate (clearance counts, courier check, email validation)
       ↓
  Review (uBond: group by template / Consol: Cargo→Courier, FEBRK, NFBRK)
       ↓
  Attachments (uBond only — Consol redirects to preview)
       ↓
  Preview (final verification before send)
       ↓
  Send (process-send-job.ts → SMTP)
       ↓
  Summary (post-send confirmation)
```

**Current AI Involvement in Outbound:** None. Everything is manual, template-based, and operator-driven.

### 3.2 Inbound Flow (Current — Pure Rule-Based)

```
IMAP Poll (polls every ~60 seconds)
       ↓
  classifyEmail() → 13 keyword regex rules
       ↓
  ┌─────────────┬──────────────┬──────────────┐
  │             │              │              │
  ↓             ↓              ↓              ↓
ignore      auto_send     draft_approve   human_review
       ↓             ↓              ↓              ↓
  close case  sendAutoReply()  save draft     Human Review
              (NO human        (NO UI to      Page
               check)           approve yet)
```

**Current Rule Set (13 Rules):**

| Rule                   | Issue Type            | Action         | Auto-Reply? | Auto-Close? | Confidence |
| ---------------------- | --------------------- | -------------- | ----------- | ----------- | ---------- |
| out\_of\_office        | out\_of\_office       | ignore         | No          | Yes         | 0.90       |
| bounce                 | bounce                | ignore         | No          | Yes         | 0.95       |
| payment\_received      | payment\_received     | auto\_send     | Yes         | Yes         | 0.85       |
| freight\_query         | freight\_query        | auto\_send     | Yes         | Yes         | 0.80       |
| pdf\_invoice\_request  | pdf\_invoice\_request | auto\_send     | Yes         | Yes         | 0.80       |
| checklist\_request     | checklist\_request    | draft\_approve | No (draft)  | No          | 0.70       |
| status\_query          | status\_query         | draft\_approve | No (draft)  | No          | 0.75       |
| reminder\_needed       | reminder\_needed      | human\_review  | No          | No          | 0.70       |
| info\_only             | info\_only            | ignore         | Yes         | Yes         | 0.70       |
| escalation             | escalation            | human\_review  | No          | No          | 0.85       |
| special\_case          | special\_case         | human\_review  | No          | No          | 0.75       |
| unclear (fallback)     | unclear               | human\_review  | No          | No          | 0.00       |
| (new) urgent\_override | (inherits)            | human\_review  | No          | No          | 1.00       |

### 3.3 Critical Gaps in Current System

| Gap                                   | Current Behavior                                   | Impact                                                | FedEx Risk                                       |
| ------------------------------------- | -------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------ |
| **Pure keyword rules**                | Matches on regex only — no semantic understanding  | Misses context, false positives on ambiguous language | Compliance violation from missed classifications |
| **No ML confidence calibration**      | Confidence is hard-coded per rule, not data-driven | Cannot distinguish high vs low certainty              | Overconfident wrong replies                      |
| **`auto_send`** **sends immediately** | No human review before reply goes out              | Wrong reply reaches customer                          | Customer dissatisfaction, brand damage           |
| **No thread awareness**               | Each email classified independently                | Repeats information, misses conversation history      | Confusion, contradictory replies                 |
| **Static templates only**             | 4 hard-coded auto-reply templates                  | Cannot handle nuanced or compound queries             | Poor CSAT, rework                                |
| **No learning loop**                  | Rules never improve from corrections               | Same errors repeat indefinitely                       | Stagnant accuracy                                |
| **No confidence thresholds**          | Low-confidence = human anyway (wasted potential)   | Missed opportunities for safe auto-close              | Inefficiency                                     |
| **No VIP/legal gates**                | All rules treated equally                          | VIP or legal emails could get auto-replied            | Serious compliance risk                          |
| **No follow-up automation**           | Operator must manually track and send follow-ups   | Missed SLAs, dropped threads                          | Operational failures                             |

### 3.4 What We Already Have (Assets to Build On)

| Asset                    | File / Location                       | Used For                               |
| ------------------------ | ------------------------------------- | -------------------------------------- |
| VBA email extractor      | `scripts/outlook_awb_extractor.bas`   | Training data collection               |
| Rule-based classifier    | `src/lib/email/ingest-email.ts`       | Fast-path fallback + baseline accuracy |
| IMAP poller              | `src/app/api/inbox/poll/route.ts`     | Inbound email ingestion                |
| Draft reply storage      | `draft_replies` table                 | AI draft persistence                   |
| Classification analytics | `ai_classifications` table            | Audit trail + performance monitoring   |
| Batch send pipeline      | `src/lib/send/process-send-job.ts`    | Outbound email dispatch                |
| uBond/Consol split       | Full batch workflow                   | Pre-alert type routing context         |
| Human Review page        | `src/app/(app)/human-review/page.tsx` | Operator review queue                  |
| Case management          | `cases/page.tsx`, `my-cases/page.tsx` | Case-level AI integration              |
| Calls page               | `calls/page.tsx`                      | Call-email thread linking              |
| Template library         | `templates` table                     | Base for AI draft generation           |
| Follow-up rules spec     | Business logic documented             | Deterministic scheduler rules          |

***

## 4. Complete AI Touchpoints Across the System

This section defines every single point in the application where AI logic touches data, UI, or decisions.

### 4.1 Inbound Email Processing Pipeline (IMAP → Decision → Action)

```
                    INBOUND EMAIL DECISION ENGINE
                    ────────────────────────────
  ┌─────────────────────────────────────────────────────────────────┐
  │                                                                 │
  │  Step 1: Receive                                               │
  │  ────────                                                      │
  │  IMAP poll → new email → parse headers + body                  │
  │  → extract AWB from subject/body → link to awb_cases           │
  │                                                                 │
  │  Step 2: Pre-Classification Filters (Hard Gates)               │
  │  ──────────────────────────────────────────                    │
  │  • Is sender a VIP customer? → HUMAN_REVIEW (skip AI)         │
  │  • Does body contain legal/compliance keywords? → HUMAN_REVIEW │
  │  • Is subject/body OOO/bounce/auto-reply? → IGNORE             │
  │  • Is this from a known internal domain? → INFO_ONLY           │
  │                                                                 │
  │  Step 3: AI Classification (Ensemble)                          │
  │  ───────────────────────────────                               │
  │  Input: subject + body + sender + thread_history               │
  │  Process: rule fast-path → embedding classifier → LLM few-shot │
  │  Output: {                                                     │
  │    clearance_type, intent, urgency,                             │
  │    entities (AWB, DO#, amounts),                                │
  │    confidence, route, explanation                               │
  │  }                                                              │
  │                                                                 │
  │  Step 4: Route Decision                                         │
  │  ─────────────────                                              │
  │                                                                  │
  │  How autonomy is determined: CONDITIONS COME FROM EXCEL DATA.   │
  │  We analyze historical emails to find patterns where AI can     │
  │  safely auto-send without human review. Everything else goes    │
  │  through human gates.                                           │
  │                                                                  │
  │  ┌────────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
  │  │   AI_AUTO_SEND    │  │  AI_DRAFT_HOLD   │  │ HUMAN_REVIEW│ │
  │  ├────────────────────┤  ├──────────────────┤  ├─────────────┤ │
  │  │ Pattern proven     │  │ Known pattern    │  │ Novel       │ │
  │  │ safe by data       │  │ but needs human  │  │ pattern     │ │
  │  │ Conf ≥ threshold*  │  │ judgment         │  │ OR urgent   │ │
  │  │ Not urgent         │  │ Conf < threshold │  │ OR VIP      │ │
  │  │ Not VIP/legal      │  │ Any urgency      │  │ OR legal    │ │
  │  │ Routine case       │  │                  │  │ OR low conf │ │
  │  ├────────────────────┤  ├──────────────────┤  ├─────────────┤ │
  │  │ → AI sends reply   │  │ → AI drafts      │  │ → Human     │ │
  │  │ → Auto-closes case │  │ → Human reviews  │  │   Review    │ │
  │  │ → Audit logged     │  │ → Human approves │  │   Queue     │ │
  │  └────────────────────┘  └──────────────────┘  └─────────────┘ │
  │                                                                  │
  │  *threshold is NOT assumed — determined by Excel data analysis   │
  │                                                                 │
  │  Step 5: Human Action (for all operational emails)             │
  │  ─────────────────────────────────                             │
  │  • Operator opens draft → reads AI suggestion → edits → sends  │
  │  • Or rejects draft → writes from scratch → sends              │
  │  • Every human action logged as training feedback               │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘
```

### 4.2 Outbound Batch Send (AI-Assisted Touchpoints)

#### 4.2.1 Validate Page — Clearance Type from Master Data + Human Research + AI Calling

**Approach:** Instead of AI predicting clearance type from email content in real-time (unreliable), we use a **master data table** uploaded from Excel to Supabase. The master data maps company name to their historical clearance type (NFBRK or FEBRK). 90% of repeat customers already have their type on record — no need to ask or predict.

```
  ┌────────────────────────────────────────────────────────────────┐
  │  VALIDATE PAGE — CLEARANCE TYPE RESOLUTION PIPELINE            │
  ├────────────────────────────────────────────────────────────────┤
  │                                                                │
  │  For each row in the batch:                                     │
  │                                                                │
  │  Step 1: Lookup Master Data                                    │
  │  ───────────────────────                                       │
  │  Query: SELECT clearance_type FROM company_clearance_master    │
  │         WHERE company_name = row.consignee_name                │
  │         ORDER BY last_seen DESC LIMIT 1                        │
  │                                                                │
  │  If found → Auto-fill clearance_type = master_data value      │
  │             Show badge: [NFBRK ✓ From Master Data]             │
  │             No human action needed                             │
  │                                                                │
  │  If NOT found → Show in "Unresolved" panel                    │
  │             Status: "No master data — needs research"          │
  │                                                                │
  │  ────────────────────────────────────────────────────────────  │
  │                                                                │
  │  Step 2: Human Research (for unresolved rows)                  │
  │  ──────────────────────────────────────────                    │
  │  Operator opens Outlook, searches each AWB one by one          │
  │  to find previous NFBRK/FEBRK email history.                   │
  │                                                                │
  │  • If found → Operator updates clearance_type in the row      │
  │    → System saves to master data for future lookups           │
  │                                                                │
  │  • If NOT found after search → Flagged for AI Calling         │
  │    Status: "Needs AI Call — no historical data"                │
  │                                                                │
  │  ────────────────────────────────────────────────────────────  │
  │                                                                │
  │  Step 3: AI Calling (for rows still unresolved)                │
  │  ─────────────────────────────────────                         │
  │  Only rows where human could not find any historical data      │
  │  go to the AI calling system (VAPI / voice AI).                │
  │  AI calls the customer, asks: "For AWB X, will this be        │
  │  NFBRK or FEBRK clearance?"                                    │
  │  Result updates the row + saves to master data.                │
  │                                                                │
  └────────────────────────────────────────────────────────────────┘

  UI (Unresolved Panel):
  ┌────────────────────────────────────────────────────────────────┐
  │  Unresolved — No Master Data Found (12 rows)                  │
  ├────────────────────────────────────────────────────────────────┤
  │  ┌────────┬──────────────┬──────────┬──────────────────────┐  │
  │  │ AWB    │ Consignee     │Status    │ Action               │  │
  │  ├────────┼──────────────┼──────────┼──────────────────────┤  │
  │  │ 123... │ M/s Gupta    │ Research │ [🔍 Search Outlook]  │  │
  │  │ 456... │ ABC Corp     │ Research │ [🔍 Search Outlook]  │  │
  │  │ 789... │ New Client   │ Research │ [🔍 Search Outlook]  │  │
  │  │ 012... │ XYZ Traders  │ Research │ [🔍 Search Outlook]  │  │
  │  └────────┴──────────────┴──────────┴──────────────────────┘  │
  │                                                                │
  │  After human research:                                        │
  │  ┌────────┬──────────────┬──────────┬──────────────────────┐  │
  │  │ 123... │ M/s Gupta    │ ✅ Found │ NFBRK (human set)    │  │
  │  │ 456... │ ABC Corp     │ ✅ Found │ FEBRK (human set)    │  │
  │  │ 789... │ New Client   │ ❌ Not   │ [📞 AI Call]         │  │
  │  │        │              │  Found   │                       │  │
  │  │ 012... │ XYZ Traders  │ ❌ Not   │ [📞 AI Call]         │  │
  │  │        │              │  Found   │                       │  │
  │  └────────┴──────────────┴──────────┴──────────────────────┘  │
  │                                                                │
  │  Data stored: company_clearance_master table                   │
  │  Auto-saves: When human finds + sets type → saves to master   │
  │  AI Calling: Only for rows where human found nothing           │
  └────────────────────────────────────────────────────────────────┘
```

#### 4.2.2 Review Page — AI-Generated Draft Replies per Group

```
  ┌────────────────────────────────────────────────────────────────┐
  │  REVIEW PAGE — AI INTERACTION POINT                            │
  ├────────────────────────────────────────────────────────────────┤
  │                                                                │
  │  What happens:                                                 │
  │  For each clearance_type group, AI generates a contextual      │
  │  draft reply using RAG + LLM, incorporating:                  │
  │    • Current email thread context                              │
  │    • Past similar replies (vector search)                      │
  │    • Best-matching template                                    │
  │    • AWB-specific details (consignee, broker, DO#)             │
  │                                                                │
  │  UI:                                                           │
  │  ┌─────────────────────────────────────────────────┐          │
  │  │ NFBRK Group (8 rows)                           │          │
  │  │ ┌─────────────────────────────────────────┐    │          │
  │  │ │ AI Draft:                               │    │          │
  │  │ │ Subject: Re: NFBRK AWB 123456789012...  │    │          │
  │  │ │ Body: Dear Team,                        │    │          │
  │  │ │        Please find attached the docs... │    │          │
  │  │ │ ┌───┐ ┌───┐ ┌───┐                      │    │          │
  │  │ │ │Edit│ │Approve│ │Reject│               │    │          │
  │  │ │ └───┘ └───┘ └───┘                      │    │          │
  │  │ │ Confidence: 91% | Flags: none           │    │          │
  │  │ └─────────────────────────────────────────┘    │          │
  │  └─────────────────────────────────────────────────┘          │
  │                                                                │
  │  Data stored: ai_drafts (per group)                           │
  │  Human gate: Operator MUST click Approve to queue for send   │
  │                                                                │
  └────────────────────────────────────────────────────────────────┘
```

#### 4.2.3 Send / Preview Page — AI Pre-Flight Checks

```
  ┌────────────────────────────────────────────────────────────────┐
  │  SEND/PREVIEW PAGE — AI INTERACTION POINT                      │
  ├────────────────────────────────────────────────────────────────┤
  │                                                                │
  │  What happens:                                                 │
  │  Before send, AI performs pre-flight checks:                   │
  │    • Missing attachments check                                 │
  │    • Duplicate AWB detection across recent batches             │
  │    • Template match score (does the draft match the type?)    │
  │    • Recipient email validity (already done in validation)     │
  │                                                                │
  │  UI:                                                           │
  │  ┌─────────────────────────────────────────────────┐          │
  │  │ ⚠ AI Pre-Flight Warnings:                      │          │
  │  │ • 2 rows have missing attachments               │          │
  │  │ • 1 AWB was sent in uBond batch yesterday      │          │
  │  │ • Template match: 94% (all good)                │          │
  │  │ ┌─────────────┐                                  │          │
  │  │ │ Proceed Anyway│ │ Dismiss │                    │          │
  │  │ └─────────────┘                                  │          │
  │  └─────────────────────────────────────────────────┘          │
  │                                                                │
  │  Human gate: Warnings are advisory — operator decides          │
  │                                                                │
  └────────────────────────────────────────────────────────────────┘
```

#### 4.2.4 Post-Send — AI Follow-Up Scheduler

```
  ┌────────────────────────────────────────────────────────────────┐
  │  POST-SEND — AI INTERACTION POINT                              │
  ├────────────────────────────────────────────────────────────────┤
  │                                                                │
  │  What happens:                                                 │
  │  After batch is sent, AI schedules follow-up emails based on   │
  │  clearance_type + SLA rules. Follow-ups are AI-authored but    │
  │  held in a "Follow-up Drafts" queue for human approval.        │
  │                                                                │
  │  Rules:                                                        │
  │  ┌────────────────────┬──────────────┬──────────────────────┐ │
  │  │ Clearance Type     │ Delay        │ Follow-Up Content    │ │
  │  ├────────────────────┼──────────────┼──────────────────────┤ │
  │  │ NFBRK              │ 24 hours     │ "Gentle reminder —   │ │
  │  │                    │              │  docs pending..."    │ │
  │  ├────────────────────┼──────────────┼──────────────────────┤ │
  │  │ FEBRK (Sunimpex)  │ 48 hours     │ "Broker confirmation │ │
  │  │                    │              │  needed..."          │ │
  │  ├────────────────────┼──────────────┼──────────────────────┤ │
  │  │ FEBRK (Jeena)     │ 48 hours     │ "Broker confirmation │ │
  │  │                    │              │  needed..."          │ │
  │  ├────────────────────┼──────────────┼──────────────────────┤ │
  │  │ Calling            │ 4 hours      │ "Callback follow-up  │ │
  │  │                    │              │  for AWB..."         │ │
  │  ├────────────────────┼──────────────┼──────────────────────┤ │
  │  │ Hold               │ Every 24h    │ "Status check — AWB  │ │
  │  │                    │ (daily)      │  still on hold..."   │ │
  │  └────────────────────┴──────────────┴──────────────────────┘ │
  │                                                                │
  │  UI: Follow-up queue page with approve/reject/edit/send       │
  │  Human gate: EVERY follow-up requires human approval to send  │
  │                                                                │
  └────────────────────────────────────────────────────────────────┘
```

### 4.3 Case Management (My Cases / Human Review / Cases Page)

#### 4.3.1 Auto-Prioritization

```
  ┌────────────────────────────────────────────────────────────────┐
  │  CASE PRIORITIZATION — AI INTERACTION POINT                    │
  ├────────────────────────────────────────────────────────────────┤
  │                                                                │
  │  AI re-orders the case list based on:                         │
  │    • Urgency (critical → high → normal → low)                  │
  │    • SLA deadline proximity (due within 2h → top)              │
  │    • Customer tier (VIP → top)                                │
  │    • Time since last action                                    │
  │    • Number of re-opens (sticky cases → top)                   │
  │                                                                │
  │  UI:                                                           │
  │  Each case gets a priority badge: [P1-Critical] [P2-High]     │
  │  Sort order: Priority (desc), then SLA remaining (asc)        │
  │                                                                │
  └────────────────────────────────────────────────────────────────┘
```

#### 4.3.2 Smart Assignment (Multi-Operator)

```
  ┌────────────────────────────────────────────────────────────────┐
  │  SMART ASSIGNMENT — AI INTERACTION POINT                       │
  ├────────────────────────────────────────────────────────────────┤
  │                                                                │
  │  When multiple operators are on duty, AI assigns cases by:    │
  │    • Operator skill match (experienced with this clearance)   │
  │    • Current workload (fewest open cases gets next)            │
  │    • Recent activity (who handled similar case last)           │
  │    • Timezone / shift overlap                                  │
  │                                                                │
  │  UI: Auto-assigned cases appear in operator's "My Cases"       │
  │  Operator can manually reassign (logged as override)           │
  │                                                                │
  └────────────────────────────────────────────────────────────────┘
```

#### 4.3.3 Reply Assist (Smart Compose)

```
  ┌────────────────────────────────────────────────────────────────┐
  │  REPLY ASSIST — AI INTERACTION POINT                           │
  ├────────────────────────────────────────────────────────────────┤
  │                                                                │
  │  When operator opens a case to reply, AI suggests:             │
  │    • Smart Compose: AI-written reply draft (like Gmail Smart  │
  │      Compose but trained on FedEx pre-alert emails)            │
  │    • Knowledge retrieval: "Here's what was replied last time  │
  │      for this AWB / similar situation"                         │
  │    • Quick actions: "Mark as closed", "Create follow-up",     │
  │      "Escalate to supervisor"                                  │
  │                                                                │
  │  UI: Draft appears in reply editor — operator edits and sends │
  │  Human gate: Operator MUST explicitly click Send              │
  │                                                                │
  └────────────────────────────────────────────────────────────────┘
```

#### 4.3.4 Follow-Up Generation (Timer-Based)

```
  ┌────────────────────────────────────────────────────────────────┐
  │  FOLLOW-UP GENERATION — AI INTERACTION POINT                   │
  ├────────────────────────────────────────────────────────────────┤
  │                                                                │
  │  Conditions:                                                   │
  │  ┌────────────────────┬──────────────────────────────────────┐ │
  │  │ Condition            │ AI Action                          │ │
  │  ├────────────────────┼──────────────────────────────────────┤ │
  │  │ NFBRK sent, no      │ Draft a gentle reminder to          │ │
  │  │ reply in 24h         │ consignee/broker                   │ │
  │  ├────────────────────┼──────────────────────────────────────┤ │
  │  │ FEBRK sent, broker  │ Draft escalation to broker          │ │
  │  │ not confirmed in 48h │ with CC to ops team                │ │
  │  ├────────────────────┼──────────────────────────────────────┤ │
  │  │ Callback requested, │ Draft callback reminder to          │ │
  │  │ no log in 4h        │ operator: "Please call XYZ"         │ │
  │  ├────────────────────┼──────────────────────────────────────┤ │
  │  │ Case on hold >24h   │ Draft status check: "Should we     │ │
  │  │                     │ close or escalate this hold?"       │ │
  │  ├────────────────────┼──────────────────────────────────────┤ │
  │  │ Thread inactive     │ Draft check-in: "Any update on     │ │
  │  │ >7 days (any type)  │ AWB 123456789012?"                  │ │
  │  └────────────────────┴──────────────────────────────────────┘ │
  │                                                                │
  │  All drafts go to the "Follow-Up Drafts" queue.               │
  │  Human gate: Operator reviews → edits → sends.                │
  │  NEVER auto-sent.                                              │
  │                                                                │
  └────────────────────────────────────────────────────────────────┘
```

### 4.4 Call Logging AI Integration

```
  ┌────────────────────────────────────────────────────────────────┐
  │  CALL LOGGING — AI INTERACTION POINT                           │
  ├────────────────────────────────────────────────────────────────┤
  │                                                                │
  │  1. Call Summarization:                                        │
  │     • Operator records call notes in text field                │
  │     • AI auto-suggests structured summary:                     │
  │       - Who called? (extract from text)                        │
  │       - What was discussed? (key points)                       │
  │       - What actions were promised? (commitments)              │
  │       - Follow-up needed? (yes/no + type)                      │
  │     • Operator can accept or edit the summary                  │
  │                                                                │
  │  2. Action Extraction:                                         │
  │     • AI scans call notes for action items                     │
  │     • "Need to send invoice by EOD" → auto-create task         │
  │     • "Customer will call back" → schedule callback reminder   │
  │     • "Escalate to manager" → flag for supervisor              │
  │                                                                │
  │  3. Thread Linking:                                            │
  │     • AI suggests linking call to existing email thread(s)     │
  │     • Based on AWB, consignee name, DO#, broker name           │
  │     • Operator confirms or rejects the link                    │
  │                                                                │
  │  Data stored: case_updates with actor_type = 'ai'             │
  │  Human gate: Every AI suggestion is a proposal, never a fact  │
  │                                                                │
  └────────────────────────────────────────────────────────────────┘
```

***

## 5. Decision Matrix: AI vs Human Review

This is the core routing logic that determines what the AI can do autonomously vs what must go to a human.

### 5.1 Routing Decision Table

**Critical Rule: Auto-send conditions are DETERMINED BY DATA, not assumed.** We analyze the Excel data from VBA extraction to find patterns that are 100% safe to auto-send. Starting conservative, expanding as data proves safety.

#### Auto-Send Eligibility (from Data Analysis)

Before any AI\_AUTO\_SEND route is enabled, the pattern must meet these data-derived criteria:

| Criterion                | How Determined                                                             | Entry Condition                      |
| ------------------------ | -------------------------------------------------------------------------- | ------------------------------------ |
| **Pattern is routine**   | Analyze Excel: same email intent always receives same reply                | Zero variance in historical replies  |
| **Historical accuracy**  | Analyze Excel: rule-based classification was correct for this pattern      | ≥ 99% accuracy in training data      |
| **No compliance issues** | Review historical logs: no escalations or complaints for this pattern      | Zero incidents                       |
| **Confidence threshold** | Compute from data: minimum confidence that yields 100% correct predictions | ≥ 0.97 (or data-determined value)    |
| **Low business impact**  | If wrong reply can occur, customer impact is minimal                       | Informational / routine queries only |

#### Routing Decision Table

| Condition Set                                                                                                                        | Route               | Human Gate               | Rationale                                      |
| ------------------------------------------------------------------------------------------------------------------------------------ | ------------------- | ------------------------ | ---------------------------------------------- |
| `issueType ∈ {out_of_office, bounce}` (any confidence)                                                                               | **IGNORE**          | ❌ Auto-ignore            | System messages, no action needed              |
| `issueType = info_only` (any confidence)                                                                                             | **IGNORE**          | ❌ Auto-ignore            | Informational only, no action needed           |
| Pattern meets ALL auto-send eligibility criteria AND confidence ≥ data-determined threshold AND NOT urgent AND NOT VIP AND NOT legal | **AI\_AUTO\_SEND**  | ❌ Auto-send + auto-close | Data-proven safe pattern, zero human needed    |
| Pattern partially meets criteria OR confidence below auto-send threshold but ≥ draft threshold                                       | **AI\_DRAFT\_HOLD** | ✅ **Must approve**       | Known pattern but needs human confirmation     |
| Confidence < draft threshold (any operational type)                                                                                  | **HUMAN\_REVIEW**   | ✅ **Mandatory**          | Low confidence = too risky for AI              |
| `issueType = escalation` (any confidence)                                                                                            | **HUMAN\_REVIEW**   | ✅ **Mandatory**          | Escalations need human judgment                |
| `issueType = special_case` (any confidence)                                                                                          | **HUMAN\_REVIEW**   | ✅ **Mandatory**          | Non-standard handling required                 |
| `issueType = reminder_needed` (any confidence)                                                                                       | **HUMAN\_REVIEW**   | ✅ **Mandatory**          | Context-dependent, risk of wrong reply         |
| `urgency = urgent` (any confidence, any issue type)                                                                                  | **HUMAN\_REVIEW**   | ✅ **Mandatory**          | FedEx SLA: urgent = human eyes required        |
| Sender is VIP customer (configurable list)                                                                                           | **HUMAN\_REVIEW**   | ✅ **Mandatory**          | Relationship management, white-glove treatment |
| Body contains legal/compliance keywords                                                                                              | **HUMAN\_REVIEW**   | ✅ **Mandatory**          | Legal risk, compliance obligation              |
| `issueType = unclear` (fallback — no rule matched)                                                                                   | **HUMAN\_REVIEW**   | ✅ **Mandatory**          | AI doesn't know what to do                     |

#### Data Analysis Process to Determine Auto-Send Conditions

```
  1. Export all historical emails via VBA script
  2. For each email, record:
     - Issue type (rule-based classification)
     - What reply was actually sent (from Sent Items)
     - Was the reply correct? (human-labeled)
     - Was there any escalation or complaint?
     - Sender domain, urgency signals
  3. Group by issue type + sender pattern + urgency
  4. For each group, compute:
     - Variance in reply content (is the reply always the same?)
     - Error rate (was any reply wrong or caused issues?)
     - Sample size (how many examples do we have?)
  5. Auto-send eligible groups = those with:
     - Zero variance in reply (always same response)
     - Zero error rate in historical data
     - Sample size ≥ 30 (statistically meaningful)
     - Low business impact if wrong
  6. Threshold = lowest confidence in eligible group
  7. Review period: every new pattern starts in AI_DRAFT_HOLD
     until enough data proves safety for AI_AUTO_SEND
```

### 5.2 Confidence Calibration

Confidence scores are NOT hard-coded (unlike the current system). They are computed by the ensemble classifier:

```
Final Confidence = max(
    rule_confidence × 0.3,          # Rule-based component
    ml_confidence × 0.4,            # ML classifier component
    llm_confidence × 0.3            # LLM verification component
) + keyword_boost (0.05 per extra keyword match, max +0.10)
```

Calibrated using temperature scaling on a held-out validation set.

### 5.3 Urgency Detection

| Urgency Level | Detection Method                                                                                           | Action                                                       |
| ------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **critical**  | Keywords: "ASAP", "urgent", "emergency", "critical", "deadline passed", "FedEx escalation" + LLM sentiment | Routes to HUMAN\_REVIEW regardless of confidence             |
| **high**      | Keywords: "today", "EOD", "important", "immediately" + sender domain pattern + LLM sentiment               | Routes to HUMAN\_REVIEW if confidence < 0.95                 |
| **normal**    | Default — no urgency signals detected                                                                      | Follows standard routing table                               |
| **low**       | Keywords: "no rush", "whenever", "FYI", "for your reference"                                               | May route to AI\_DRAFT\_HOLD with lower confidence threshold |

### 5.4 VIP Customer Detection

```
VIP Detection:
  ┌────────────────────────────────────────────┐
  │  Source: app_config table (key: vip_domains) │
  │  Check: sender email domain ∈ vip_domains   │
  │  Also: sender email ∈ vip_senders (exact)   │
  │                                              │
  │  When matched:                               │
  │    • ALL AI actions downgraded to draft_hold │
  │    • Priority boost: +2 levels               │
  │    • Notification sent to senior operator    │
  └────────────────────────────────────────────┘
```

### 5.5 Legal/Compliance Blocklist

```
  ┌────────────────────────────────────────────┐
  │  Keywords that trigger HUMAN_REVIEW:        │
  │  ─────────────────────────                 │
  │  • "attorney" / "lawyer" / "legal"          │
  │  • "lawsuit" / "claim" / "damages"          │
  │  • "compliance" / "regulatory"              │
  │  • "FedEx policy violation"                 │
  │  • "customs penalty" / "fine"               │
  │  • "data privacy" / "GDPR" / "confidential" │
  │  • "SOC" / "audit" / "investigation"        │
  │                                              │
  │  Source: app_config table (key: legal_keywords)│
  │  Check: case-insensitive regex on body       │
  └────────────────────────────────────────────┘
```

***

## 6. AI Model Architecture

### 6.1 Ensemble Classifier Pipeline

```
  Input: subject + body + sender + thread_history + attachments_info
         │
         ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  STAGE 1: FAST PATH (Rule-Based — 0 external calls)            │
  ├─────────────────────────────────────────────────────────────────┤
  │  Same 13-rule system from ingest-email.ts                     │
  │  Runs first for OOO, bounce, clear keyword matches             │
  │  Output: { clearance_type_rule, intent_rule, urgency_rule,     │
  │            rule_confidence, rule_matched }                      │
  │                                                                 │
  │  If rule_confidence ≥ 0.95 AND skip_ml = false → proceed      │
  │  If rule matched clearance_type explicitly (NFBRK keyword) →   │
  │     use as override for ML output                              │
  └─────────────────────────────────────────────────────────────────┘
         │
         ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  STAGE 2: EMBEDDING CLASSIFIER (Logistic Regression — Cheap)   │
  ├─────────────────────────────────────────────────────────────────┤
  │  Model: text-embedding-3-small → 1536-dim vector               │
  │  Classifier: LogisticRegression (one-vs-rest)                  │
  │                                                                 │
  │  Input: subject + body (truncated to 8000 chars)               │
  │  Output:                                                        │
  │    • clearance_type: {nfbrk, febrk, febrk-sunimpex,            │
  │       febrk-jeena, calling, hold} with probabilities           │
  │    • intent: {inquiry, update, escalation, confirmation,       │
  │       docs_request, other} with probabilities                  │
  │    • ml_confidence: max probability from softmax               │
  │                                                                 │
  │  Expected accuracy: clearance_type ~95%, intent ~85%           │
  └─────────────────────────────────────────────────────────────────┘
         │
         ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  STAGE 3: LLM VERIFIER (GPT-4o-mini — Richer Analysis)        │
  ├─────────────────────────────────────────────────────────────────┤
  │  Prompt:                                                        │
  │    System: You are a FedEx pre-alert email classifier.         │
  │    Analyze the email and return structured JSON.               │
  │                                                                 │
  │    User: [email subject + body + sender + thread context]       │
  │                                                                 │
  │  Output (structured JSON):                                      │
  │    {                                                            │
  │      "clearance_type": "nfbrk",                                │
  │      "intent": "update",                                       │
  │      "urgency": "normal",                                      │
  │      "entities": { "awb": "123456789012", "do_number": null }, │
  │      "confidence": 0.92,                                       │
  │      "reasoning": "Email mentions NFBRK docs submission",      │
  │      "flags": ["needs_attachment_check"]                       │
  │    }                                                            │
  │                                                                 │
  │  Model: gpt-4o-mini (cost-efficient ~$0.15/1M input tokens)   │
  │  Fallback: If API unavailable, skip stage 3, use stages 1-2    │
  └─────────────────────────────────────────────────────────────────┘
         │
         ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  STAGE 4: ENSEMBLE FUSION (Combine All Models)                 │
  ├─────────────────────────────────────────────────────────────────┤
  │                                                                 │
  │  final_clearance_type =                                         │
  │    rule_override ?? ml_prediction ?? llm_prediction            │
  │                                                                 │
  │  final_confidence =                                             │
  │    max(rule_conf × 0.3, ml_conf × 0.4, llm_conf × 0.3)        │
  │    + keyword_boost (max +0.10)                                 │
  │    capped at 0.99                                              │
  │                                                                 │
  │  final_intent =                                                 │
  │    ml_intent if ml_conf > 0.7 else llm_intent                   │
  │                                                                 │
  │  final_urgency =                                                │
  │    llm_urgency (more nuanced) if llm available                  │
  │    else rule_urgency                                            │
  │                                                                 │
  │  route = routing_table_lookup(                                  │
  │    clearance_type, intent, urgency, confidence,                 │
  │    is_vip, has_legal_keywords                                   │
  │  )                                                              │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘
         │
         ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  STAGE 5: AUDIT LOGGING                                        │
  ├─────────────────────────────────────────────────────────────────┤
  │  Log to ai_classifications table:                              │
  │    • All model outputs (rule, ml, llm)                         │
  │    • Final decision + route                                    │
  │    • Latency per stage                                         │
  │    • Model versions used                                       │
  └─────────────────────────────────────────────────────────────────┘
```

### 6.2 Model Training & Retraining

#### 6.2.1 Training Data Source

```
  Source: VBA-extracted emails → cleaning pipeline → labeled dataset
          ↓
  Current rule-based classifications → baseline labels
          ↓
  LLM-assisted labeling → expanded labels for intent, urgency
          ↓
  Human corrections → gold-standard labels (highest quality)
```

#### 6.2.2 Label Taxonomy

| Label Field      | Classes                                                         | Source                     | Target Accuracy |
| ---------------- | --------------------------------------------------------------- | -------------------------- | --------------- |
| `clearance_type` | nfbrk, febrk, febrk-sunimpex, febrk-jeena, calling, hold        | Rule-based (existing) + ML | 99%             |
| `intent`         | inquiry, update, escalation, confirmation, docs\_request, other | LLM + human review         | 95%             |
| `urgency`        | low, normal, high, critical                                     | LLM + human review         | 90%             |
| `response_type`  | acknowledge, provide\_info, request\_docs, escalate, no\_action | LLM + human review         | 90%             |

#### 6.2.3 Retraining Cadence

| Trigger                             | Action                                       | Automated?       |
| ----------------------------------- | -------------------------------------------- | ---------------- |
| 100 new human corrections collected | Retrain ML classifier                        | ✅ Auto-triggered |
| Weekly (Sunday 02:00)               | Full pipeline: re-embed + retrain + evaluate | ✅ Cron job       |
| Classifier accuracy drops below 90% | Alert ops + trigger retrain                  | ✅ Monitoring     |
| Manual trigger (admin)              | Immediate retrain                            | ✅ Admin endpoint |

### 6.3 Model Versioning & Rollback

```
  ┌────────────────────────────────────────────────────────────────┐
  │  MODEL VERSIONING                                              │
  ├────────────────────────────────────────────────────────────────┤
  │                                                                │
  │  Every prediction stores: classifier_version = "v1.2.3"       │
  │                                                                │
  │  Version format: major.minor.patch                            │
  │    • major: Architecture change (e.g., new model type)        │
  │    • minor: New training data batch                           │
  │    • patch: Hyperparameter tuning, bug fix                    │
  │                                                                │
  │  Storage: models/ directory with symlink "current → v1.2.3"   │
  │                                                                │
  │  Rollback:                                                     │
  │    Previous 3 versions kept                                    │
  │    API env var: CLASSIFIER_VERSION=v1.2.2 (pin to rollback)   │
  │    Supabase inference_log allows comparing v1.2 vs v1.3       │
  │                                                                │
  └────────────────────────────────────────────────────────────────┘
```

***

## 7. RAG Retriever

### 7.1 Purpose

When generating a draft reply, the AI needs context — similar past emails and the best-matching templates. The RAG (Retrieval-Augmented Generation) system provides this context.

### 7.2 Retrieval Pipeline

```
  Query: new email subject + body + clearance_type + intent
         │
         ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  VECTOR SEARCH (Supabase pgvector)                             │
  ├─────────────────────────────────────────────────────────────────┤
  │                                                                 │
  │  Step 1: Generate query embedding                               │
  │  ─────────────────────────────                                  │
  │  embed_text(subject + " " + body) → 1536-dim vector            │
  │  Model: text-embedding-3-small                                 │
  │                                                                 │
  │  Step 2: Search similar emails                                  │
  │  ────────────────────────────                                   │
  │  SELECT * FROM match_similar_emails(                           │
  │    query_embedding,                                             │
  │    match_threshold = 0.75,                                      │
  │    match_count = 5,                                             │
  │    filter_clearance_type = query.clearance_type,               │
  │    filter_intent = query.intent                                │
  │  )                                                              │
  │                                                                 │
  │  Returns: top 5 historical emails with same clearance_type     │
  │           and intent, ordered by cosine similarity              │
  │                                                                 │
  │  Step 3: Search templates                                       │
  │  ───────────────────────                                        │
  │  SELECT * FROM templates                                       │
  │  WHERE clearance_type = query.clearance_type                   │
  │    AND intent = query.intent                                   │
  │    AND active = true                                           │
  │  ORDER BY version DESC                                         │
  │  LIMIT 1                                                        │
  │                                                                 │
  │  Returns: best-matching template (if exists)                    │
  │                                                                 │
  │  Step 4: Build context for LLM                                 │
  │  ─────────────────────────────                                  │
  │  context = {                                                    │
  │    "similar_emails": [ { subject, body_clean, reply_sent },    │
  │                        ... × 5 ],                              │
  │    "best_template": { subject_template, body_template,        │
  │                       variables },                             │
  │    "current_case": { awb, consignee, broker, do_number,       │
  │                      clearance_type, intent, urgency }         │
  │  }                                                              │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘
```

### 7.3 Similarity Search Configuration

| Parameter       | Value        | Rationale                                      |
| --------------- | ------------ | ---------------------------------------------- |
| Index type      | IVFFlat      | Good balance of speed vs recall for 1536d      |
| Lists           | 100          | Default for up to 1M vectors                   |
| Distance metric | Cosine       | Best for text embedding similarity             |
| Match threshold | 0.75         | Minimum similarity to consider relevant        |
| Match count     | 5            | Enough context without flooding the LLM prompt |
| Time filter     | Last 90 days | Older emails may use outdated processes        |

### 7.4 Template Library Structure

| Field             | Type         | Example                                                                                          |
| ----------------- | ------------ | ------------------------------------------------------------------------------------------------ |
| clearance\_type   | TEXT         | "nfbrk"                                                                                          |
| intent            | TEXT         | "update"                                                                                         |
| subject\_template | TEXT         | "Re: NFBRK AWB {awb} — {action}"                                                                 |
| body\_template    | TEXT         | "Dear {sender},\n\nThank you for the documents for AWB {awb}.\n\nBest regards,\nOperations Team" |
| variables         | JSONB        | \["awb", "sender", "action", "consignee\_name"]                                                  |
| version           | INT          | 3                                                                                                |
| embedding         | VECTOR(1536) | Pre-computed for similarity matching                                                             |

***

## 8. Response Generator

### 8.1 Purpose

Generate a professional, context-aware draft reply email that the operator can review, edit, and send.

### 8.2 Generation Pipeline

```
  Input: classified email + RAG context + case data
         │
         ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  DRAFT GENERATOR (LLM — GPT-4o-mini)                           │
  ├─────────────────────────────────────────────────────────────────┤
  │                                                                 │
  │  System Prompt:                                                 │
  │    You are a FedEx cargo pre-alert operations specialist.      │
  │    Write a professional, concise reply email.                  │
  │                                                                 │
  │    Rules:                                                       │
  │    1. Use the retrieved context for tone and factual info      │
  │    2. NEVER invent AWB details, dates, or commitments          │
  │    3. If uncertain, flag for human review                      │
  │    4. Keep replies brief and actionable                        │
  │    5. Use professional but warm tone                           │
  │    6. Include all relevant details (AWB, DO#, etc.)            │
  │    7. Do NOT include pricing unless specifically asked         │
  │    8. Do NOT promise delivery times — refer to tracking        │
  │                                                                 │
  │  Context:                                                       │
  │    - Original email: {subject} {body}                          │
  │    - Classification: {clearance_type} / {intent} / {urgency}   │
  │    - Similar email #1: {subject} {body} {actual_reply}        │
  │    - Similar email #2: {subject} {body} {actual_reply}        │
  │    - Similar email #3: {subject} {body} {actual_reply}        │
  │    - Best template: {subject_template} {body_template}         │
  │    - Case details: AWB={awb}, Consignee={name},                │
  │      Broker={broker}, DO#={do_number}                          │
  │                                                                 │
  │  Output (JSON):                                                 │
  │    {                                                            │
  │      "subject": "Re: NFBRK AWB 123456789012 — Docs Attached", │
  │      "body_html": "<p>Dear Team,</p><p>Please find attached... │
  │      "body_text": "Dear Team,\n\nPlease find attached...",     │
  │      "confidence": 0.91,                                       │
  │      "flags": ["missing_attachment_reference",                 │
  │                "needs_dates_confirmation"],                    │
  │      "variables_used": ["awb", "consignee_name", "do_number"], │
  │      "template_id": "uuid-of-matched-template"                 │
  │    }                                                            │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘
         │
         ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  OUTPUT PROCESSING                                              │
  ├─────────────────────────────────────────────────────────────────┤
  │                                                                 │
  │  1. Validate: Check draft contains required fields              │
  │  2. Sanity check: Compare against template for consistency      │
  │  3. Flag low-confidence drafts for extra human attention        │
  │  4. Store in ai_drafts table with status = 'pending'           │
  │  5. Notify operator: "New AI draft ready for review"           │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘
```

### 8.3 Draft Status Lifecycle

```
  pending ──→ approved ──→ sent
     │            │
     ├──→ edited ─┤
     │            │
     └──→ rejected
```

| Status     | Meaning                         | Next Action                       |
| ---------- | ------------------------------- | --------------------------------- |
| `pending`  | AI generated, waiting for human | Operator opens draft              |
| `edited`   | Human modified the draft        | Can approve → sent, or reject     |
| `approved` | Human clicked Approve           | System queues for send            |
| `rejected` | Human rejected AI draft         | Log rejection reason for training |
| `sent`     | Email was dispatched            | Final state — immutable           |

### 8.4 Draft Confidence Flags

| Flag                           | Meaning                                                | UI Treatment                    |
| ------------------------------ | ------------------------------------------------------ | ------------------------------- |
| `missing_attachment_reference` | AI detected attachment was mentioned but not found     | Yellow warning badge            |
| `needs_dates_confirmation`     | Draft contains date references that should be verified | Orange warning badge            |
| `low_confidence_draft`         | Overall confidence < 0.80                              | Red border + "Review Carefully" |
| `missing_variables`            | Template variables could not be resolved               | Yellow warning with list        |
| `legal_sensitivity`            | Email contains legal-adjacent terms                    | Red "Legal Review" badge        |
| `vip_customer`                 | Recipient is VIP                                       | Gold VIP badge                  |

***

## 9. Follow-Up Engine

### 9.1 Purpose

Automatically schedule and author follow-up emails based on clearance type, elapsed time, and case status. All follow-ups are AI-authored but require human approval before sending.

### 9.2 Scheduling Rules

```
  ┌─────────────────────────────────────────────────────────────────┐
  │  FOLLOW-UP RULES ENGINE                                        │
  ├─────────────────────────────────────────────────────────────────┤
  │                                                                 │
  │  Rule 1: NFBRK — Documents Pending                              │
  │  ────────────────────────────────                              │
  │  Trigger: 24 hours after NFBRK pre-alert sent                   │
  │  Condition: No reply received from consignee/broker            │
  │  Action: Draft reminder email                                   │
  │  Content: "Gentle reminder — documents for AWB {awb} are       │
  │            pending. Please share at your earliest."             │
  │  Repeat: Every 48h, max 3 times                                 │
  │                                                                 │
  │  Rule 2: FEBRK — Broker Confirmation                            │
  │  ───────────────────────────────                                │
  │  Trigger: 48 hours after FEBRK pre-alert sent                   │
  │  Condition: Broker not yet confirmed (Sunimpex or Jeena)       │
  │  Action: Draft escalation to broker with CC to ops team        │
  │  Content: "Broker confirmation still pending for AWB {awb}.    │
  │            Requesting immediate update."                        │
  │  Repeat: Every 24h, max 5 times                                 │
  │  Escalate: After 3rd attempt, flag for supervisor              │
  │                                                                 │
  │  Rule 3: Calling — Callback Follow-Up                           │
  │  ────────────────────────────                                   │
  │  Trigger: 4 hours after Calling template sent                   │
  │  Condition: No call logged in the system                        │
  │  Action: Draft reminder to operator                            │
  │  Content: "Callback reminder for AWB {awb} — {consignee}       │
  │            was expecting a call. Please follow up."             │
  │  Repeat: Every 2h, max 3 times                                  │
  │                                                                 │
  │  Rule 4: Hold — Status Check                                    │
  │  ───────────────────────                                        │
  │  Trigger: 24 hours after Hold status set                        │
  │  Condition: Case still on hold, no update                       │
  │  Action: Draft status check to operator                        │
  │  Content: "AWB {awb} has been on hold for 24h+. Reason:        │
  │            {hold_reason}. Should this be escalated or closed?"  │
  │  Repeat: Daily                                                  │
  │                                                                 │
  │  Rule 5: Inactive Thread — Any Type                             │
  │  ───────────────────────────────────                            │
  │  Trigger: 7 days since last email in thread                     │
  │  Condition: Case not closed                                     │
  │  Action: Draft check-in email                                   │
  │  Content: "Checking in on AWB {awb} — any updates from         │
  │            your side? Please advise if further action needed."  │
  │  Repeat: Every 7 days, max 2 times before auto-closure          │
  │                                                                 │
  │  Rule 6: Escalation — Urgent Follow-Up                          │
  │  ──────────────────────────────────                             │
  │  Trigger: 2 hours after escalation flagged                      │
  │  Condition: No human action on escalation                       │
  │  Action: Draft supervisor notification                         │
  │  Content: "Escalation on AWB {awb} has been pending for 2h+.   │
  │            Urgent: {escalation_reason}. Please assign now."     │
  │  Repeat: Every 1h, max 3 times                                  │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘
```

### 9.3 Follow-Up Queue UI

```
  ┌─────────────────────────────────────────────────────────────────┐
  │  FOLLOW-UP DRAFTS QUEUE                                        │
  ├─────────────────────────────────────────────────────────────────┤
  │                                                                 │
  │  ┌─────────────────────────────────────────────────────────┐   │
  │  │  Filter: [All Types ▼]  |  Sort: [Due Date ▼]          │   │
  │  └─────────────────────────────────────────────────────────┘   │
  │                                                                 │
  │  ┌─────────────────────────────────────────────────────────┐   │
  │  │ ⏰ Due: Today 14:00  |  AWB: 123456789012              │   │
  │  │ Type: NFBRK Follow-Up (Attempt 2/3)                     │   │
  │  │ ┌───────────────────────────────────────────────────┐   │   │
  │  │ │ Subject: Re: NFBRK AWB 123456789012 — Reminder    │   │   │
  │  │ │ Body: Dear Team,                                  │   │   │
  │  │ │        This is a gentle reminder regarding the    │   │   │
  │  │ │        documents for AWB 123456789012...          │   │   │
  │  │ │                                                    │   │   │
  │  │ │ [✏ Edit]  [✓ Approve & Send]  [✗ Skip/Dismiss]  │   │   │
  │  │ └───────────────────────────────────────────────────┘   │   │
  │  │ Confidence: 94%  |  Flags: none                        │   │
  │  └─────────────────────────────────────────────────────────┘   │
  │                                                                 │
  │  ┌─────────────────────────────────────────────────────────┐   │
  │  │ ⏰ Due: Today 16:00  |  AWB: 987654321098              │   │
  │  │ Type: FEBRK Escalation (Attempt 1/5)                    │   │
  │  │ ┌───────────────────────────────────────────────────┐   │   │
  │  │ │ Subject: Escalation — Broker Confirmation AWB...  │   │   │
  │  │ │ Body: Dear Team,                                  │   │   │
  │  │ │        The broker confirmation for AWB 987654...  │   │   │
  │  │ │                                                    │   │   │
  │  │ │ [✏ Edit]  [✓ Approve & Send]  [✗ Skip/Dismiss]  │   │   │
  │  │ └───────────────────────────────────────────────────┘   │   │
  │  │ Confidence: 87%  |  Flags: [low_confidence_draft]      │   │
  │  └─────────────────────────────────────────────────────────┘   │
  │                                                                 │
  │  ┌─────────────────────────────────────────────────────────┐   │
  │  │ ⏰ Overdue (2h)  |  AWB: 555555555555                  │   │
  │  │ Type: Calling Callback (Attempt 3/3) ⚠                  │   │
  │  │ ┌───────────────────────────────────────────────────┐   │   │
  │  │ │ ⚠ FINAL ATTEMPT — Supervisor notified             │   │   │
  │  │ │ [✓ Approve & Send]  [✗ Dismiss]                    │   │   │
  │  │ └───────────────────────────────────────────────────┘   │   │
  │  └─────────────────────────────────────────────────────────┘   │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘
```

### 9.4 Follow-Up Lifecycle

```
  scheduled ──→ draft_ready ──→ approved ──→ sent
      │              │              │
      │              ├──→ edited ───┘
      │              │
      │              └──→ cancelled
      │
      └──→ cancelled (by operator or case closed)
```

| Status        | Meaning                                                  |
| ------------- | -------------------------------------------------------- |
| `scheduled`   | Follow-up is queued in the future (not yet drafted)      |
| `draft_ready` | Time has elapsed, AI has generated draft, awaiting human |
| `edited`      | Human modified the AI draft                              |
| `approved`    | Human approved — queued for send                         |
| `sent`        | Email dispatched                                         |
| `cancelled`   | Skipped or case closed before send                       |

***

## 10. Call Logging AI Integration

### 10.1 Purpose

Reduce operator effort when logging calls by auto-generating structured summaries, extracting action items, and linking to relevant email threads.

### 10.2 Call Summarization

```
  ┌─────────────────────────────────────────────────────────────────┐
  │  CALL SUMMARIZATION — AI INTERACTION                            │
  ├────────────────────────────────────────────────────────────────┤
  │                                                                 │
  │  Input: Operator's raw call notes (free text)                   │
  │         "Called Sunimpex. Spoke to Rajesh. He said docs        │
  │          will be sent by tomorrow. Also asked about DO status.  │
  │          Told him DO will be ready by Friday."                  │
  │                                                                 │
  │  AI Processing:                                                 │
  │    • Named entity extraction: Company=Sunimpex, Person=Rajesh  │
  │    • Intent classification: commitment received + query         │
  │    • Action extraction: "send docs by tomorrow" → follow-up    │
  │    • Urgency detection: normal                                 │
  │                                                                 │
  │  Output (suggested structured summary):                         │
  │    ┌─────────────────────────────────────────────────────┐     │
  │    │ Call Summary (AI-suggested — click to accept)       │     │
  │    ├─────────────────────────────────────────────────────┤     │
  │    │ Company: Sunimpex                                   │     │
  │    │ Contact: Rajesh                                     │     │
  │    │ Purpose: Document status follow-up                  │     │
  │    │ Key Points:                                         │     │
  │    │   • Docs will be sent by tomorrow                   │     │
  │    │   • Customer inquired about DO status               │     │
  │    │   • Informed DO ready by Friday                     │     │
  │    │ Follow-Up: Check docs received tomorrow AM          │     │
  │    │ [✓ Accept] [✗ Reject] [Edit]                       │     │
  │    └─────────────────────────────────────────────────────┘     │
  │                                                                 │
  │  Human gate: Operator accepts, rejects, or edits the summary   │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘
```

### 10.3 Action Extraction Rules

```
  ┌─────────────────────────────────────────────────────────────────┐
  │  ACTION EXTRACTION — AI PATTERNS                                │
  ├────────────────────────────────────────────────────────────────┤
  │                                                                 │
  │  Pattern: "will send" / "will share" / "will provide"          │
  │  → Action: "Follow up to confirm {item} received"              │
  │  → Schedule: +24h                                              │
  │                                                                 │
  │  Pattern: "needs" / "required" / "pending from"                │
  │  → Action: "Send reminder to {party} for {item}"              │
  │  → Schedule: +2h                                               │
  │                                                                 │
  │  Pattern: "call back" / "will call" / "call again"             │
  │  → Action: "Schedule callback reminder"                        │
  │  → Schedule: +{extracted time} or +4h default                  │
  │                                                                 │
  │  Pattern: "escalate" / "escalation" / "supervisor"             │
  │  → Action: "Flag for supervisor review"                        │
  │  → Priority: high                                              │
  │                                                                 │
  │  Pattern: "urgent" / "ASAP" / "immediately" / "emergency"     │
  │  → Action: "Mark case as urgent — notify team"                 │
  │  → Priority: critical                                          │
  │                                                                 │
  └────────────────────────────────────────────────────────────────┘
```

### 10.4 Thread Linking

```
  ┌────────────────────────────────────────────────────────────────┐
  │  THREAD LINKING — AI INTERACTION                               │
  ├────────────────────────────────────────────────────────────────┤
  │                                                                 │
  │  When logging a call, AI searches for matching email threads:  │
  │    • By AWB (exact match)                                      │
  │    • By consignee name (fuzzy match)                           │
  │    • By broker name (fuzzy match)                              │
  │    • By DO# (if mentioned)                                     │
  │                                                                 │
  │  UI:                                                            │
  │  ┌─────────────────────────────────────────────────────────┐   │
  │  │ Suggested Link: AWB 123456789012 — NFBRK Thread         │   │
  │  │ (3 emails in conversation, last active 2 days ago)      │   │
  │  │ [✓ Link] [✗ Not this one]  [🔍 Search more]           │   │
  │  └─────────────────────────────────────────────────────────┘   │
  │                                                                 │
  │  Human gate: Operator confirms or rejects the suggested link   │
  │                                                                 │
  └────────────────────────────────────────────────────────────────┘
```

***

## 11. Data Schema Extensions

### 11.1 New Tables

```sql
-- =============================================================================
-- AI CLASSIFICATIONS — Every AI decision, with full audit trail
-- =============================================================================
CREATE TABLE ai_classifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES awb_cases(id) ON DELETE SET NULL,
  email_event_id UUID REFERENCES email_events(id) ON DELETE SET NULL,

  -- Classifier version info
  classifier_version TEXT NOT NULL,              -- "v1.2.3"
  model_used TEXT NOT NULL,                      -- "ensemble-v1", "rules-v1"

  -- Classification outputs
  clearance_type TEXT,                           -- nfbrk, febrk, febrk-sunimpex, febrk-jeena, calling, hold
  intent TEXT,                                   -- inquiry, update, escalation, confirmation, docs_request, other
  urgency TEXT,                                  -- low, normal, high, critical
  response_type TEXT,                            -- acknowledge, provide_info, request_docs, escalate, no_action
  confidence REAL NOT NULL,                      -- 0.0–1.0 (final ensemble confidence)

  -- Routing decision
  route TEXT NOT NULL,                           -- ignore, ai_auto_send, ai_draft_hold, human_review
  human_review_required BOOLEAN NOT NULL DEFAULT true,

  -- Model outputs (for debugging + improvement)
  rule_matches JSONB,                            -- [{rule_name, confidence}, ...]
  ml_prediction JSONB,                           -- {clearance_type, intent, confidence, probabilities}
  llm_raw_output JSONB,                          -- Full LLM response
  ensemble_details JSONB,                        -- How final confidence was computed

  -- Metadata
  explanation TEXT,                              -- Human-readable reason for decision
  latency_ms INT,                                -- Total classification time
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_ai_classifications_case ON ai_classifications(case_id);
CREATE INDEX idx_ai_classifications_route ON ai_classifications(route);
CREATE INDEX idx_ai_classifications_confidence ON ai_classifications(confidence);
CREATE INDEX idx_ai_classifications_created ON ai_classifications(created_at);
CREATE INDEX idx_ai_classifications_version ON ai_classifications(classifier_version);


-- =============================================================================
-- AI DRAFTS — Every AI-generated draft (sent or not), full history
-- =============================================================================
CREATE TABLE ai_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES awb_cases(id) ON DELETE SET NULL,
  email_event_id UUID REFERENCES email_events(id) ON DELETE SET NULL,
  batch_id UUID REFERENCES batch_runs(id) ON DELETE SET NULL,

  -- Trigger details
  trigger_type TEXT NOT NULL,                    -- inbound_reply, followup_scheduled, batch_review, call_summary
  trigger_reason TEXT,                           -- "nfbrk_24h_followup", "human_review_assist"

  -- Draft content
  subject TEXT NOT NULL,
  body_html TEXT NOT NULL,
  body_text TEXT NOT NULL,
  variables_used JSONB,                          -- ["awb", "consignee_name", "do_number"]

  -- Quality
  confidence REAL NOT NULL,
  flags TEXT[],                                  -- ["missing_attachment", "low_confidence", etc.]
  template_id UUID REFERENCES templates(id) ON DELETE SET NULL,

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'pending',        -- pending, approved, edited, rejected, sent
  reviewed_by UUID REFERENCES app_users(id),
  reviewed_at TIMESTAMPTZ,
  edited_subject TEXT,
  edited_body TEXT,
  rejection_reason TEXT,
  sent_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_ai_drafts_status ON ai_drafts(status);
CREATE INDEX idx_ai_drafts_case ON ai_drafts(case_id);
CREATE INDEX idx_ai_drafts_trigger ON ai_drafts(trigger_type);
CREATE INDEX idx_ai_drafts_created ON ai_drafts(created_at);


-- =============================================================================
-- FOLLOW-UP SCHEDULES — AI-proposed follow-ups, human-managed
-- =============================================================================
CREATE TABLE followup_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id UUID REFERENCES awb_cases(id) ON DELETE SET NULL,
  awb TEXT NOT NULL,

  -- Schedule details
  clearance_type TEXT NOT NULL,
  trigger_rule TEXT NOT NULL,                    -- 'nfbrk_24h', 'febrk_48h', 'calling_4h', 'hold_daily', 'inactive_7d', 'escalation_2h'
  scheduled_at TIMESTAMPTZ NOT NULL,
  attempt_number INT DEFAULT 1,                  -- Which attempt (1/3, 2/3, 3/3)
  max_attempts INT DEFAULT 3,

  -- Linking
  draft_id UUID REFERENCES ai_drafts(id) ON DELETE SET NULL,

  -- Lifecycle
  status TEXT NOT NULL DEFAULT 'scheduled',      -- scheduled, draft_ready, approved, sent, cancelled, completed
  assigned_to UUID REFERENCES app_users(id),
  completed_at TIMESTAMPTZ,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_followup_schedules_status ON followup_schedules(status);
CREATE INDEX idx_followup_schedules_due ON followup_schedules(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX idx_followup_schedules_case ON followup_schedules(case_id);
CREATE INDEX idx_followup_schedules_awb ON followup_schedules(awb);


-- =============================================================================
-- TRAINING EXAMPLES — Human corrections used for model retraining
-- =============================================================================
CREATE TABLE training_examples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_event_id UUID REFERENCES email_events(id) ON DELETE SET NULL,
  case_id UUID REFERENCES awb_cases(id) ON DELETE SET NULL,

  -- What was corrected
  field_name TEXT NOT NULL,                      -- 'clearance_type', 'intent', 'urgency', 'response_type'
  predicted_value TEXT,
  corrected_value TEXT NOT NULL,

  -- Context
  corrected_by UUID REFERENCES app_users(id) NOT NULL,
  confidence_at_prediction REAL,
  classifier_version TEXT,
  source_context TEXT,                           -- 'human_review_queue', 'draft_rejection', 'call_log_override'

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX idx_training_examples_field ON training_examples(field_name);
CREATE INDEX idx_training_examples_created ON training_examples(created_at);
CREATE INDEX idx_training_examples_version ON training_examples(classifier_version);


-- =============================================================================
-- APP CONFIG — Runtime configuration for AI system
-- =============================================================================
CREATE TABLE app_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES app_users(id),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed data
INSERT INTO app_config (key, value, description) VALUES
  ('vip_domains', '["company.com", "client.org"]', 'Email domains that trigger VIP treatment'),
  ('vip_senders', '["ceo@company.com"]', 'Exact email addresses that trigger VIP treatment'),
  ('legal_keywords', '["attorney", "lawsuit", "compliance", "legal notice"]', 'Keywords that trigger mandatory human review'),
  ('ai_enabled', 'true', 'Master kill-switch for all AI features'),
  ('classifier_version', '"v1.0.0"', 'Active classifier model version'),
  ('draft_hold_min_threshold', '0.80', 'Minimum confidence for AI_DRAFT_HOLD route'),
  ('draft_hold_max_threshold', '0.99', 'Maximum confidence (all drafts still need approval)'),
  ('followup_enabled', 'true', 'Enable follow-up scheduler'),
  ('call_ai_enabled', 'true', 'Enable call logging AI features'),
  ('checklist_enabled', 'true', 'Enable checklist tracking'),
  ('checklist_nfbrk', '["boe_copy", "invoice", "packing_list", "awb_copy", "do_copy", "shipping_bill"]', 'Required documents for NFBRK clearance'),
  ('checklist_febrk', '["boe_copy", "invoice", "packing_list", "awb_copy", "broker_confirmation", "broker_letter"]', 'Required documents for FEBRK clearance');


-- =============================================================================
-- COMPANY CLEARANCE MASTER — Historical clearance type by company name
-- Uploaded from Excel. Used on Validate page to auto-fill clearance type.
-- =============================================================================
CREATE TABLE company_clearance_master (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name TEXT NOT NULL,                       -- Consignee name (normalized)
  clearance_type TEXT NOT NULL,                     -- nfbrk, febrk, febrk-sunimpex, febrk-jeena
  confidence REAL DEFAULT 1.0,                      -- How confident in this mapping
  source TEXT NOT NULL DEFAULT 'excel_upload',      -- excel_upload, human_research, ai_call, batch_auto
  last_seen_at TIMESTAMPTZ DEFAULT now(),           -- When this company was last handled
  times_seen INT DEFAULT 1,                         -- How many times this company has been processed
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_name, clearance_type)
);

-- Indexes
CREATE INDEX idx_company_clearance_name ON company_clearance_master(company_name);
CREATE INDEX idx_company_clearance_type ON company_clearance_master(clearance_type);
CREATE INDEX idx_company_clearance_last_seen ON company_clearance_master(last_seen_at);

-- Lookup function: get most likely clearance type for a company
CREATE OR REPLACE FUNCTION get_company_clearance_type(p_company_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_result TEXT;
BEGIN
  SELECT clearance_type INTO v_result
  FROM company_clearance_master
  WHERE company_name = p_company_name
  ORDER BY times_seen DESC, last_seen_at DESC
  LIMIT 1;
  RETURN v_result;
END;
$$;


-- =============================================================================
-- INFERENCE LOG — Model performance monitoring (separate from classifications)
-- =============================================================================
CREATE TABLE inference_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  input_awb TEXT,
  input_subject TEXT,
  input_body_hash TEXT,                          -- For dedup without storing full body
  predicted_clearance_type TEXT,
  predicted_intent TEXT,
  predicted_urgency TEXT,
  actual_clearance_type TEXT,                    -- Filled when human corrects
  actual_intent TEXT,
  actual_urgency TEXT,
  confidence REAL,
  latency_ms INT,
  model_version TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_inference_log_created ON inference_log(created_at);
CREATE INDEX idx_inference_log_version ON inference_log(model_version);
```

### 11.2 Existing Table Modifications

```sql
-- Add AI tracking fields to awb_cases
ALTER TABLE awb_cases
  ADD COLUMN IF NOT EXISTS ai_classification_id UUID REFERENCES ai_classifications(id),
  ADD COLUMN IF NOT EXISTS auto_classified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_replied BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS auto_closed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS human_ever_opened BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS ai_actions_count INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS human_actions_count INT DEFAULT 0;
```

### 11.3 pgvector Setup

```sql
-- Run once
CREATE EXTENSION IF NOT EXISTS vector;

-- Vector similarity search function
CREATE OR REPLACE FUNCTION match_similar_emails(
  query_embedding VECTOR(1536),
  match_threshold FLOAT DEFAULT 0.75,
  match_count INT DEFAULT 5,
  filter_clearance_type TEXT DEFAULT NULL,
  filter_intent TEXT DEFAULT NULL
)
RETURNS TABLE(
  id UUID,
  awb TEXT,
  subject TEXT,
  body_clean TEXT,
  clearance_type TEXT,
  intent TEXT,
  similarity FLOAT,
  actual_reply TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id, e.awb, e.subject, e.body_clean,
    e.clearance_type, e.intent,
    1 - (e.embedding <=> query_embedding) AS similarity,
    e.actual_reply
  FROM emails e
  WHERE
    e.embedding IS NOT NULL
    AND (1 - (e.embedding <=> query_embedding)) > match_threshold
    AND (filter_clearance_type IS NULL OR e.clearance_type = filter_clearance_type)
    AND (filter_intent IS NULL OR e.intent = filter_intent)
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

***

## 12. Safety & Compliance Requirements

### 12.1 Non-Negotiable Safety Gates

| Gate ID   | Requirement                                    | Implementation                                                                                                      | Verification                 |
| --------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| **SG-01** | **No auto-send for urgent emails**             | Hard-coded check in `ingestEmail()` before any AI action: if `urgency = urgent` → route MUST be `human_review`      | Unit test + integration test |
| **SG-02** | **No auto-send for legal/compliance emails**   | Keyword blocklist checked before any AI action; if matched → route MUST be `human_review`                           | Code review + automated test |
| **SG-03** | **VIP customers always → human review**        | Config table check at start of classification pipeline                                                              | Unit test with mock config   |
| **SG-04** | **All draft emails require human approval**    | `ai_drafts.status` must transition through `approved` before send pipeline picks it up                              | Integration test             |
| **SG-05** | **No auto-send of follow-ups**                 | `followup_schedules` requires human approval — `sendFollowup()` rejects any with `status != 'approved'`             | Unit test                    |
| **SG-06** | **Draft confidence threshold is configurable** | DB table `app_config` stores `draft_hold_min_threshold` — changeable without code deploy                            | Config change test           |
| **SG-07** | **Full audit trail for every AI decision**     | Every classification, draft, correction logged in dedicated tables                                                  | DB audit query               |
| **SG-08** | **Kill-switch: disable all AI**                | Env var `AI_ENABLED=false` or `app_config.ai_enabled=false` reverts to pure rule-based mode                         | Smoke test                   |
| **SG-09** | **Model rollback capability**                  | Previous 3 model versions retained; API accepts `classifier_version` override                                       | Version pin test             |
| **SG-10** | **PII protection in LLM calls**                | AWB, phone numbers, email addresses redacted or hashed before sending to external LLM API; DPA required with OpenAI | Code review + DPA            |
| **SG-11** | **Rate limiting on AI API calls**              | Max 10 classifications per second; queue overflow delays, never drops                                               | Load test                    |
| **SG-12** | **Human override always possible**             | Every AI suggestion has Accept/Reject/Edit buttons; operator decision always wins                                   | UI test                      |

### 12.2 Compliance Requirements

| Requirement                   | Implementation                                                                                       | Audit Evidence                |
| ----------------------------- | ---------------------------------------------------------------------------------------------------- | ----------------------------- |
| FedEx data handling policy    | All email data stored in Supabase (FedEx-controlled); external AI APIs use data processing agreement | DPA on file                   |
| Email retention policy        | Emails purged after 90 days from `emails` table; `ai_classifications` kept for 2 years               | Cron job + audit              |
| User access logging           | Every human action on AI drafts, classifications, follow-ups logged with `actor_type = 'human'`      | `case_updates` table          |
| Model governance              | Every model version change logged with changelog; accuracy verified before deployment                | `classifier_version` tracking |
| Training data consent         | Emails used for training are internal FedEx operations emails — no customer PII in training          | Data flow diagram             |
| Rollback procedure documented | Document in ops runbook                                                                              | Runbook                       |

### 12.3 Error Handling & Fallbacks

```
  ┌─────────────────────────────────────────────────────────────────┐
  │  ERROR HANDLING MATRIX                                         │
  ├────────────────────────────────────────────────────────────────┤
  │                                                                 │
  │  Scenario                    │  Fallback Behavior              │
  │  ─────────────────────────────────────────────────────────     │
  │  OpenAI API timeout          │  Skip LLM stage, use rule + ML  │
  │  OpenAI API 4xx/5xx          │  Skip LLM stage, log error      │
  │  Embedding API fails         │  Skip ML + LLM, use rules only  │
  │  Supabase query timeout      │  Fall back to local rule cache  │
  │  AI_ENABLED=false            │  Use pure rule-based classifier │
  │  All APIs fail               │  Route ALL to human_review      │
  │  Model file not found        │  Rollback to previous version   │
  │  Config table corrupt        │  Use hard-coded defaults        │
  │  Rate limit exceeded         │  Queue classification, retry    │
  │                               │  after backoff                  │
  │                                                                 │
  └────────────────────────────────────────────────────────────────┘
```

***

## 13. Metrics & Success Criteria

### 13.1 Primary Metrics

| Metric                                                                  | Target                                             | Measurement Method                                                   | Current Baseline                          |
| ----------------------------------------------------------------------- | -------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------- |
| **Classification Accuracy (clearance\_type)**                           | ≥ 97%                                              | Weekly human-validated sample (n=200)                                | \~85% (rule-based estimate)               |
| **Classification Accuracy (intent)**                                    | ≥ 90%                                              | Weekly human-validated sample (n=200)                                | N/A (not currently classified)            |
| **Classification Accuracy (urgency)**                                   | ≥ 85%                                              | Weekly human-validated sample (n=200)                                | N/A (not currently classified)            |
| **Auto-Send Rate** (% of inbound emails AI handles fully without human) | ≥ 30% (target), starting from data-eligible groups | `ai_classifications.route = ai_auto_send` / total operational emails | \~0% (current system routes all to human) |
| **Auto-Send Accuracy** (% of auto-sent replies that are correct)        | ≥ 99.5%                                            | Human audit sample (weekly n=100)                                    | Measure before AI launch                  |
| **Draft Acceptance Rate**                                               | ≥ 80%                                              | `ai_drafts.status = approved` / total drafts                         | 0% (draft UI not built)                   |
| **Follow-Up Send Rate**                                                 | ≥ 60% of scheduled                                 | `followup_schedules.status = sent` / total scheduled                 | 0% (manual only)                          |
| **Human Review Time Reduction**                                         | ↓ 30% vs baseline                                  | Avg time from "reply received" to "case closed"                      | Measure before AI launch                  |
| **Checklist Completion Rate** (NFBRK + FEBRK)                           | ↑ 20% vs baseline                                  | % of cases where all checklist items received before BOE deadline    | Measure before AI launch                  |
| **Broker Confirmation Time** (FEBRK Sunimpex/Jeena)                     | ↓ 40% vs baseline                                  | Avg time from pre-alert sent to broker confirmed                     | Measure before AI launch                  |

### 13.2 Secondary Metrics

| Metric                                                                | Target                                | Measurement Method                                         |
| --------------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------- |
| **AI Classification Latency**                                         | < 2 seconds (P95)                     | `inference_log.latency_ms`                                 |
| **Draft Generation Latency**                                          | < 5 seconds (P95)                     | Server-side timing                                         |
| **Follow-Up Draft Generation Rate**                                   | 100% within 5 min of trigger          | Cron job monitoring                                        |
| **Human Correction Rate**                                             | < 10% of AI suggestions flagged wrong | `training_examples` / total classifications                |
| **False Auto-Send Rate** (AI auto-sent reply that was wrong)          | **< 0.5%**                            | Human audit of auto-sent replies                           |
| **False Draft Rate** (AI draft rejected as wrong content)             | < 5%                                  | `ai_drafts.rejection_reason = wrong_content`               |
| **Checklist Gap Detection Rate**                                      | ≥ 90%                                 | AI-flagged missing checklist items vs actual missing items |
| **Data Coverage** (% of email patterns with sufficient training data) | ≥ 80%                                 | Training data audit per pattern                            |

### 13.3 Business Impact Metrics

| Metric                                      | Target                             | Why It Matters                           |
| ------------------------------------------- | ---------------------------------- | ---------------------------------------- |
| **Customer Satisfaction (CSAT)**            | ↑ 15% (survey-based)               | Primary goal: better customer experience |
| **Emails processed per operator per shift** | ↑ 50%                              | Secondary goal: team efficiency          |
| **Follow-up compliance rate**               | ≥ 90% (follow-ups sent within SLA) | No dropped threads                       |
| **Missed SLA incidents**                    | 0 per month                        | Zero tolerance for operational failure   |
| **Time spent on repetitive replies**        | ↓ 60%                              | Operator time freed for complex issues   |

### 13.4 Dashboard

The AI system should expose a real-time analytics dashboard showing:

```
┌─────────────────────────────────────────────────────────────────┐
│  AI SYSTEM DASHBOARD                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Today's Stats:                                                 │
│  ┌────────────┬──────────┬────────┬────────┬────────┬──────────┐│
│  │ Classified │Auto-Sent │ Drafts │ Human  │Checklist│ Follow-  ││
│  │            │          │ Created│ Review │Complete │ Ups Due  ││
│  ├────────────┼──────────┼────────┼────────┼──────────┼──────────┤│
│  │    142     │   38     │   52   │   32   │   38%   │    12    ││
│  └────────────┴──────────┴────────┴────────┴──────────┴──────────┘│
│                                                                 │
│  Accuracy Trends (7-day rolling):                               │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  ████████████████████████████████░░░  94%  clearance   │   │
│  │  ██████████████████████████░░░░░░░░  86%  intent       │   │
│  │  ██████████████████████░░░░░░░░░░░░  80%  urgency      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Draft Acceptance Rate: 82% (last 7 days)                      │
│  Follow-Up Send Rate: 65% (last 7 days)                        │
│  Human Review Time Saved: 28% vs baseline (last 7 days)       │
│                                                                 │
│  Model: v1.2.3 (deployed 2026-07-20)  |  AI ENABLED           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

***

## 14. Implementation Phases

### 14.1 Rollout Philosophy

```
  Phase 1: Foundation    ──→  Phase 2: Data Analysis  ──→  Phase 3: Human-Gated
       (Build infra,           (Analyze Excel data         (AI proposes,
        embeddings,             to determine safe           human approves)
        shadow mode)            auto-send patterns)
                                                              │
                                                              ▼
                                                   Phase 4: Selective Auto-Send
                                                   (Enable for data-proven
                                                    safe patterns only)
                                                              │
                                                              ▼
                                                   Phase 5+: Full AI Assist
                                                   (drafts, follow-ups, calls,
                                                    checklist tracking)
```

Each phase is designed to be independently deployable and reversible. No phase ships without a rollback plan.
Every auto-send pattern must be proven safe by Phase 2 data analysis before it can be enabled in Phase 4.

### 14.2 Phase 1: Foundation (Week 1–2)

**Goal:** Build all data infrastructure, implement the ensemble classifier in shadow mode, collect baseline accuracy metrics.

| Step | Task                                         | Deliverable                                                     | Verification                                  |
| ---- | -------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------- |
| 1.1  | Run VBA script on 500+ AWBs                  | `email_extract.csv` with 2000+ emails                           | File exists with expected columns             |
| 1.2  | Build cleaning pipeline                      | `scripts/cleaning_pipeline.py`                                  | Pipeline runs without errors                  |
| 1.3  | Set up Supabase pgvector                     | `CREATE EXTENSION vector;` tables created                       | SQL runs successfully                         |
| 1.4  | Embed + store all emails                     | `emails` table populated with embeddings                        | 2000+ rows with embeddings                    |
| 1.5  | Rule-based clearance type labeling           | Labels for all emails in DB                                     | Query returns labeled rows                    |
| 1.6  | Build ensemble classifier (local)            | `scripts/train_classifier.py`                                   | Train + evaluate on holdout set               |
| 1.7  | Deploy classifier in shadow mode             | `POST /api/ai/classify` logs classifications but does NOT route | `ai_classifications` populated, no UI changes |
| 1.8  | Build `app_config` table                     | Config with default values                                      | Seed data queryable                           |
| 1.9  | Build `ai_classifications` table + migration | Migration 0035                                                  | Migration runs, indexes created               |

**Risk:** Data quality issues from VBA extraction. Mitigation: manual sample review after step 1.1.

**Exit Criteria:**

- [ ] 2000+ emails in Supabase with embeddings
- [ ] Classifier accuracy >90% on validation set
- [ ] `POST /api/ai/classify` running in shadow mode
- [ ] All tables migrated and indexes created
- [ ] 0 user-facing changes (completely invisible to operators)

### 14.3 Phase 2: Data Analysis + LLM Labeling (Week 2–4)

**Goal:** Analyze Excel data to determine which email patterns are safe for AI\_AUTO\_SEND. Enrich labels with intent, urgency via LLM.

| Step | Task                                                                                                     | Deliverable                              | Verification                        |
| ---- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------- |
| 2.1  | **Export Sent Items** from Outlook via VBA                                                               | `sent_items.csv` with replies sent       | Matches to inbound emails           |
| 2.2  | **Build pattern analyzer** — group by issue type + sender + urgency, compute reply variance + error rate | `scripts/analyze_patterns.py`            | Report showing safe patterns        |
| 2.3  | **Identify auto-send eligible patterns** per data analysis process in §5.1                               | List of patterns + confidence thresholds | Zero-variance, zero-error patterns  |
| 2.4  | Build LLM labeling script                                                                                | `scripts/label_with_llm.py`              | Labels 2000 emails in < $5 API cost |
| 2.5  | Label intent, urgency, response\_type for all emails                                                     | Labels in Supabase `emails` table        | All rows have non-null labels       |
| 2.6  | Build batch human review interface                                                                       | `/admin/training-data` page              | Operator can view + correct labels  |
| 2.7  | Human review 300 lowest-confidence samples                                                               | Gold-labeled set in `training_examples`  | 300+ rows with `corrected_value`    |
| 2.8  | Retrain classifiers with gold data                                                                       | Updated `models/` directory              | Accuracy improves by ≥2%            |
| 2.9  | Build `training_examples` table + migration                                                              | Migration 0036                           | Corrections stored correctly        |

**Risk:** Sent Items may not be available for all emails. Mitigation: sample size of ≥30 per pattern.

**Exit Criteria:**

- [ ] Pattern analysis complete — report shows safe patterns
- [ ] Auto-send eligible patterns identified with data-driven thresholds
- [ ] All emails have intent, urgency, response\_type labels
- [ ] 300+ human-corrected training examples
- [ ] Classifier accuracy >92% on gold validation set

### 14.4 Phase 3: Inbound Routing with Human Gates — ALL Drafts (Week 3–4)

**Goal:** Replace pure rule-based classifier with ensemble classifier. ALL operational emails go to AI\_DRAFT\_HOLD or HUMAN\_REVIEW. No auto-send yet — auto-send will be enabled in Phase 4 only for data-proven patterns.

| Step | Task                                                             | Deliverable                     | Verification                     |
| ---- | ---------------------------------------------------------------- | ------------------------------- | -------------------------------- |
| 3.1  | Modify `ingest-email.ts` to use ensemble classifier              | Updated classification pipeline | Classify() returns richer output |
| 3.2  | Route ALL operational emails to AI\_DRAFT\_HOLD or HUMAN\_REVIEW | Route handler change            | Auto-send disabled for all       |
| 3.3  | Build draft queue UI for inbound replies                         | `/ai/drafts` page               | Operator sees drafts             |
| 3.4  | Build draft approval/reject/edit flow                            | Approve button → sends email    | Email sent only after approval   |
| 3.5  | Implement safety gates (SG-01 through SG-12)                     | All gates in code               | Unit tests pass                  |
| 3.6  | Deploy — all routes human-gated                                  | Production deploy               | Monitor for 1 week               |
| 3.7  | Weekly accuracy audit                                            | Report generated                | ≥92% accuracy                    |

**Risk:** Operator adoption of new workflow. Mitigation: Training sessions + "AI suggests" badge.

**Exit Criteria:**

- [ ] All 12 safety gates implemented and tested
- [ ] Draft queue UI functional
- [ ] 100% of AI actions require human approval (auto-send disabled)
- [ ] 1 week of production monitoring with zero incidents
- [ ] Operator feedback collected and actioned

### 14.5 Phase 4: Selective Auto-Send (Data-Proven Patterns Only) (Week 4–5)

**Goal:** Enable AI\_AUTO\_SEND only for patterns that passed Phase 2 data analysis as safe. Everything else stays in AI\_DRAFT\_HOLD or HUMAN\_REVIEW.

| Step | Task                                                                    | Deliverable                              | Verification                          |
| ---- | ----------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------- |
| 4.1  | Configure auto-send patterns from Phase 2 analysis                      | `app_config` entry: `auto_send_patterns` | Patterns configurable without deploy  |
| 4.2  | Enable AI\_AUTO\_SEND route for pattern-matched, high-confidence emails | Route handler update                     | Only eligible patterns get auto-send  |
| 4.3  | Add "AI Auto-Sent" badge in case history                                | UI component                             | Operator can see which were auto-sent |
| 4.4  | Build auto-send accuracy monitoring                                     | Human audit sample (n=100/week)          | Auto-send accuracy ≥ 99.5%            |
| 4.5  | Add auto-send metrics to dashboard                                      | Live stats                               | Auto-send rate visible                |
| 4.6  | Weekly review: check auto-send accuracy, expand or restrict patterns    | Review meeting                           | Patterns adjusted based on data       |

**Safety Rule:**

- Auto-send ONLY enabled for data-proven safe patterns
- If auto-send accuracy drops below 99.5%, affected pattern is immediately demoted to AI\_DRAFT\_HOLD
- All auto-send decisions are fully audited in `ai_classifications` table
- Human override always possible — operator can change case status

**Exit Criteria:**

- [ ] Auto-send enabled for at least 1 data-proven pattern
- [ ] Auto-send accuracy ≥ 99.5% in first 2 weeks
- [ ] Monitoring dashboard shows auto-send metrics
- [ ] Rollback plan tested (disable auto-send via config)

### 14.6 Phase 5: Outbound AI Assist + Checklist Tracking (Week 5–7)

**Goal:** Add master data clearance lookup to validate page (auto-fill for known companies, unresolved panel for others → human research → AI calling fallback), AI draft generation to review page, AI pre-flight checks to send page, and checklist status tracking per AWB.

| Step | Task                                                      | Deliverable                        | Verification                            |
| ---- | --------------------------------------------------------- | ---------------------------------- | --------------------------------------- |
| 5.1  | Build `company_clearance_master` table + upload from Excel | Master data table + import script | Data queryable by company name |
| 5.2  | Add master data lookup to validate page — auto-fill clearance type when company found | Lookup integration | Auto-filled rows show source badge |
| 5.3  | Build unresolved panel UI for rows not in master data | `UnresolvedPanel` component | Shows research + AI call actions |
| 5.4  | Implement RAG retrieval API | `POST /api/ai/similar` | Returns 5 similar emails |
| 5.5  | Build draft generator API | `POST /api/ai/draft-reply` | Returns draft JSON |
| 5.6  | Add AI draft panel to review page | `AIDraftPanel` component | Draft shown with edit/approve/reject |
| 5.7  | Build AI pre-flight checks on send page | `AIPreflightWarnings` component | Warnings shown before send |
| 5.8  | Build checklist templates (NFBRK vs FEBRK) + tracking API | `POST /api/ai/checklist-status` | Returns done/pending items per AWB |
| 5.9  | Add checklist panel to validate and review pages | `ChecklistPanel` component | Shows documents received vs pending |
| 5.10 | Build `ai_drafts` table + migration | Migration 0037 | Drafts persisted |
| 5.11 | Build AI calling integration — trigger call for rows unresolved after human research | VAPI/webhook integration | Call placed for flagged rows |

**Risk:** LLM-generated drafts may have tone/language issues. Mitigation: FedEx brand guidelines encoded in system prompt; operator can always edit.

**Exit Criteria:**

- [ ] Master data table populated from Excel, queryable by company name
- [ ] Validate page auto-fills clearance type for known companies from master data
- [ ] Unresolved panel shows rows needing human research (no master data match)
- [ ] Human can search Outlook and update clearance type — change auto-saves to master data
- [ ] AI calling integration triggers for rows still unresolved after human research
- [ ] Review page shows AI-generated drafts
- [ ] Send page shows pre-flight warnings
- [ ] Draft acceptance rate ≥ 70%
- [ ] Checklist tracking functional per AWB on validate + review pages

### 14.7 Phase 6: Follow-Up Scheduler (Week 7–8)

**Goal:** Automate follow-up email scheduling with AI-authored drafts and human approval.

| Step | Task                                         | Deliverable                       | Verification               |
| ---- | -------------------------------------------- | --------------------------------- | -------------------------- |
| 6.1  | Implement follow-up rules engine             | `src/lib/ai/followup.ts`          | Rules fire correctly       |
| 6.2  | Build `followup_schedules` table + migration | Migration 0038                    | Schedules stored           |
| 6.3  | Build follow-up queue UI                     | `/ai/followups` page              | List of pending follow-ups |
| 6.4  | Implement cron job (Supabase pg\_cron)       | Auto-create follow-ups every hour | Schedules created on time  |
| 6.5  | Build follow-up draft generation             | AI-authored follow-up drafts      | Drafts generated per rule  |
| 6.6  | Send pipeline for approved follow-ups        | `sendFollowup()` function         | Email sent after approval  |

**Risk:** Follow-ups may pile up if operators don't review them. Mitigation: Notifications + escalation if queue > 50.

**Exit Criteria:**

- [ ] Follow-ups scheduled and drafted automatically
- [ ] Follow-up queue UI functional
- [ ] All follow-ups require human approval
- [ ] Follow-up send rate ≥ 50%

### 14.8 Phase 7: Call Logging AI (Week 8–9)

**Goal:** Add AI summarization, action extraction, and thread linking to the calls page.

| Step | Task                         | Deliverable                        | Verification               |
| ---- | ---------------------------- | ---------------------------------- | -------------------------- |
| 7.1  | Build call summarization API | `POST /api/ai/summarize-call`      | Returns structured summary |
| 7.2  | Build action extraction      | Extract follow-ups from call notes | Actions created in queue   |
| 7.3  | Build thread linking         | `POST /api/ai/link-thread`         | Suggested links shown      |
| 7.4  | Integrate into calls page UI | Call form with AI suggestions      | Operator sees suggestions  |

**Risk:** Call summarization quality depends on operator note quality. Mitigation: AI works best with 50+ character notes; no AI for shorter notes.

**Exit Criteria:**

- [ ] Call notes can be AI-summarized
- [ ] Action items extracted automatically
- [ ] Thread linking suggested
- [ ] Operator satisfaction ≥ 4/5

### 14.9 Phase 8: Monitoring & Continuous Improvement (Ongoing)

| Step | Task                          | Frequency |
| ---- | ----------------------------- | --------- |
| 8.1  | Weekly accuracy audit         | Weekly    |
| 8.2  | Monthly model retraining      | Monthly   |
| 8.3  | Quarterly architecture review | Quarterly |
| 8.4  | Daily monitoring dashboard    | Real-time |

***

## 15. Clarifying Questions Before Build

These questions need answers from the product owner / operations team before Phase 1 can begin.

| #  | Question                                                                                                                                                                                              | Options                                                       | Impact                                           |
| -- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------ |
| 1  | **VIP customer list** — Which email domains or sender patterns should always trigger human review?                                                                                                    | Provide list of domains / emails                              | Routes to human review instead of AI             |
| 2  | **Legal/compliance keywords** — Which words/phrases must block auto-actions?                                                                                                                          | Provide list or approve defaults                              | Safety gate configuration                        |
| 3  | **SLA targets** per clearance type — What are the expected response SLAs for NFBRK, FEBRK, Calling, Hold?                                                                                             | e.g., NFBRK=24h, FEBRK=48h, Calling=4h, Hold=daily            | Follow-up scheduler timing                       |
| 4  | **Draft sender identity** — Should AI-generated drafts appear to come from the operator personally or from a shared alias like `ops@fedex.com`?                                                       | Operator email / Shared alias / Both configurable             | Email deliverability + branding + accountability |
| 5  | **Attachment parsing** — Should AI extract text from PDF attachments (invoices, packing lists) for better classification?                                                                             | Yes / No / Only for specific types                            | Classification accuracy boost vs cost            |
| 6  | **Conversation threading** — Should we use `In-Reply-To` / `References` headers or Outlook's `ConversationID` for thread grouping?                                                                    | Header-based / ConversationID / Both                          | Context window for AI                            |
| 7  | **Retraining cadence** — How often should the model be retrained?                                                                                                                                     | Weekly automated / Bi-weekly / Manual trigger only            | MLOps effort                                     |
| 8  | **Draft editor UX** — Where should the operator review AI drafts?                                                                                                                                     | Side panel on case page / Modal popup / Dedicated drafts page | UI implementation effort                         |
| 9  | **FedEx brand guidelines** — Any specific language, tone, or disclaimers required in all outbound emails?                                                                                             | Provide guidelines doc                                        | LLM system prompt content                        |
| 10 | **Checklist document types** — What specific documents are required for NFBRK vs FEBRK checklist completion? (e.g., BOE copy, invoice, packing list, AWB copy, DO copy, shipping bill, broker letter) | Provide list per clearance type                               | Checklist tracking accuracy                      |

***

## 16. File Structure for Implementation

```
/src
├── lib/ai/
│   ├── classify.ts              # Ensemble classifier (rules + ML + LLM)
│   ├── embed.ts                 # OpenAI embeddings wrapper
│   ├── rag.ts                   # Vector search + context builder
│   ├── draft.ts                 # LLM response generator
│   ├── followup.ts              # Scheduler + draft generator
│   ├── calibrate.ts             # Confidence calibration (temperature scaling)
│   ├── summarizer.ts            # Call summarization + action extraction
│   ├── thread-linker.ts         # Thread linking logic
│   ├── safety.ts                # Safety gates (SG-01 through SG-12)
│   ├── types.ts                 # Shared TypeScript interfaces
│   └── config.ts                # App config reader (cached)
│
├── app/api/ai/
│   ├── classify/route.ts        # POST /api/ai/classify
│   ├── similar/route.ts         # POST /api/ai/similar (RAG)
│   ├── draft-reply/route.ts     # POST /api/ai/draft-reply
│   ├── followups/route.ts       # GET /api/ai/followups, POST create
│   ├── summarize-call/route.ts  # POST /api/ai/summarize-call
│   ├── link-thread/route.ts     # POST /api/ai/link-thread
│   ├── feedback/route.ts        # POST /api/ai/feedback (human corrections)
│   └── retrain/route.ts         # POST /api/ai/retrain (admin only)
│
├── app/(app)/ai/
│   ├── drafts/
│   │   └── page.tsx             # AI draft queue (inbound replies)
│   ├── followups/
│   │   └── page.tsx             # Follow-up draft queue
│   └── dashboard/
│       └── page.tsx             # AI system analytics dashboard
│
├── components/ai/
│   ├── clearance-master-lookup.tsx   # Validate page — master data lookup
│   ├── unresolved-panel.tsx          # Validate page — rows needing human research
│   ├── ai-draft-panel.tsx            # Review page draft panel
│   ├── ai-preflight-warnings.tsx     # Send page warnings
│   ├── ai-followup-queue.tsx         # Follow-up queue component
│   ├── ai-smart-compose.tsx          # Reply assist editor
│   ├── ai-call-summary.tsx           # Call summarization component
│   └── ai-dashboard-metrics.tsx      # Dashboard metric cards
│
├── lib/email/
│   └── ingest-email.ts          # MODIFIED: uses ensemble classifier
│
├── lib/email/send/
│   └── send-followup.ts         # Follow-up email dispatcher (requires approval)
│
└── scripts/
    ├── cleaning_pipeline.py     # Email data cleaning
    ├── label_with_llm.py        # LLM-assisted labeling
    ├── embed_and_store.py       # Embed + store in Supabase
    ├── train_classifier.py      # Train ML classifier
    ├── retrain_classifier.py    # Automated retraining script
    ├── backfill-embeddings.ts   # Backfill embeddings for existing emails
    └── seed-templates.ts        # Seed template library
```

***

## 17. Appendix: Comparison — Current Rule-Based vs Future AI System

| Aspect                    | Current System                             | Future AI System                                                                       | Improvement                                             |
| ------------------------- | ------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **Classification method** | 13 keyword regex rules                     | Ensemble: rules + ML + LLM                                                             | From fragile pattern matching to semantic understanding |
| **Confidence**            | Hard-coded per rule (static)               | Computed dynamically (data-driven)                                                     | Accurate certainty estimation                           |
| **Case closure**          | Some issue types auto-close cases          | AI NEVER auto-closes operational pre-alert cases. Only OOO/bounce auto-ignored.        | Every operational decision goes through human           |
| **Draft generation**      | 4 static templates, no context             | LLM-generated, context-aware, RAG-enhanced                                             | Personalized, accurate replies                          |
| **Thread awareness**      | None — each email classified independently | Full thread context via conversation\_id                                               | Consistent, non-repetitive replies                      |
| **Human review**          | Manual queue, no AI assistance             | AI-prioritized, AI-draft-assisted, AI-follow-up-managed                                | Faster, smarter human review                            |
| **Follow-ups**            | Manual only                                | AI-scheduled, AI-authored, human-approved                                              | No dropped threads                                      |
| **Learning**              | None — rules never improve                 | Continuous learning from human corrections                                             | Accuracy improves over time                             |
| **Safety gates**          | None                                       | 12 hard-coded safety gates                                                             | Zero tolerance for FedEx errors                         |
| **Checklist tracking**    | None — operator manually tracks docs       | AI tracks checklist items (BOE, invoice, packing list, etc.) per AWB and surfaces gaps | Faster BOE filing                                       |
| **Call logging**          | Manual text entry                          | AI-summarized, AI-action-extracted, AI-thread-linked                                   | Reduced operator effort                                 |
| **VIP handling**          | None — VIP emails treated same as others   | Auto-detected → human review + priority boost                                          | White-glove service                                     |
| **Model versioning**      | N/A                                        | Full versioning + rollback                                                             | Safe upgrades                                           |
| **Monitoring**            | Basic classification count                 | Full dashboard: accuracy, latency, acceptance rates                                    | Data-driven decisions                                   |

***

## Document History

| Version | Date       | Author    | Changes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------- | ---------- | --------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 2026-07-23 | AI System | Initial comprehensive requirements document — covering all AI touchpoints, decision matrix, safety gates, architecture, phases, and clarifying questions                                                                                                                                                                                                                                                                                                                                                                    |
| 1.1     | 2026-07-23 | AI System | **Revised autonomy model:** AI CAN auto-send replies for data-proven safe patterns (determined by Excel data analysis). Added Business Domain Context section (uBond vs Consol, 3 Consol review rules, real pre-alert objective). Added Data Analysis phase (Phase 2) to determine auto-send eligibility from historical data. Replaced old auto-close phase with Selective Auto-Send phase (Phase 4, data-proven only). Added checklist tracking. Auto-send conditions are always determined by data, never by assumption. |

***

*This document is a living specification. Update it as implementation progresses and new requirements emerge. Every safety gate change must be reviewed by the operations lead before deployment.*
