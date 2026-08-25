# Post-Intelligence Architecture — Reply Classification + Follow-up System

Version 1.0 · FedEx Delhi IGI Operations · This document **only** covers the
**post** side: what happens **after** a pre-alert has already been sent.

> Companion docs: `POWER_AUTOMATE_BLUEPRINT.md` (mailbox plumbing),
> `PROCESS_FLOW.md` (clearance-fill pre-processing), `AI_IMPLEMENTATION_GUIDE.md`
> (labeling + vector DB), `OUTLOOK_AWB_EXTRACTOR_GUIDE.md` (VBA extraction).

***

## 1. Scope & boundaries

### 1.1 What this system is

The team already sends pre-alerts **today** — the Excel + script + Outlook
process works and they are not replacing it. The gap is **what happens after**:

- A customer replies to a pre-alert and the reply sits in Outlook.
- Someone has to read it, figure out what it is, decide what to do, write a
  reply, and make sure it's followed up.

This system automates exactly that: **detect the reply → classify it → generate
a reply or route it to a human → send it → track it → export the outcome.**

### 1.2 What is explicitly OUT of scope

| out of scope                                            | reason                                           |
| ------------------------------------------------------- | ------------------------------------------------ |
| Pre-alert **send engine** (SMTP/Graph/outbox bulk send) | team runs their own local script; do not rebuild |
| TIFF→PDF conversion polish                              | already exists, not part of this flow            |
| Batch wizard depth / admin analytics                    | not needed for the post loop                     |

### 1.3 What is reused as-is

- **`/clearance-fill`** **module** — sheet upload → autofill → AI calling → dashboard
  → Excel export. It is the *input* to post-intelligence because it tells us
  **which AWBs we actually pre-alerted** (the AWB universe).
- **`src/lib/ai/*`** — the classification ensemble, RAG retriever, draft
  generator, safety gate, follow-up scheduler. These are the post-intelligence
  engine and already exist.

### 1.4 V1 scope — NFBRK only (FEBRK deferred)

V1 automates **only the NFBRK flow** (`clearance_type = nfbrk` — consignee's own
broker/CHA clears the shipment). **FEBRK is deliberately out of V1.**

Why FEBRK is deferred — from the real templates in `Template/FEBRK/`:

- FEBRK mails **always tag other mail IDs in CC** — for Sunimpex
  `csdel@sunimpexcsa.com` + `iphvdelcargo@corp.ds.fedex.com`, for Jeena
  `fedex-imports@jfsfreight.co.in` + `ccu-imports@jfsfreight.co.in` — and run a
  3-step broker flow (checklist approval → prior BOE filing → customs release).
  It is a **multi-party coordination thread**, not a two-party pre-alert.
- Auto-classifying/auto-replying on a thread where the broker sits in CC and
  duty/checklist decisions belong to the team is high-risk: a wrong auto-reply
  on a FEBRK thread costs money and trust.

What "NFBRK only" means for the system:

- The AWB-universe gate (§3.3) admits only AWBs whose `clearance_type` is
  `nfbrk`.
- The reply classifier (§4) and reminder ladder (§7) run only for NFBRK cases.
- A FEBRK reply that reaches the system still lands in **human review** (never
  auto-replied) — the safe default, just not automated yet.
- `resolveClearanceType` (`src/lib/cases/clearance-type.ts`) already maps the
  Excel values, so nothing in the pipeline changes for V2 — we just widen the
  gate to admit `febrk*` later.

***

## 2. The two-phase model

```Go
PHASE 1 — PRE (clearance-fill, REUSED)          PHASE 2 — POST (THIS SYSTEM)
────────────────────────────────────            ───────────────────────────────
Team uploads the pre-alert Excel                     customer reply arrives
       │                                                     │
       ▼                                                     ▼
autofill via 36K master (fuzzy/direct)           Power Automate "new email" trigger
       │                                                     │
       ▼                                                     ▼
remaining blank → Bolna AI voice call            POST /api/pa/inbox/ingest (full body)
       │                                                     │
       ▼                                                     ▼
dashboard + Excel export                          AWB gating (in universe?)
       │                                                     │
       ▼                                                     ▼
team runs their local send script                 ensemble classify (rules+RAG+LLM)
       │                                                     │
       ▼                                                     ▼
AWB marked pre_alerted/awaiting_reply             route → auto-reply | draft | human
       │                                                     │
       └──────────────── AWB UNIVERSE ────────────►           │
                                                              ▼
                                                    send via Power Automate (Outlook)
                                                              │
                                                              ▼
                                                    tracked + Excel export
```

The output of Phase 1 is the **list of AWBs the team already pre-alerted**.
Phase 2 only ever acts on those AWBs.

***

## 3. Reply intake & AWB gating

### 3.1 Trigger

Power Automate owns the shared mailbox (the team's sanctioned Microsoft path).
Flow `PA_ReplyIntake` fires on **"When a new email arrives"** and pushes the
message to the web app:

```
POST /api/pa/inbox/ingest
Content-Type: application/json
X-API-Key: <PA_API_KEY>

{
  "messageId": "<CAABC123@mail.fedex.com>",
  "subject": "Re: Pre Alert - 874284953656 / JAIN GEMS INTERNATIONAL LLP",
  "from": "billing@jewels.com",
  "to": ["prealert.delhi@fedex.com"],
  "cc": [],
  "textBody": "Please send invoice and packing list. Thanks.",
  "htmlBody": null,
  "inReplyTo": "<PREALERT-0001@mail.fedex.com>",
  "references": ["<PREALERT-0001@mail.fedex.com>"],
  "receivedAt": "2026-08-07T10:30:00Z",
  "attachments": [{ "name": "invoice.pdf", "sizeBytes": 10240 }]
}
```

The backend (`src/lib/email/ingest-email.ts`) is the single ingestion path and
is already idempotent by `message_id` — retries are safe.

### 3.2 AWB extraction

`src/lib/email/awb-extract.ts` extracts a contiguous 12–15 digit AWB from
subject + body + (html-stripped) body. The subject line carries the AWB in
almost every pre-alert reply (`Re: Pre Alert - 874284953656 / …`).

### 3.3 The AWB universe gate (the rule)

> **A reply is auto-processed ONLY if its AWB is in the pre-alerted universe.**

- **Universe =** AWBs from the uploaded clearance-fill sheets that the team
  marked as sent (i.e. `awb_cases` rows that exist AND belong to a
  pre-alerted batch). In **V1 the universe is further restricted to
  `clearance_type = nfbrk`** (§1.4); `febrk*` / `calling` / `hold` replies fall
  straight to human review.
- **AWB known + pre-alerted + nfbrk** → run classification (§4).
- **AWB known but NOT pre-alerted** (e.g. an old case) → **human review** —
  never auto-replied, but still surfaced so nothing is dropped.
- **No AWB found** (reply didn't quote one) → **human review**, with the email
  stored so a human can link it manually.

This is what "only deal with the rows our team has" means. No orphan
auto-replies to AWBs we never sent.

### 3.4 Reply-to-thread awareness

`inReplyTo` / `references` are stored on `email_events`. When the AI replies,
the same values are reused so the reply lands **in the same conversation** —
never a new email.

***

## 4. Classification pipeline (ensemble)

The engine in `src/lib/ai/classify.ts`. Three signals, one decision.

### 4.1 Layer 1 — deterministic rules (fast path)

Confident, routine patterns short-circuit the slow ML/LLM steps (\~1–2 s):

| rule example             | keywords                                          | route                                        |
| ------------------------ | ------------------------------------------------- | -------------------------------------------- |
| `out_of_office` / bounce | "out of office", "delivery failed", "undelivered" | `ignore` (silent)                            |
| `docs_request`           | "invoice", "packing list", "boe"                  | draft / auto (nfbrk)                         |
| `shipment_info_request`  | "status", "tracking", "where is", "freight"       | draft / auto (nfbrk)                         |
| `escalation`             | "escalate", "supervisor", "manager", "complaint"  | `human_review`                               |
| `urgent_time_sensitive`  | "urgent", "asap", "emergency", "deadline"         | `human_review` (unless quoted template text) |

Urgency recalibration: words that appear in the **quoted pre-alert template**
(deadline, penalty, asap) do not block auto-send — only genuine
escalation/legal/critical signals do.

### 4.2 Layer 2 — RAG vector lookup (similar past replies)

Embedding of `subject + body` → `match_similar_emails` pgvector search →
top-K past replies (optionally filtered by clearance\_type / intent). Used both
for classification voting and to ground the drafted reply. See §5.

### 4.3 Layer 3 — LLM verifier (Gemini)

Runs only when rules + vectors don't fully agree. Returns structured JSON
(clearance\_type, intent, urgency, response\_type, reasoning, flags).

### 4.4 Policy router — final route

| route           | meaning                                       | reply send                    |
| --------------- | --------------------------------------------- | ----------------------------- |
| `ignore`        | OOO / bounce / machine noise                  | none                          |
| `ai_auto_send`  | safe, routine, high confidence                | **Power Automate sends** (§6) |
| `ai_draft_hold` | good but needs approval                       | operator approves → PA sends  |
| `human_review`  | unknown AWB / safety / legal / low confidence | human writes + sends          |

Every classification is logged to `ai_classifications` (rules matches, ML
prediction, LLM output, confidence, latency) — this log is also the RAG
feedback loop (§5.5).

***

## 5. RAG / training-data architecture

### 5.1 Concept

The classifier and the draft generator are **retrieval-grounded**: for a new
reply, we fetch the most similar *past* replies (and the best-matching
template) and use them as few-shot context. Quality = quality of the labeled
corpus.

```
                ┌────────────────────────────────────────────┐
                │              LABELED CORPUS                │
                │  emails (body+labels) + templates          │
                │  pgvector embeddings (Gemini)              │
                └───────────────────┬────────────────────────┘
                                    │  embed(subject+body)
                                    ▼
new reply ──► match_similar_emails ──► top-K similar (filtered by
                                         clearance_type/intent)
                                    │
                                    ├──► classifier few-shot voting (4.2)
                                    └──► draft generation context (6.1)
```

### 5.2 Step 1 — Extract history (VBA, already built)

The `.bas` scripts export past mail bodies + replies from Outlook:

- **`scripts/awb_email_finder.bas`** — paste AWBs + date range, pick folders
  (Inbox/Sent Items pre-selected), run search → **"Search Results"** sheet with
  full body per match (AWB, Subject, To, CC, Body, From, Received, Folder).
  Header comment states it is built "to train the RAG / email-classifier model."
- **`scripts/outlook_awb_extractor.bas`** — alternative extractor → "Extracted
  Data" sheet + **CSV on desktop** (MessageID, Subject, Sender, To/CC, Received,
  Folder, Body, Attachments). See `docs/OUTLOOK_AWB_EXTRACTOR_GUIDE.md`.

Target: **100–300 (AWB, reply body) pairs** from the last 1–2 weeks is enough
to start; grow continuously.

### 5.3 Step 2 — Label (manual, by the team)

Use the exported Excel/CSV and label each reply:

| column                  | values                                                               |
| ----------------------- | -------------------------------------------------------------------- |
| `clearance_type`        | nfbrk / febrk / febrk-jeena / febrk-sunimpex / calling / hold        |
| `intent`                | inquiry / update / escalation / confirmation / docs\_request / other |
| `urgency`               | low / normal / high / critical                                       |
| `response_type`         | acknowledge / provide\_info / request\_docs / escalate / no\_action  |
| `good_reply` (optional) | the actual reply the team sent, if one exists                        |

This matches the long-format CSV already specified in
`docs/AI_IMPLEMENTATION_GUIDE.md §2.3`:

```csv
awb,message_id,subject,body_clean,sender_email,to_addr,cc_addr,received_at,folder,has_attachments,clearance_type,intent,urgency,response_type
874284953656,<m1@fedex.com>,"Re: Pre Alert...","Please send invoice...",billing@jewels.com,prealert.delhi@fedex.com,,2026-08-01 10:30:00,Inbox,TRUE,nfbrk,docs_request,normal,request_docs
```

The labeling can happen in the exported sheet, or (later) in a small in-app
labeling screen. The column set is the same either way.

### 5.4 Step 3 — Store + embed (existing infra)

- Labeled rows land in the `emails` / `email_events` training store with a
  `VECTOR` embedding (Gemini, via `src/lib/ai/embed.ts`).
- `match_similar_emails` RPC does cosine similarity search
  (`match_threshold`, `match_count`, optional `filter_clearance_type` /
  `filter_intent`).
- `src/lib/ai/rag.ts` already implements the retrieval + best-template lookup.

A seed script takes the labeled CSV → upserts rows → embeds → indexes. Run once
to bootstrap, then incrementally.

### 5.5 The continuous loop

1. Every live reply is classified and logged (`ai_classifications`).
2. Human-review corrections and **approved/edited drafts** are written back to
   the corpus (`labeled_by = 'human'` / `'reviewer'`).
3. A daily/weekly job re-embeds new rows and re-runs a small **gold-set
   evaluation** (accuracy by class) — reported on the dashboard (§8).
4. Poorly performing classes get more labeled examples → retrieval improves →
   auto-send confidence improves over time.

***

## 6. Reply generation & send

### 6.1 Grounded draft generation

`src/lib/ai/draft.ts` + `src/lib/ai/rag.ts`:

- Retrieves top-K similar past replies + the best matching template
  (filtered by clearance\_type).
- Injects the **real shipment facts** for the AWB (from `shipment_data` /
  `src/lib/ai/shipment-context.ts`): freight, DO charges, IGM, origin/dest,
  pieces, weight — so the reply is grounded, never invented.
- Flags `low_confidence_draft` / `missing_variables` when it can't ground the
  reply → forces human review instead of auto-send.

### 6.2 Send decision — Power Automate via Outlook

The team's mailbox path is Power Automate. The web app never touches
SMTP/Graph for replies.

```
AI/operator produces reply for case
        │
        ▼
web app writes pa_reply_jobs row
   { caseId, awb, to, subject, body_html, inReplyTo, references,
     status: pending }
        │
        ▼
PA_ReplySend flow (recurrence ~2 min, or pushed)
   → GET /api/pa/replies/pending   (claims with short lease)
   → Send an email (V2) via Outlook from shared mailbox
   → POST /api/pa/replies/report   {jobId, messageId, accepted, rejected}
        │
        ▼
backend: mark sent → email_events(outbound, threaded) → case update
         → audit log
```

Contracts mirror the outbound blueprint (§6.1–6.3 of
`POWER_AUTOMATE_BLUEPRINT.md`), just scoped to reply jobs:

- `GET /api/pa/replies/pending?limit=N` — next reply emails to send.
- `POST /api/pa/replies/report` — `{jobId, messageId, accepted, rejected}`;
  idempotent per jobId (a retry on a `sent` job is a no-op).
- Routing to a human review instead: the operator approves a draft in the app,
  which creates the `pa_reply_jobs` row; auto-replies do the same
  automatically.

### 6.3 Cases that close themselves

- `ai_auto_send` reply sent + accepted → case `auto_replied=true`,
  `auto_closed=true`, status `closed`.
- Draft approved + sent → status updated, `case_updates` row with the draft id.
- Human-reviewed reply sent manually → status updated by the operator.

***

## 7. No-reply reminder ladder (who never replied)

After a pre-alert is sent, not everyone replies. This section tracks **every AWB
that has never replied** and drives a reminder ladder — first reminder, second,
…, final — until a reply lands or the case escalates/closes. It is **not** the
post-intelligence reply classification; it is the escalation side of the same
post-send lifecycle.

The engine already exists and is reused as-is:

| piece                            | where                                                                                                                       |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| ladder policy per clearance type | `TRIGGER_TEMPLATES` in `src/lib/ai/followup.ts`                                                                             |
| scheduled jobs                   | `followup_schedules` (trigger\_rule, attempt\_number, max\_attempts, scheduled\_at)                                         |
| run loop                         | cron `GET /api/cron/process-reminders` → `getCasesDueForFollowUp` (`src/lib/reminders/scheduler.ts`, polls `reminder_jobs`) |
| send                             | `send-reminder` (level 1, bumps `reminder_count`) / `send-final-reminder` (level 2, sets `final_reminder_sent`)             |
| state                            | `awb_cases.current_status = awaiting_reply`; the ladder auto-cancels the moment a reply flips the status                    |

### 7.1 The NFBRK ladder (mirrors the team's actual template mails)

The ladder follows the mail sequence the team already sends every day. The
source templates live in the repo — `Template/NFBRK/nfbrk.md` and
`Template/POST/…` — so the flow is read straight from them:

| step                                          | what fires                                                                                                                                        | source template                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| **Pre-Alert** (Day 0, arrival)                | "CARGO ARRIVAL NOTICE → Pre Alert \| TRK NO : {AWB} \| NFBRK" — PFA AWB/CI in `.tiff`, file BOE in advance, clearance docs within 3 h, DO process | `Template/NFBRK/nfbrk.md`, `Template/POST/cargo arrival notice pre alert/mail.md` |
| **IGM mail** (Day 0, once MAWB/IGM generated) | "Shipment has arrived at Delhi Port in Cargo Mode" — HAWB/MAWB, pcs, weight, "pay DO charges today"; ICEGATE-failure variant says monitor AIRIGM  | `Template/POST/script for IGM send/mail.md`                                       |
| **Same-day DO mail** (Day 0)                  | "Please collect the DO … by end of today to avoid the ₹1180/- admin fee"                                                                          | `Template/POST/1st mail of same day after igm generation/mail.md`                 |
| **Reminder 1** (Day 1)                        | "First Reminder — DO still pending, collect by end of today"                                                                                      | `Template/POST/1st day reminder mail/first day reminder mail.md`                  |
| **Reminder 2** (Day 2)                        | "File Bill of Entry by your CHA — DO charges 4248/- per shipment"                                                                                 | `Template/POST/second day/mail.md`                                                |
| **Final / escalate** (Day 3)                  | no reply after final → escalate to lead                                                                                                           | `escalation_2h` rule                                                              |

Notes on the ladder:

- Only the **reminder steps** (Reminder 1 → Reminder 2 → Final) are automated by
  this system. The Pre-Alert, IGM, and same-day-DO mails are milestone sends the
  team makes anyway (they are logged as `email_events` and flip the case
  state, but are not part of the *never-replied* chase).
- In code this maps to the existing `nfbrk_24h` rule in
  `src/lib/ai/followup.ts`: **24 h between attempts, max 3 attempts**.
  Attempt `max_attempts - 1` is the **final reminder**
  (`reminder_level = 2`, `send-final-reminder`); the attempts before it are
  ordinary reminders (`reminder_level = 1`).
- `febrk*`, `calling`, `hold` are outside the V1 ladder (§1.4) — only `nfbrk`
  cases are admitted.

### 7.2 Who counts as "never replied"

An AWB is on the never-replied tracker when all of:

- part of the pre-alerted AWB universe (same gate as §3.3),
- `current_status = awaiting_reply`,
- no reply `email_events` row for that AWB since the pre-alert was sent,
- a `reminder_jobs`/`followup_schedules` row exists with
  `status = pending` (or all attempts exhausted → moved to escalate/close).

The tracker query feeds the "Never replied" panel:

```
AWB | Consignee | Pre-alerted at | Days open | reminder_count |
last_reminder_at | final_reminder_sent | Next reminder due | Next action
```

### 7.3 The run loop (existing, reused)

1. Pre-alert send finalizes → case `awaiting_reply` + `followup_schedules` row
   seeded with the trigger rule for its `clearance_type`
   (`getTriggerRuleForClearance`).
2. `process-reminders` (recurrence) picks due `reminder_jobs`:
   - **not** `awaiting_reply` → `skipped` (a reply already arrived — ladder
     self-cancels, so late reminders never fire),
   - else → `send-reminder` / `send-final-reminder` → marks `sent`/`failed`.
3. Reminder body/subject are template emails (no AI needed); they bump
   `reminder_count` and write a `case_updates` row so the timeline shows it.

### 7.4 Sending reminders under the PA-only mailbox

Same constraint as replies (no SMTP in the app). Two options:

- **Recommended:** route reminders through the same `pa_reply_jobs` send path
  as replies. Add `kind` (`reply` / `reminder`) + `reminder_level` to the job;
  `PA_ReplySend` sends them identically via Outlook and reports back, then the
  backend bumps `reminder_count`/`final_reminder_sent`. One send pipeline for
  everything.
- Fallback: keep the existing cron + send-reminder SMTP path if a mailbox
  credential becomes available.

### 7.5 Escalation & closure after the ladder

- After the **final reminder** with no reply → reuse `escalation_2h`: notify the
  lead/reviewer (Teams), set `current_status = escalated` so it stops
  generating reminders.
- After N days post-final still silent → **close as** **`no_reply_closed`** on
  operator confirmation. The AWB leaves the never-replied tracker but its
  history (all reminder levels + dates) stays in the export.

### 7.6 No-reply tracker on the dashboard + export

- `/cases` gains a **"Never replied"** panel: AWB, consignee, pre-alerted at,
  days open, reminder count, last reminder, final reminder flag, next due, with
  Escalate / Close actions.
- Excel export (`POST /api/cases/export-replies`) adds reminder columns so the
  weekly record answers *"who never replied and how many reminders did we send"*:

```
AWB | … | Reminder 1 at | Reminder 2 at | … | Final reminder at | No-reply days | Next action
```

***

## 8. Dashboard + Excel export

### 8.1 Reply intelligence dashboard

One screen (`/cases` + a reply queue) showing:

- **Replies today** (count, by route: auto-sent / draft / human / ignored).
- **Drafts to approve** (linked to the drafts review queue).
- **Human-review queue** (unknown AWB, safety, low confidence) with reasons.
- **AI-handled %** (auto-classified + auto-replied vs total).
- **Per-case view** (AWB, sender, subject, intent, route, confidence, draft
  status, timeline, email thread).
- **Unknown-AWB inbox** — replies that did not match the pre-alerted universe,
  so nothing is ever dropped silently.
- **Never-replied tracker** (§7.6) — AWBs that have not replied, with reminder
  level sent, dates, and next action.

### 8.2 Excel export (team's format)

Mirror the existing clearance-fill export
(`/api/clearance-fill/[id]/export`, `download-excel`):

```
POST /api/cases/export-replies   →   .xlsx

AWB | Consignee | Sender | Subject | Received | Intent |
Urgency | Route | Confidence | Draft status | Action taken | Sent at
```

The **"Action taken"** column is the money column — it proves what the AI did
(no\_action / auto\_sent / draft\_pending / draft\_sent / human\_review / sent\_manually)
and feeds weekly reporting.

***

## 9. Power Automate flows

| flow                | trigger                                   | purpose                                                                        |
| ------------------- | ----------------------------------------- | ------------------------------------------------------------------------------ |
| **PA\_ReplyIntake** | When a new email arrives (shared mailbox) | cheap junk pre-filter → `POST /api/pa/inbox/ingest` → notify on `actionNeeded` |
| **PA\_ReplySend**   | Recurrence (\~2 min)                      | claim `pa_reply_jobs` → send via Outlook → report result                       |

### 9.1 `PA_ReplyIntake`

```
Trigger: When a new email arrives in {SHARED_MAILBOX_ADDRESS}
  → Condition: from ends '@fedex.com'                        → terminate (internal)
  → Condition: subject/body contains 'out of office'|'auto-reply'|
               'delivery failure'|'bounce'                   → terminate (junk)
  → HTTP POST {APP_API_BASE_URL}/api/pa/inbox/ingest
        (full body fields from §3.1, X-API-Key header)
  → Switch on response.actionNeeded:
        'review_draft'  → notify reviewer with case link
        'human_review'  → notify lead + reviewer with case link
        default         → nothing (ignore / auto_sent / duplicate)
```

### 9.2 `PA_ReplySend`

```
Trigger: Recurrence every 2 minutes
  → HTTP GET {APP_API_BASE_URL}/api/pa/replies/pending?limit=10
        X-API-Key header
  → Apply to each job:
        → Send an email (V2) via Outlook from shared mailbox
              To/Subject/Body(HTML) from job
        → HTTP POST /api/pa/replies/report
              { jobId, messageId, accepted, rejected }
  → On error: POST report with rejected:[to]  → backend retries/expires
```

### 9.3 Environment variables

| variable                 | purpose                      |
| ------------------------ | ---------------------------- |
| `APP_API_BASE_URL`       | web app base URL             |
| `PA_API_KEY`             | `X-API-Key` on every call    |
| `SHARED_MAILBOX_ADDRESS` | Outlook send/trigger mailbox |

***

## 10. End-to-end walkthrough (operator's day)

1. **Morning:** a fresh pre-alert Excel arrives. Operator uploads it in
   `/clearance-fill`. Autofill fills \~50–85% from the 36K master (fuzzy +
   direct match).
2. **Calls:** remaining blanks → "Initiate calls" → Bolna AI calls consignees
   in Hinglish ("clearance apne CHA se karwaoge ya FedEx ke CHA se? Jeena ya
   Sunimpex?") → webhook writes clearance\_type → master DB learns.
3. **Export & send:** operator downloads the Excel, runs the team's local send
   script. AWBs are now pre-alerted → part of the AWB universe.
4. **Replies arrive** through the day → `PA_ReplyIntake` pushes each to the
   web app. The classifier (**NFBRK cases only in V1, §1.4**):
   - drops bounces/OOO silently,
   - auto-replies routine invoice/status queries (grounded in shipment facts),
     sending via `PA_ReplySend`,
   - holds drafts for approval,
   - routes unknown-AWB / FEBRK / escalations / legal to human review with a
     reason.
5. **Operator** reviews the drafts queue, approves/rejects in the app, and
   watches the dashboard. Anything urgent pings them via Teams.
6. **Reminders** fire all day for silent AWBs (per §7): first, second, …, final
   reminder, each logged on the timeline. When a reply finally arrives the
   ladder self-cancels.
7. **End of day:** review the **Never-replied** panel — escalate or close the
   silent AWBs — then export the replies outcome sheet (AWB + action taken +
   reminder history) for the team record. Nothing slips — every reply and every
   reminder has a decision + audit trail.

***

## 11. Rollout checklist

**Bootstrap RAG (week 1)**

- [ ] Run `scripts/awb_email_finder.bas` over last 1–2 weeks (Inbox + Sent
  Items) → export bodies by AWB.
- [ ] Label 100–300 rows (clearance\_type / intent / urgency / response\_type /
  good\_reply) per `AI_IMPLEMENTATION_GUIDE.md §5`.
- [ ] Seed script: labeled CSV → `emails` store → embed → index →
  `match_similar_emails` ready.
- [ ] Run a small gold-set eval; confirm retrieval returns sensible pairs.

**Backend**

- [ ] Confirm `/api/pa/inbox/ingest` (already built) + `X-API-Key` guard.
- [ ] Add AWB-universe gating in `ingest-email.ts` (unknown → human review);
  **V1: admit only** **`clearance_type = nfbrk`, everything else → human
  review** (§1.4).
- [ ] Add `pa_reply_jobs` table + `GET /api/pa/replies/pending` +
  `POST /api/pa/replies/report` + approval→enqueue.
- [ ] Add `/api/cases/export-replies` Excel export.
- [ ] Confirm reminder ladder jobs are seeded on pre-alert send
  (`followup_schedules` + `reminder_jobs` per §7.1) and that `process-reminders`
  skips cases whose reply already arrived.
- [ ] Add `kind`/`reminder_level` to `pa_reply_jobs` so `PA_ReplySend` sends
  reminders too; bump `reminder_count`/`final_reminder_sent` on report.
- [ ] Add "Never-replied" panel + Escalate/Close actions + reminder columns in
  the export.
- [ ] `npx tsc --noEmit` + build clean.

**Power Automate**

- [ ] Create `PA_ReplyIntake` + `PA_ReplySend` in a solution with
  connection references + env vars.
- [ ] Connect shared mailbox; mirror `PA_API_KEY`.
- [ ] Test end-to-end with a real reply.

**Acceptance**

- [ ] Reply to a pre-alerted AWB → case appears + timeline row in < 1 min.
- [ ] Routine query auto-replies via Outlook, threaded in the same conversation.
- [ ] Unknown AWB → human review (never auto-replied).
- [ ] Pre-alerted AWB with no reply → Reminder 1, Reminder 2, Final Reminder
  fire on schedule; reply arrival cancels the remaining ladder.
- [ ] Export shows every reply + action taken + reminder history.

