# System Flow Diagram Prompt — Cargo Pre-Alert Intelligence

This document contains the complete end-to-end flow description for generating a system architecture diagram on Eraser.io or Miro AI. Paste the entire section below into the platform's text-to-diagram feature.

---

## Instructions for Past

Paste the entire content below into Eraser.io `/draw` command or Miro AI "Generate diagram from text". The diagram will render the complete Cargo Pre-Alert Operations system with all sub-flows.

---

## Diagram Content (Start Here)

```
Title: Cargo Pre-Alert Operations — End-to-End System Flow

# Legend
- Blue boxes = System components
- Green boxes = AI/ML components  
- Orange boxes = Human action required
- Purple boxes = External systems
- Dashed lines = Data flow
- Solid lines = Process flow
- Red dotted = Safety gates / checks

# ────────────────────────────────────────────────────────────────────
# SECTION 1: DATA INGESTION & MASTER DATA
# ────────────────────────────────────────────────────────────────────

[Outlook Mailboxes] ──VBA Script──> [email_extract.csv]
[email_extract.csv] ──Cleaning Pipeline──> [Supabase: emails table]
[Excel: Company Master Data] ──Upload──> [Supabase: company_clearance_master]
[Excel: Templates] ──Upload──> [Supabase: templates table]

# ────────────────────────────────────────────────────────────────────
# SECTION 2: BATCH CREATION (uBond / Consol Split)
# ────────────────────────────────────────────────────────────────────

[Start] ──> [Choose Batch Type]
    Choose Batch Type ──"uBond"──> [uBond Flow: Pre-Arrival. RAISE/LV/MV/HV classification. Clearance team identifies incoming cargo. Fresh AWBs, sent 2-3x/day]
    Choose Batch Type ──"Consol"──> [Consol Flow: Pre-IGM alert. Same NFBRK/FEBRK templates as uBond. Emails already sent in uBond NOT re-sent here]

# ────────────────────────────────────────────────────────────────────
# SECTION 3: BATCH PROCESSING PIPELINE
# ────────────────────────────────────────────────────────────────────

[Create Batch] ──> [Map Columns: AWB, HAWB, Consignee, etc.]
    Map Columns ──> [Validate Page]

    # ── VALIDATE PAGE ──
    [Validate Page] ──contains──> [3 Sub-Processes]

    # Sub-process 1: Clearance Type Resolution
    [Clearance Type Resolution] ──>
        Query company_clearance_master by consignee name
        ──Found?──> [Auto-fill NFBRK/FEBRK. Badge: "From Master Data"]
        ──Not Found?──> [Unresolved Panel: "Needs Research"]

        [Unresolved Panel] ──>
            [Human Research: Operator searches Outlook for AWB history]
            ──Found?──> [Operator sets clearance type. Auto-saves to master data]
            ──Not Found?──> [AI Calling: VAPI calls customer to ask NFBRK/FEBRK]

    # Sub-process 2: Validation Checks
    [Validation Checks] ──>
        ──Consol?──> [Courier Weight Check: >70kg/pc, ≥10 pieces → flag Cargo→Courier]
        ──Always──> [Email Validation: Parse semicolon-separated emails, validate each]
        ──Always──> [Clearance Counts: Compute NFBRK/FEBRK/Calling/Hold totals]

    # ── REVIEW PAGE ──
    [Validate Page] ──> [Review Page]
    [Review Page] ──contains──> [uBond Review | Consol Review]

    [uBond Review] ──> [Group rows by template type → AI generates draft reply per group]
    [Consol Review] ──> [3 Panels:]
        Panel 1: [Cargo→Courier Move: Flagged rows ≥70kg/10pc]
        Panel 2: [FEBRK Confirmation: Confirm Sunimpex or Jeena. Get email if missing]
        Panel 3: [NFBRK Confirmation: Confirm clearance type]
        Panel 4: [Unresolved: Anything not fitting above]

    # ── ATTACHMENTS / PREVIEW / SEND ──
    [Review Page] ──> [Attachments Page]
    Attachments Page ──uBond──> [Upload/manage attachment files]
    Attachments Page ──Consol──> [Redirect to Preview (skip attachments)]
    [Preview Page] ──> [AI Pre-flight Checks: missing attachments, duplicate AWBs, template match]
    [AI Pre-flight Checks] ──> [Send Page]
    [Send Page] ──> [SMTP Outbound]
    [SMTP Outbound] ──> [Post-Send Summary]


# ────────────────────────────────────────────────────────────────────
# SECTION 4: AI DECISION ENGINE — INBOUND EMAIL
# ────────────────────────────────────────────────────────────────────

[IMAP Poll] ──every 60s──> [New Email Detected]
    New Email Detected ──> [Pre-Classification Hard Gates]

    [Pre-Classification Hard Gates]
        ──VIP Sender?──> [Route: HUMAN_REVIEW ⛔]
        ──Legal/Compliance Keywords?──> [Route: HUMAN_REVIEW ⛔]
        ──OOO/Bounce/Auto-Reply?──> [Route: IGNORE]
        ──Passes Gates?──> [AI Ensemble Classifier]

    [AI Ensemble Classifier]
        Stage 1: [Rule Fast-Path: 13 keyword rules → clearance_type, intent, urgency]
        Stage 2: [Embedding Classifier: text-embedding-3-small → Logistic Regression → 95% accuracy]
        Stage 3: [LLM Verifier: GPT-4o-mini → structured JSON with reasoning]
        Stage 4: [Ensemble Fusion: Combine all 3 stages → final confidence]
        Stage 5: [Audit Log: Store in ai_classifications table]

    ──Route Decision──>
        [Condition: Pattern data-proven safe + confidence ≥ threshold + not urgent + not VIP + not legal]
        ──> [AI_AUTO_SEND: AI sends reply + auto-closes. Audit logged.]
        [Condition: Known pattern but needs human judgment]
        ──> [AI_DRAFT_HOLD: AI drafts reply → Draft Queue → Human approves → Send]
        [Condition: Novel/urgent/VIP/legal/low-confidence]
        ──> [HUMAN_REVIEW: → Human Review Queue]


# ────────────────────────────────────────────────────────────────────
# SECTION 5: DRAFT & FOLLOW-UP ENGINE
# ────────────────────────────────────────────────────────────────────

[AI Draft Generator]
    Input: [Classified email + RAG context + case data]
    RAG Context: [Vector search → 5 similar historical emails + best template]
    Output: [Draft reply with subject, body, confidence, flags]
    ──> [ai_drafts table: status = pending]

[Draft Lifecycle]
    pending ──human reviews──> [approved | edited | rejected]
    approved ──> [sent]
    rejected ──> [training_examples: log reason for learning]

[Follow-Up Scheduler]
    Triggers:
        NFBRK sent, no reply 24h → [Draft reminder]
        FEBRK sent, broker not confirmed 48h → [Draft escalation]
        Calling sent, no callback log 4h → [Draft callback reminder]
        Hold > 24h → [Draft status check]
        Inactive thread > 7d → [Draft check-in]
        Escalation flagged, no action 2h → [Draft supervisor notification]
    All follow-ups: [AI-authored → Human approves → Sent. NEVER auto-sent.]


# ────────────────────────────────────────────────────────────────────
# SECTION 6: CASE MANAGEMENT
# ────────────────────────────────────────────────────────────────────

[Cases Page]
    [AI Auto-Prioritization: urgency + SLA + customer tier + time since last action]
    [AI Smart Compose: Suggested reply when operator opens case]
    [AI Knowledge Retrieval: "Here's what was replied last time for this AWB"]

[Human Review Page]
    [AI-prioritized queue]
    [AI-written draft suggestions per case]
    [Follow-up status per case]

[My Cases Page]
    [Smart Assignment: skill match + workload + recent activity]


# ────────────────────────────────────────────────────────────────────
# SECTION 7: CALL LOGGING
# ────────────────────────────────────────────────────────────────────

[Operator Call Notes] ──> [AI Call Summarization]
    AI Call Summarization:
        [Named Entity Extraction: company, contact person]
        [Intent Classification: commitment received, query, escalation]
        [Action Extraction: "will send docs" → create follow-up task]
        [Thread Linking: suggest link to AWB email thread]
    Output: [Structured call summary → Operator accepts/edits/rejects]


# ────────────────────────────────────────────────────────────────────
# SECTION 8: AI TRAINING & FEEDBACK LOOP
# ────────────────────────────────────────────────────────────────────

[training_examples table]
    Sources: [draft_rejection] [human_review_correction] [call_log_override]
    ──> [Weekly retrain trigger: 100 new corrections]
    ──> [Updated classifier model → deployed to inference API]
    ──> [Dashboard: accuracy trends, acceptance rates, auto-send accuracy]


# ────────────────────────────────────────────────────────────────────
# SECTION 9: SAFETY GATES (Applied Everywhere)
# ────────────────────────────────────────────────────────────────────

SG-01: [NO auto-send for urgent emails] ──> Route: HUMAN_REVIEW
SG-02: [NO auto-send for legal/compliance] ──> Route: HUMAN_REVIEW
SG-03: [VIP customers always → human] ──> Route: HUMAN_REVIEW
SG-04: [All drafts require human approval] ──> status must reach "approved" before send
SG-05: [NO auto-send of follow-ups] ──> Human approval required
SG-06: [Kill-switch: AI_ENABLED=false] ──> Revert to pure rule-based
SG-07: [Model rollback] ──> Previous 3 versions retained
SG-08: [Human override always possible] ──> Accept/Reject/Edit on every AI suggestion


# ────────────────────────────────────────────────────────────────────
# SECTION 10: DATA STORES
# ────────────────────────────────────────────────────────────────────

[Supabase Database]
    ├── batch_runs: pre_alert_type (uBond/Consol), status, timestamps
    ├── awb_cases: AWB data, clearance_type, pre_alert_type, status
    ├── company_clearance_master: company_name → clearance_type mapping
    ├── emails: extracted emails with embeddings (pgvector)
    ├── templates: email templates with embeddings
    ├── ai_classifications: every AI decision with audit trail
    ├── ai_drafts: every AI-generated draft with lifecycle
    ├── followup_schedules: scheduled follow-ups
    ├── training_examples: human corrections for retraining
    ├── app_config: runtime configuration (AI flags, thresholds)
    └── inference_log: model performance monitoring
```

---

## Two-Part Generation (If Platform Requires Shorter Input)

If the platform has a character limit, split into two diagrams:

### Diagram A: Batch Processing Pipeline
```
Title: Batch Processing Pipeline — uBond/Consol

[Create Batch → uBond/Consol] ──> [Map Columns] ──> [Validate Page]
[Validate Page]
  ├── [Clearance Resolution: Master Data Lookup → Human Research → AI Calling]
  ├── [Courier Check: >70kg/10pc → Cargo→Courier flag]
  └── [Email Validation: Parse + validate recipients]
    └──> [Review Page]
[Review Page]
  ├── uBond: [Group by Template → AI Draft per Group]
  └── Consol: [Cargo→Courier Panel] [FEBRK Confirmation Panel] [NFBRK Panel]
    └──> [Attachments (uBond only)] ──> [Preview] ──> [AI Pre-flight] ──> [Send]
```

### Diagram B: AI Decision Engine
```
Title: AI Decision Engine — Inbound + Outbound

[IMAP] ──> [Hard Gates: VIP? Legal? OOO?]
  └──> [Ensemble Classifier: Rules + Embedding + LLM]
    └──> [Route Decision: Auto-Send | Draft-Hold | Human-Review]
[Auto-Send] ──> [AI sends reply + closes (data-proven safe patterns only)]
[Draft-Hold] ──> [AI drafts → Human approves → Send]
[Human-Review] ──> [Human Review Queue → AI assists with suggestions]

[Follow-Up Engine] ──> [6 rules by clearance type + elapsed time] ──> [AI drafts → Human approves]
[Call Logging] ──> [AI Summary] [Action Extraction] [Thread Linking]
[Training Loop] ──> [Human corrections → Retrain classifier → Improve accuracy]
```

---

## Platforms Supported

| Platform | How to Use |
|----------|-----------|
| **Eraser.io** | Paste the full diagram content into a new `.draw` file or use the `/draw` command in Eraser AI |
| **Miro AI** | Use "Generate diagram from text" feature — paste the main section under "Diagram Content" |
| **Whimsical** | Paste into Whimsical AI diagram generator |
| **tldraw** | Use "Make Real" or paste as markdown |
| **Diagrams.net** | Manual layout using the flow description as reference |
| **Excalidraw** | Paste into Excalidraw+ AI feature |

---

## Notes for Diagram Generation

1. **Eraser.io specific**: Use triple-backtick blocks with `draw` language for best results
2. **Miro specific**: Paste the text under "Diagram Content (Start Here)" section into Miro AI's "Generate diagram" input
3. **Layout hint**: The diagram should be read top-to-bottom, with the batch processing pipeline on the left and the AI decision engine on the right
4. **Color coding**: Use the legend colors for consistent visual understanding
5. **Arrows**: Follow solid lines for process flow, dashed for data flow, red dotted for safety gates
