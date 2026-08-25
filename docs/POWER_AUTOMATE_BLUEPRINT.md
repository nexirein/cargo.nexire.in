# Power Automate Blueprint — Cargo Pre-Alert + Follow-up Operations

Version 1.1 · For the FedEx Delhi IGI Operations team · Companion to `fedex_prealert_followup_claude_spec.md`

> **Read this first:** the reply-classification decision (where the AI runs —
> web app vs Power Automate "post-intelligence") is analysed fully in **§9**.
> The recommended answer is a hybrid: Power Automate cheaply pre-filters junk,
> the web app is the authoritative classifier. No code was built; this document
> is the design.

---

## 1. Why this design exists

The Cargo Pre-Alert platform replaces an Excel + Outlook process. The web app
already does the heavy lifting (sheet upload, validation, master-data autofill,
AI voice calls, reply classification, drafts, case tracking). The remaining
problem is **Microsoft mailbox plumbing**:

- The team cannot hand SMTP/IMAP credentials or set up a Graph API Azure AD app
  for an external service (FedEx security policy).
- Power Automate **is** sanctioned — the team can connect their Outlook /
  Microsoft 365 accounts through approved connectors in minutes.

So we split responsibilities:

> **Power Automate is the mailbox hands.** It listens to the shared mailbox,
> sends emails through the Outlook connector, and drives scheduled follow-ups —
> all under the team's own Microsoft accounts.
>
> **The web app is the brain.** It owns data, AI decisions, case ownership,
> dashboards, and every API Power Automate calls. Nothing is pivoted away —
> voice calling, mail classification, drafts, human review all stay.

---

## 2. System diagram

```text
                         ┌──────────────────────────────────────────────┐
                         │            WEB APP (Vercel + Supabase)       │
                         │                                              │
                         │  Upload / validate / TIFF→PDF / autofill     │
                         │  AI classifier + drafts + human review       │
                         │  Vapi/Bolna voice calls (clearance confirm)  │
                         │  Cases + KYC ownership + DO payment          │
                         │  Dashboards + exports                        │
                         │                                              │
                         │  PA API endpoints (X-API-Key guarded):       │
                         │   POST /api/pa/inbox/ingest                  │
                         │   GET  /api/pa/outbound/pending              │
                         │   POST /api/pa/outbound/report               │
                         │   GET  /api/pa/attachments/:id               │
                         │   GET  /api/cases/due-followups              │
                         │   POST /api/pa/reminder/report               │
                         └───────────────▲───────────────▲──────────────┘
                                         │               │
                        (push) POST to PA │               │ (poll) HTTP
                        HTTP trigger on   │               │ every 2–5 min
                        "Launch batch"    │               │
                                         │               │
              ┌──────────────────────────▼───────────────▼──────────────────────┐
              │                POWER AUTOMATE (FedEx M365)                       │
              │                                                                  │
              │  PA_SendPreAlert      ── Outlook connector → shared mailbox      │
              │  PA_ReplyIntake       ── new-mail trigger → shared mailbox       │
              │  PA_NoReplyScheduler  ── recurrence → reminders                  │
              │  PA_AIDraftApproval   ── (optional) Outlook/Teams approvals      │
              │                                                                  │
              │  On-premises gateway → local invoice folder → attach before send │
              └───────────────▲─────────────────────────────────────────────▲───┘
                              │                                             │
               consignee replies / bounces ─────────────────────────────────┘
```

---

## 3. Responsibility matrix

| Stage | Web app / backend (brain) | Power Automate (mailbox hands) |
|---|---|---|
| **Upload** | Excel upload, column mapping, row validation, master-data autofill | — |
| **Invoices** | TIFF→PDF conversion, AWB→filename matching, optional Supabase Storage | Attach local file at send time (gateway) or fetch signed URL |
| **Clearance confirm** | Vapi/Bolna voice call, webhook parses transcript, writes clearance_type | — |
| **SEND pre-alert** | Render template (nfbrk / febrk-jeena / febrk-sunimpex), enqueue outbox job, track status, dashboard | Send via Outlook from shared mailbox, return message_id + accepted/rejected |
| **Inbound replies** | `POST /api/pa/inbox/ingest` → AWB extract → classify → route (ignore / auto-send / draft-hold / human-review), update case, timeline, audit | New-mail trigger in shared mailbox → cheap junk pre-filter (§9.3) → push message metadata → notify/approval on `action_needed` |
| **Auto-send reply** | Generate grounded draft, mark auto_replied/closed | (optional) actually transmit reply via Outlook if driver requires |
| **Reminders** | `GET /api/cases/due-followups` returns due cases + rendered reminder | Recurrence flow pulls, sends via Outlook, reports result |
| **Human review** | Review queue, approve/reject drafts, ownership | Approval notifications via Outlook/Teams (optional) |
| **Voice calls** | Initiate Vapi/Bolna calls, land transcripts/results | — |

**Rule:** Power Automate never decides; it only moves mail and reports results.
Every decision, status change, and audit entry is written by the web app.

---

## 4. Data model change — `pa_outbound_jobs`

The web app renders the email and enqueues it. Power Automate polls, sends, and
reports. The outbox table is the contract between the two systems.

### Migration `0047_pa_outbound_jobs.sql`

```sql
create table pa_outbound_jobs (
  id uuid primary key default gen_random_uuid(),
  batch_item_id uuid references batch_items(id) on delete cascade,
  batch_run_id uuid references batch_runs(id) on delete set null,
  awb text not null,
  to_email text not null,
  cc_emails text[] not null default '{}',
  subject text not null,
  html_body text not null,
  attachment_file_name text,             -- matched invoice filename (e.g. 874284953656.pdf)
  attachment_storage_id uuid,            -- fallback: file_assets.id for Supabase fetch
  mailbox_address text,                  -- which shared mailbox should send this
  status text not null default 'pending'
    check (status in ('pending','in_progress','sent','failed','skipped')),
  message_id text,                       -- internet message id returned by PA/Outlook
  attempt_count int not null default 0,
  max_attempts int not null default 5,
  claimed_at timestamptz,                -- lease start for in_progress
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_pa_outbound_pending
  on pa_outbound_jobs(status, created_at);
create index if not exists idx_pa_outbound_batch
  on pa_outbound_jobs(batch_run_id);
create index if not exists idx_pa_outbound_awb
  on pa_outbound_jobs(awb);
```

### Send driver

`process-send-job.ts` gains a third driver: `MAIL_DRIVER=power_automate`.

Instead of calling `sendMailViaSmtp` / `sendMailViaGraph`, it:

1. Renders `{ subject, html, ccEmails }` exactly as today (same template +
   `buildRenderVariables` + `renderTemplate`).
2. Resolves the attachment: look up `file_assets` for the batch item; if a PDF
   exists, store its `id` in `attachment_storage_id` and its original name in
   `attachment_file_name`. Fixed template files (DO FORMAT.docx, BANK
   DETAILS.docx) are handled by PA via the gateway path too (see §8).
3. Writes one row into `pa_outbound_jobs` (`status='pending'`).
4. Sets `batch_items.send_status='queued'` and returns `{ status: 'sent' }`
   (queued-for-PA, not literally sent — the final flip happens on report).

SMTP/Graph drivers remain untouched for local dev and non-FedEx environments.

---

## 5. Auth model

All Power Automate-facing endpoints are guarded by a shared secret. No cookies,
no Supabase session — just an API key in the header.

```
X-API-Key: <PA_API_KEY>
```

- `PA_API_KEY` is an env var (Vercel) **and** a Power Automate environment
  variable, set to a long random string (`openssl rand -hex 32`).
- Middleware does **not** apply to these paths (they are server-to-server), so
  each PA route calls a helper:

```ts
// src/lib/pa/auth.ts
export function isPaAuthed(request: Request): boolean {
  const key = request.headers.get("x-api-key");
  const expected = process.env.PA_API_KEY;
  return !!expected && !!key && key === expected;
}
```

- `/api/vapi/webhook` and `/api/bolna/webhook` keep their own signature checks
  (unchanged).
- The browser app routes keep Supabase session auth (unchanged).

---

## 6. Backend API contracts

Base URL: `APP_API_BASE_URL` (e.g. `https://cargo-paf.vercel.app`).
All endpoints require `X-API-Key`.

### 6.1 `POST /api/pa/inbox/ingest` — new mail → classification

Already implemented as `/api/inbox/ingest`; add the API-key check. Power
Automate pushes every new message landing in the shared mailbox.

Request:

```json
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
  "attachments": [{ "name": "invoice.pdf", "storageUrl": null, "sizeBytes": 10240 }]
}
```

Response (200/201):

```json
{
  "status": "ingested",
  "emailEventId": "…",
  "caseId": "…",
  "classification": {
    "route": "ai_draft_hold",
    "clearanceType": "nfbrk",
    "intent": "docs_request",
    "urgency": "normal",
    "confidence": 0.92
  },
  "draftCreated": true,
  "actionNeeded": "review_draft"
}
```

`actionNeeded` values Power Automate can switch on:

| value | meaning | PA follow-up |
|---|---|---|
| `ignore` | OOO / bounce / no action | none |
| `auto_sent` | AI replied and closed the case | none |
| `review_draft` | AI draft is pending approval | notify reviewer / create approval |
| `human_review` | safety/legal/low-confidence | notify lead + reviewer |
| `duplicate` | already processed | none |

Dedupe is done in the backend by `message_id`, so PA can retry safely.

### 6.2 `GET /api/pa/outbound/pending?limit=10&mailbox=prealert.delhi@fedex.com`

PA calls this (push kick and poll fallback) to claim the next batch of emails
to send. Claims are marked `in_progress` with a 15-minute lease
(`claimed_at`), so two concurrent PA runs never double-send.

Response:

```json
{
  "jobs": [
    {
      "jobId": "uuid",
      "awb": "874284953656",
      "to": "billing@jewels.com",
      "cc": ["jeena.team@fedex.com", "prealert.delhi@fedex.com"],
      "subject": "Pre Alert - 874284953656 / JAIN GEMS INTERNATIONAL LLP",
      "htmlBody": "<html>…rendered template…</html>",
      "attachmentFileName": "874284953656.pdf",
      "attachmentStorageId": "uuid-or-null",
      "fixedFiles": ["DO FORMAT.docx", "BANK DETAILS.docx"]
    }
  ]
}
```

- `mailbox` filter lets multiple shared mailboxes each claim their own work.
- Empty response means nothing to send.

### 6.3 `POST /api/pa/outbound/report` — send result

PA calls after each email it attempted to send.

Request:

```json
{
  "jobId": "uuid",
  "messageId": "<PREALERT-874284953656@outlook.com>",
  "internetMessageId": "<PREALERT-874284953656@outlook.com>",
  "accepted": ["billing@jewels.com"],
  "rejected": [],
  "sentAt": "2026-08-07T10:35:00Z"
}
```

Backend on receipt:

1. Marks the outbox job `sent` with `message_id`, `sent_at`.
2. Flips `batch_items.send_status='sent'`, `send_completed_at=now()`.
3. Writes an `email_events` row (`direction='outbound'`, `message_id`,
   `internet_message_id`, `subject`, `body_clean`, `recipient_emails`).
4. Thread-links the case by AWB (reuse `linkCallToThread`/`findMatchingThreads`
   logic).
5. Writes `case_updates` (`update_type='pre_alert_sent'`, `actor_type='ai'`,
   `new_values={ jobId, message_id }`).
6. Logs audit `pa_outbound_reported`.

For failures PA sends `accepted: [], rejected: [...]` and the backend bumps
`attempt_count`; after `max_attempts` the job is `failed` and surfaces on the
send dashboard for manual requeue.

### 6.4 `GET /api/pa/attachments/:id` — fallback file fetch

Serves a stored PDF (from `file_assets.content`) with a short-lived signed
URL / streaming body. Used only when the local file is not found at the gateway
path (see §8).

### 6.5 `GET /api/cases/due-followups`

Already implemented; keep it. Power Automate's scheduler calls it to learn
which cases need a reminder/final reminder/escalation/call. Response shape
stays the same; add the API-key check.

### 6.6 `POST /api/pa/reminder/report`

PA confirms a reminder email was transmitted:

```json
{
  "caseId": "uuid",
  "reminderLevel": 1,
  "messageId": "<…>",
  "sentAt": "2026-08-07T11:00:00Z"
}
```

Backend marks `reminder_jobs` executed, bumps `reminder_count`, writes a
`case_updates` row, and audit-logs.

### 6.7 `POST /api/pa/push-trigger` — not a web-app endpoint, it's the PA trigger

This is the **push leg** of the hybrid send model. When a batch is launched
("Launch batch" / voice-confirmation auto-send), the web app calls the Power
Automate HTTP trigger URL:

```
POST {PA_SEND_TRIGGER_URL}
Body: { "batchRunId": "uuid", "mailbox": "prealert.delhi@fedex.com", "count": 87 }
```

PA responds 202 immediately, then runs `PA_SendPreAlert` → calls
`GET /api/pa/outbound/pending`. If the push ever fails, the **poll fallback**
(§7) picks the job up within 2–5 minutes — no message is ever stuck.

---

## 7. SEND flow — hybrid (push + poll)

```text
Sheet upload → validate → autofill → voice confirm (Vapi/Bolna)
        │
        ▼
  processSendJob(batchItemId)
        │   MAIL_DRIVER=power_automate
        ▼
  Render {subject, html, cc} + resolve attachment file name
        │
        ▼
  INSERT pa_outbound_jobs(status='pending')
        │
        ├── PUSH LEG ──────────────► POST {PA_SEND_TRIGGER_URL}  (Launch batch)
        │                                 │
        │                                 ▼
        │                           PA_SendPreAlert (HTTP trigger)
        │                                 │
        │                                 ▼
        │                     GET /api/pa/outbound/pending  → claims jobs
        │
        └── POLL LEG (fallback) ──► PA_SendPreAlert (Recurrence, every 5 min)
                                       │
                                       ▼
                          For each claimed job:
                           1. Resolve local invoice:
                              gateway "Get file content using path"
                              {INVOICE_FOLDER_PATH}\{attachmentFileName}
                              if not found → GET /api/pa/attachments/:id
                           2. Attach fixed files (DO FORMAT.docx, BANK DETAILS.docx)
                              from {TEMPLATE_FILES_PATH} via gateway
                           3. "Send an email (V2)" via Outlook connector
                              from mailbox_address
                           4. POST /api/pa/outbound/report  {jobId, messageId, accepted, rejected}
                                       │
                                       ▼
                          Backend: sent + email_events + case thread + audit
```

### Timing / throughput

- Push kick starts sending within seconds of launch.
- PA sends emails sequentially in a loop. At ~3–6 s per email through the
  Outlook connector, a 100-row batch finishes in **~5–10 minutes**, a 300-row
  batch in **~15–30 minutes**. If that is too slow, batch the loop with
  `Concurrency Control` (limit 5) in the Apply-to-each.

---

## 8. Attachments — local desktop files before sending

The invoices (TIFF→PDF) live with the operations team. Power Automate can
attach **local files** to the Outlook send. Two supported paths:

### 8.1 On-premises data gateway (recommended)

1. Install the **On-premises data gateway** on one office PC that can access
   the shared invoice folder (e.g. `\\fedexfile\PreAlert\Invoices\`).
2. Register it in Power Platform with a **gateway connection reference**.
3. In `PA_SendPreAlert`, before "Send an email (V2)":

   - **"Get file content using path"** action
     - Path: `{INVOICE_FOLDER_PATH}\{attachmentFileName}`
     - Gateway: the registered connection
   - Add its output to the email **attachments** (File Name + File Content).
4. Filenames are matched by AWB (`matchAttachmentsToAwbs`), so the flow picks
   `874284953656.pdf` for AWB `874284953656` automatically — the web app passes
   `attachmentFileName` on the job.

### 8.2 Power Automate Desktop (PAD)

If gateway is not allowed, the desktop robot runs on the operator's machine:

1. PAD flow triggered by the cloud flow (or its own trigger).
2. Reads `{LOCAL_FOLDER}\{attachmentFileName}` from the local drive.
3. Passes the file into the cloud flow to attach to the Outlook send.

### 8.3 Fallback (no local file)

If "Get file content using path" errors (file missing / renamed), the flow
calls `GET /api/pa/attachments/{attachmentStorageId}` and attaches the
Supabase-hosted copy. Uploaded PDFs therefore remain a safety net; the primary
path never uploads invoices to the internet.

### 8.4 Fixed template files

NFBRK sends include fixed files (DO FORMAT.docx, BANK DETAILS.docx). Their
filenames are returned on the job (`fixedFiles`). The flow attaches them from
`{TEMPLATE_FILES_PATH}` via the same gateway action, or from a shared
OneDrive/SharePoint folder if simpler.

---

## 9. REPLY CLASSIFICATION — end-to-end analysis

This is the heart of the system: **every reply that lands in the shared
mailbox gets classified, and the right action happens automatically.**

The trigger is always Power Automate (it owns the mailbox). The question is
**where the classification intelligence runs** — and the answer shapes the
whole flow. All options are documented below; the recommended one is Option C
(hybrid).

### 9.1 The default path (Option A — classify in the web app)

```text
Consignee replies → shared mailbox (prealert.delhi@fedex.com)
        │
        ▼
PA_ReplyIntake (trigger: "When a new email arrives" — Outlook connector)
        │
        ├─ (optional) cheap PA pre-filter: skip internal-only / OOO / bounces
        │         → keeps noise out, but is NOT the classifier
        │
        ▼
POST /api/pa/inbox/ingest
   {messageId, subject, from, to, cc, textBody, htmlBody,
    inReplyTo, references, receivedAt, attachments:[{name, storageUrl, sizeBytes}]}
        │   X-API-Key
        ▼
WEB APP — authoritative classification pipeline:
   1. Dedupe by message_id (retry-safe)
   2. AWB extraction (regex + thread matching + known templates)
   3. Thread / conversation linkage (inReplyTo + references)
   4. Deterministic rules layer (fast path)
        • duplicate thread / already processed
        • auto-response / OOO / bounce  → ignore
        • simple invoice request        → auto-send (nfbrk)
        • payment received              → update DO payment
        • escalation / legal keywords   → human_review
   5. LLM classifier (few-shot, only when rules don't fully decide)
        → issue_type, urgency, intent, confidence
   6. Policy router
        → route: ignore | ai_auto_send | ai_draft_hold | human_review
   7. Writes: ai_classifications + case_updates + awb_cases + audit log
        │
        ▼
Response to PA:
   { status, emailEventId, caseId, classification,
     actionNeeded: ignore | auto_sent | review_draft | human_review | duplicate }
        │
        ▼
PA switches on actionNeeded:
   ignore        → nothing
   auto_sent     → nothing
   review_draft  → notify reviewer (Teams/Outlook) with case link
   human_review  → notify lead + reviewer with case link
        │
        ▼
Operator/reviewer acts in the web app (cases / human-review / drafts pages)
```

**Why the web app is the classifier (not PA):** it has the master database
(36K company clearance history), the AWB case history, the few-shot prompt
bank, the safety gate, and the audit trail. Classification there is consistent,
retrainable, and explains itself — none of which a flow can provide.

### 9.2 Option B — "post-intelligence" in Power Automate

Power Automate **can** do classification itself using either:

- **AI Builder — Text classification** (trainable model inside Power Platform),
- **OpenAI / Azure OpenAI connector** (free-form prompt classification), or
- **simple conditions** (subject/from contains X).

What it looks like:

```text
New email → PA_ReplyIntake
        │
        ▼
PA classifies with AI Builder / OpenAI connector:
   "auto_response | invoice_request | status_query | escalation | other"
        │
        ▼
PA sends to web app → POST /api/pa/inbox/ingest  (already tagged)
   (web app still dedupes, extracts AWB, writes the case + audit)
```

**What PA-native classification is good for (post-intelligence):**

| good at | why |
|---|---|
| cheap pre-triage | drop obvious OOO/bounce/internal before hitting the backend |
| high-volume noise reduction | AI Builder model for "is this a real customer reply?" |
| simple, coarse buckets | invoice / status / escalation / other |
| no API cost pressure | per-flow model calls, credits you already have |

**What it canNOT replace (hard limits):**

| limit | consequence |
|---|---|
| no master DB access | cannot auto-fill clearance_type from 36K company history |
| no AWB case history | cannot know if this AWB is awaiting reply / already closed / paid |
| no few-shot prompt bank / labels | coarse buckets only, no per-class confidence routing |
| no safety gate / legal guardrails | risk of auto-answering an escalation or grievance |
| no training-data loop | classification quality can't improve from labeled history |
| per-model inconsistency | gpt-4 vs flow model drift; no single version control |

If a PA AI Builder model and the web app disagree, **the web app must win** —
it holds the source of truth. PA-native classification should therefore only be
a *filter before* the backend, never a *replacement for* it.

### 9.3 Recommended (Option C — hybrid)

```text
New email → PA_ReplyIntake
        │
        ▼
STEP 1 (in PA): cheap deterministic pre-filter — no AI needed
   • internal-only sender (fedex.com)        → skip
   • subject/body OOO, "auto-reply", "out of office", "bounce" → skip
   • To: not the shared mailbox              → skip
        │
        ▼
STEP 2 (in PA, optional): AI Builder "is this a real customer reply?" model
   • score < threshold (e.g. 0.85 auto/bounce/notification) → skip
   • else → forward
        │
        ▼
STEP 3 (authoritative): POST /api/pa/inbox/ingest → web app classifies
        │
        ▼
PA switches on actionNeeded → notify / approval / nothing
```

**Benefit:** 30–60% of inbox traffic (bounces, auto-replies, internal
notifications, delivery confirmations) is dropped in the flow with zero API
calls, while **every real customer reply is still classified by the web app** —
which has the DB, the safety gate, and the audit trail. The web app remains the
single source of truth; Power Automate just does the cheap "is this worth
classifying?" screening.

### 9.4 What PA sends the web app (exact field contract)

| field | required | source in flow | notes |
|---|---|---|---|
| `messageId` | yes | `triggerOutputs()['MessageId']` | dedupe key; strip `< >` |
| `subject` | yes | trigger subject | AWB often here |
| `from` | yes | trigger From | customer email |
| `to` | yes | trigger To (split `;`) | should include shared mailbox |
| `cc` | no | trigger Cc (split `;`) | |
| `textBody` | yes | trigger Body (text preview) | the reply content |
| `htmlBody` | no | full HTML if available | stripped server-side |
| `inReplyTo` | no | trigger InReplyTo | threading |
| `references` | no | trigger References (split `;`) | threading |
| `receivedAt` | no | trigger DateTimeReceived | |
| `attachments` | no | trigger Attachments list | name + size; OCR only if needed |

### 9.5 What the web app returns (decision contract for PA)

```json
{
  "status": "ingested",
  "emailEventId": "uuid",
  "caseId": "uuid",
  "classification": {
    "route": "ai_draft_hold",
    "clearanceType": "nfbrk",
    "intent": "docs_request",
    "urgency": "normal",
    "confidence": 0.92,
    "explanation": "docs_request → provide invoice + packing list; low risk"
  },
  "draftCreated": true,
  "actionNeeded": "review_draft"
}
```

`actionNeeded` → PA behavior:

| value | meaning | PA follow-up |
|---|---|---|
| `ignore` | OOO / bounce / no action | nothing |
| `auto_sent` | AI replied, case closed | nothing |
| `review_draft` | AI draft pending approval | notify reviewer / create approval |
| `human_review` | safety / legal / low confidence | notify lead + reviewer |
| `duplicate` | already processed | nothing (retry-safe) |

### 9.6 Inbound attachments (if a reply carries a document)

- PA lists attachment name + size; the web app stores the metadata.
- If OCR is ever needed (e.g. a scanned payment proof), the web app fetches the
  attachment via `GET /api/pa/attachments/:id` **after** the web app holds a
  copy — PA never does OCR itself.

### 9.7 Threading + auto-reply send

- The web app stores `inReplyTo`/`references` and reuses them when the AI
  auto-sends a reply, so the reply stays in the same conversation (never a new
  mail).
- If `MAIL_DRIVER=power_automate` and the AI decides `auto_send`, the backend
  writes an outbound job (same outbox, §7) and PA transmits it — so even AI
  replies go out through the sanctioned mailbox. The report flow (§6.3) closes
  the case.

### 9.8 Decision summary

| | Option A (web app) | Option B (PA intelligence) | Option C (hybrid) ✅ |
|---|---|---|---|
| Master DB autofill | ✅ | ❌ | ✅ |
| AWB case history | ✅ | ❌ | ✅ |
| Safety gate / guardrails | ✅ | ❌ | ✅ |
| Training loop / retrain | ✅ | ❌ | ✅ |
| Audit trail / explainability | ✅ | ⚠️ partial | ✅ |
| Drops noise before backend | ❌ (all traffic hits API) | ✅ | ✅ |
| Zero backend load for junk | ❌ | ✅ | ✅ |
| Operational simplicity | one brain | two systems to align | PA filters, web app decides |

---

## 10. REMINDERS flow

```text
PA_NoReplyScheduler (Recurrence: every 60 min)
        │
        ▼
GET /api/cases/due-followups?mailbox=…   (API-key guarded)
        │
        ▼
For each due case (Apply to each):
  ├─ first_reminder  → "Send an email (V2)" with rendered reminder
  │                    → POST /api/pa/reminder/report {caseId, reminderLevel:1, messageId}
  ├─ final_reminder  → same with reminderLevel:2
  ├─ escalate        → notify lead via Teams/Outlook (no email send)
  └─ call_needed     → notify operator to trigger a Vapi/Bolna call in the app
```

Thresholds (first reminder after X h, final after Y h, urgent SLA) are backend
policy env vars (`FIRST_REMINDER_HOURS`, `FINAL_REMINDER_HOURS`,
`URGENT_SLA_MINUTES`) — PA just executes what the backend returns.

---

## 11. VOICE CALLS flow (unchanged — not moved)

```text
Unresolved clearance (calling status)
        │
        ▼
Web app initiate-calls → Vapi (or Bolna) API → agent calls consignee in Hinglish
        │
        ▼
Webhook (/api/vapi/webhook, /api/bolna/webhook) → parse transcript
        │
        ▼
clearance_type = nfbrk | febrk-jeena | febrk-sunimpex
  → auto-select template → processSendJob → enqueue pa_outbound_jobs (if driver=power_automate)
        │
        ▼
master DB updated (company_clearance_master / broker_master) for next time
```

No change to the call stack; only the downstream send is re-routed to the
outbox.

---

## 12. Power Automate solution setup

Build everything inside a **Solution** so it deploys cleanly with connection
references and environment variables.

### 12.1 Solution contents

- 4 cloud flows (below)
- Connection references:
  - `Office 365 Outlook` (shared mailbox send/receive)
  - `HTTP with Microsoft Entra ID (preauthorized)` or `HTTP` (web app calls)
  - `On-premises data gateway` (local invoice files)
  - `Microsoft Teams` (optional, notifications)
  - `AI Builder` (optional, §9.3 reply pre-filter model)
- Environment variables (see 12.2)

### 12.2 Environment variables (defined in the solution)

| variable | example | purpose |
|---|---|---|
| `APP_API_BASE_URL` | `https://cargo-paf.vercel.app` | all API calls |
| `PA_API_KEY` | `openssl rand -hex 32` | `X-API-Key` header on all calls |
| `SHARED_MAILBOX_ADDRESS` | `prealert.delhi@fedex.com` | Outlook send/trigger mailbox |
| `INVOICE_FOLDER_PATH` | `\\fedexfile\PreAlert\Invoices\` | gateway file path for invoice PDFs |
| `TEMPLATE_FILES_PATH` | `\\fedexfile\PreAlert\FixedFiles\` | gateway path for DO FORMAT.docx etc. |
| `PA_SEND_TRIGGER_URL` | PA HTTP trigger URL | web app push-kick target |
| `POLL_INTERVAL_MINUTES` | `5` | recurrence fallback cadence |
| `REPLY_ACTION_BASE_URL` | `https://cargo-paf.vercel.app/cases` | links in notifications |

The same `PA_API_KEY` is mirrored into Vercel env vars.

### 12.3 Flows

| flow | trigger | purpose |
|---|---|---|
| **PA_SendPreAlert** | HTTP request (push) + Recurrence 5 min (poll fallback) | claim outbox jobs, attach files, send, report |
| **PA_ReplyIntake** | When a new email arrives (shared mailbox) | pre-filter junk (§9.3), push message to `/api/pa/inbox/ingest`, notify on action_needed |
| **PA_NoReplyScheduler** | Recurrence 60 min | pull `/api/cases/due-followups`, send reminders, report |
| **PA_AIDraftApproval** *(optional)* | When a HTTP request is received (backend calls on draft_created) | Outlook approval → approve → trigger send; reject → mark human review |

---

## 13. Flow-by-flow action detail

### 13.1 `PA_SendPreAlert`

```
Trigger A: When an HTTP request is received (POST)
   → Initialize variable BatchRunId = triggerBody()['batchRunId']
   → Delay 1 second  (let outbox writes flush)
   → Run subflow "SendPending"

Trigger B: Recurrence (every 5 minutes)
   → Run subflow "SendPending"

Subflow SendPending:
  → HTTP GET {APP_API_BASE_URL}/api/pa/outbound/pending?limit=10&mailbox={SHARED_MAILBOX_ADDRESS}
      Headers: X-API-Key: {PA_API_KEY}
  → Apply to each job in response['jobs']  (Concurrency Control: limit 5):
      → Initialize variable FileContent = null
      → Do until FileContent != null or attempts >= 1:
            → Get file content using path
                Path: {INVOICE_FOLDER_PATH}{job['attachmentFileName']}
                Gateway: <gateway connection>
              (on error → continue)
            → If not found:
                → HTTP GET {APP_API_BASE_URL}/api/pa/attachments/{job['attachmentStorageId']}
                  (file content body) → FileContent
      → Send an email (V2)
            Mailbox: {SHARED_MAILBOX_ADDRESS}
            To: job['to']
            Cc: job['cc']
            Subject: job['subject']
            Body (HTML): job['htmlBody']
            Attachments: FileContent (name = job['attachmentFileName'])
                        + fixed files from {TEMPLATE_FILES_PATH}
      → HTTP POST {APP_API_BASE_URL}/api/pa/outbound/report
            Body: { "jobId": job['jobId'],
                    "messageId": output('Send_email_v2')['body']['MessageId'],
                    "accepted": [ job['to'] ],
                    "rejected": [] }
            Headers: X-API-Key: {PA_API_KEY}
      → On error at any step:
            → HTTP POST /api/pa/outbound/report
              Body: { "jobId": job['jobId'], "accepted": [], "rejected": [ job['to'] ] }
```

### 13.2 `PA_ReplyIntake`

```
Trigger: When a new email arrives in {SHARED_MAILBOX_ADDRESS} (folder: Inbox)

  ── STEP 1: cheap deterministic pre-filter (Option C hybrid, §9.3) ──────────
  → Condition: From ends with '@fedex.com'                    → Terminate (internal)
  → Condition: Subject/body contains 'out of office' | 'auto-reply' |
               'automatic reply' | 'delivery failure' | 'undeliverable' | 'bounce'
                                              → Terminate (junk)
  → Condition: To does NOT contain {SHARED_MAILBOX_ADDRESS}  → Terminate (not ours)

  ── STEP 2 (optional): AI Builder "is this a real customer reply?" model ─────
  → Predict on { Subject + Body }
  → Condition: score < 0.85 (auto/bounce/notification)        → Terminate

  ── STEP 3: forward to web app for authoritative classification ─────────────
  → HTTP POST {APP_API_BASE_URL}/api/pa/inbox/ingest
        Body:
          messageId:  triggerOutputs()['MessageId']
          subject:    triggerOutputs()['Subject']
          from:       triggerOutputs()['From']
          to:         triggerOutputs()['To']          (split(';'))
          cc:         triggerOutputs()['Cc']          (split(';'))
          textBody:   triggerOutputs()['Body']        (plain text preview)
          htmlBody:   null
          inReplyTo:  triggerOutputs()['InReplyTo'] ?? null
          references: triggerOutputs()['References']  (split(';'))
          receivedAt: triggerOutputs()['DateTimeReceived']
          attachments: map triggerOutputs()['Attachments'] to
                        [{name, sizeBytes}]             (metadata only)
        Headers: X-API-Key: {PA_API_KEY}
  → Switch on body['actionNeeded']:
      'review_draft' → Send an email/Teams message to reviewer
                       "Draft ready: AWB {body['caseId']} — review in web app"
      'human_review' → Teams message to lead + reviewer with case URL
      default        → no action (ignore / auto_sent / duplicate)
```

The pre-filter (steps 1–2) is optional. It only reduces noise hitting the
backend — it never decides an action. Every real customer reply is still
classified by the web app (§9.1). If the AI Builder model is unavailable, skip
step 2 entirely; the backend rules handle the same junk cases anyway.

### 13.3 `PA_NoReplyScheduler`

```
Trigger: Recurrence every 60 minutes
  → HTTP GET {APP_API_BASE_URL}/api/cases/due-followups?mailbox={SHARED_MAILBOX_ADDRESS}
      Headers: X-API-Key: {PA_API_KEY}
  → Apply to each case:
      Switch on case['action']:
        'first_reminder'  → Send an email (V2) reminder
                             → POST /api/pa/reminder/report {caseId, reminderLevel:1, messageId}
        'final_reminder'  → Send an email (V2) final reminder
                             → POST /api/pa/reminder/report {caseId, reminderLevel:2, messageId}
        'escalate'        → Teams message to lead
        'call_needed'     → Teams message to operator (open /calls in app)
```

### 13.4 `PA_AIDraftApproval` *(optional)*

```
Trigger: When an HTTP request is received (backend calls on draft_created when actionNeeded=review_draft)
  → Start and wait for an approval
      Title: "Approve AI reply — {body['awb']}"
      Details: link to {REPLY_ACTION_BASE_URL}/{body['caseId']}
      Assigned to: reviewer
  → When approved:
      → HTTP POST {APP_API_BASE_URL}/api/ai/drafts/{draftId}/approve-and-send  (or equivalent)
  → When rejected:
      → HTTP POST {APP_API_BASE_URL}/api/ai/drafts/{draftId}/reject
```

(If approvals live in the web app instead, this flow is skipped — the web app
drafts page is the approval UI.)

---

## 14. Minimal web app (if a lightweight build is needed)

If deploying the full platform is too heavy, a **minimal build** ships these
modules only (same DB, same endpoints — Power Automate flows are identical):

1. **Upload + validate sheet** → rows become cases + outbox jobs.
2. **Mail ingest + AI classification** → `POST /api/pa/inbox/ingest`.
3. **Cases tracker** → list + detail (email thread, timeline, AI drafts panel).
4. **Drafts review + approve** → approve → enqueue outbox / send.
5. **Voice-call trigger + results** → initiate Vapi/Bolna, land results.
6. **One dashboard** → sent, replies, AI-handled %, slips.

Dropped to phase 2: TIFF converter polish, deep batch wizard, admin analytics,
reminders UI (PA drives reminders), templates UI.

---

## 15. Failure / retry / recovery matrix

| failure | detected by | action |
|---|---|---|
| PA poll misses a job | job stays `pending` past `created_at + 15 min` | push kick on next launch; poll picks it up; dashboard "stuck jobs" tile |
| Outbox job claim conflicts | `claimed_at` lease; status `in_progress` | pending endpoint skips `in_progress` jobs older than 15 min and reopens them |
| Email rejected by server | `rejected` in report | backend bumps `attempt_count`, requeues to `pending`; after `max_attempts` → `failed`, manual requeue button |
| Local invoice file missing | "Get file content using path" error | flow falls back to `GET /api/pa/attachments/:id` |
| `/api/pa/*` down | HTTP 5xx/timeout | PA retry policy (2 retries, 10 s apart); idempotency by `jobId`/`messageId` |
| Duplicate PA delivery | same `messageId` posted twice | backend dedupes by outbox `jobId` + `email_events.message_id` |
| Push trigger URL changes | web app gets non-2xx | log + rely on poll fallback (never blocks send) |

### Idempotency rules

- `POST /api/pa/outbound/report` is safe to retry: report on a `sent` job is a
  no-op.
- `POST /api/pa/inbox/ingest` is safe to retry: dedupe by `message_id`.
- `POST /api/pa/reminder/report` is safe: `reminder_jobs` idempotency by
  `case_id + reminder_level`.

---

## 16. Rollout checklist

**Backend (this repo)**
- [ ] Apply migration `0047_pa_outbound_jobs.sql`.
- [ ] Add `verifyPaApiKey()` and guard `/api/inbox/ingest`,
      `/api/cases/due-followups`, `/api/pa/outbound/pending`,
      `/api/pa/outbound/report`, `/api/pa/attachments/:id`,
      `/api/pa/reminder/report`.
- [ ] Implement `MAIL_DRIVER=power_automate` branch in `process-send-job.ts`.
- [ ] Implement push-kick on batch launch (call `PA_SEND_TRIGGER_URL`).
- [ ] Set env: `PA_API_KEY`, `PA_SEND_TRIGGER_URL`, `MAIL_DRIVER=power_automate`.
- [ ] `npm run build` + `npx tsc --noEmit` clean.

**Power Platform (team side)**
- [ ] Create solution; add 4 flows, connection references, env vars.
- [ ] Install on-premises data gateway on the office PC; register connection.
- [ ] Confirm `INVOICE_FOLDER_PATH` / `TEMPLATE_FILES_PATH` are reachable and
      files are named by AWB.
- [ ] Add shared mailbox `prealert.delhi@fedex.com` as an Outlook connection.
- [ ] Mirror `PA_API_KEY` into Power Automate env var.
- [ ] Publish flows; run `PA_SendPreAlert` manually once with a single test job.

**Test pass (before going live)**
- [ ] Push kick starts a 5-row batch within ~30 s.
- [ ] Poll fallback sends a job when the push was never fired.
- [ ] Local file attaches by AWB; fallback fires when file missing.
- [ ] Reply from consignee → `PA_ReplyIntake` → case appears + timeline row.
- [ ] AI draft → approval → send via outbox → reply threads in the same
      conversation.
- [ ] Reminder scheduler sends first/final reminder and updates the case.

---

## 17. Env var quick reference (this repo)

```bash
# .env.local / Vercel
MAIL_DRIVER=power_automate        # smtp | graph | power_automate
PA_API_KEY=<openssl rand -hex 32>
PA_SEND_TRIGGER_URL=https://<pa-http-trigger-url>   # push leg (optional)
FIRST_REMINDER_HOURS=24
FINAL_REMINDER_HOURS=72
URGENT_SLA_MINUTES=120
```

---

*Power Automate is the mailbox hands; the web app is the brain. Voice calling,
mail classification, drafts, human review, and case tracking all stay exactly
where they are today.*
