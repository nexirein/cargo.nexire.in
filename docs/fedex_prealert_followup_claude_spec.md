# FedEx Pre-Alert + Follow-up System Build Spec

## 1) Product overview

Build a production-grade **Cargo Pre-Alert and Follow-up Ecosystem** for a FedEx-style operations team using:

- **Next.js web app** hosted on Vercel
- **Supabase** for auth, Postgres, storage, and realtime
- **Power Automate** for Outlook-triggered workflows, scheduled follow-ups, approvals, and Microsoft-native orchestration
- **LLM + OCR services** behind backend APIs for classification, extraction, summarization, and draft generation
- **Redis** for queue coordination, rate limiting, locking support, idempotency, caching, and job state

This product replaces the current Excel + script + Outlook outbox process with a full operating system for:

1. Batch-wise pre-alert creation and tracking
2. Client-side TIFF-to-PDF conversion when needed
3. Fast queued outbound email sending
4. Live reply capture from a tagged mailbox
5. AWB-level case ownership and locking so two teammates never work the same follow-up simultaneously
6. AI triage into no-action / AI-draft / AI-send / human-review / reminder / final reminder / call-needed
7. Human review, reassignment, and audit trail
8. Admin analytics showing where work slipped, who owned what, and batch performance
   - important point: wherver power automate flow is needed in the processflow the api connet alll the things should be connected , have to guide me in .md file end to end in detail 

***

## 2) Core business requirements

### 2.1 KYC-style ownership model

The system must behave like a KYC work queue:

- An incoming reply or follow-up case becomes an **AWB case**.
- A teammate can **claim** that AWB for follow-up work.
- Once claimed, no other operator can actively work that case unless:
  - it is reassigned,
  - it is released,
  - or an admin/lead overrides.
- The owner of the case handles future replies, calls, and status updates by default.
- The owner can also **assign/tag another teammate** if needed.
- Every claim, release, assign, update, and close action must be logged.

### 2.2 Dynamic timeout / stale ownership

There is no simple fixed claim timeout. Staleness must be policy-driven using urgency and latest activity.

Use this design:

- Every case has `next_action_at` and `sla_due_at`.
- Every case also has `last_human_action_at`.
- A case is considered **slipping** when:
  - `now > next_action_at` and no update happened,
  - or `now > sla_due_at` and status is still open,
  - or an urgent case is untouched for a shorter urgency-based threshold.
- Admin dashboard must show:
  - slipped cases by owner,
  - slipped cases by team,
  - slipped cases by issue type,
  - average delay by operator,
  - reassignments after slip.

### 2.3 Batch-based pre-alert runs

The system must treat a pre-alert upload as a **batch / console / ubond run**.

Requirements:

- User can create a run with a custom name.
- UI should recommend a strong naming format, for example:
  - `PREALERT-YYYY-MM-DD-AM`
  - `PREALERT-YYYY-MM-DD-PM`
  - `PREALERT-YYYY-MM-DD-SEQ01`
- One uploaded Excel file may contain roughly 100–300 rows.
- One batch can be split internally into **sub-batches** for processing and send throughput.
- Admin dashboard must support filtering by:
  - run date
  - run name
  - mailbox
  - creator
  - status
  - total rows
  - sent success/failure
  - reply rate

### 2.4 Training / decision layer

Use last 1 week of pre-alerts and replies initially, and later expand to more history.

Important design choice:

- Do **not** start with model fine-tuning.
- Start with a **rules-first + few-shot LLM classification** layer.
- Historical mail examples are used to:
  - define labels,
  - define business conditions,
  - build few-shot examples,
  - evaluate accuracy,
  - improve prompts and routing.
- Low-confidence outputs must become **AI Suggested, Needs Approval** or **Human Review**.

***

## 3) User roles

### Admin

- Manage users, roles, mailboxes, templates, policies, prompts, • they can see analytics  how many ai mailed to the customers , and many other important matrix 
- View all runs and all cases
- Override locks and assignments
- View slip analytics and audit logs

### Team Lead

- View all team cases
- Reassign cases
- Approve AI drafts
- View urgent and slipping queues

### Operator

- Claim or receive assigned AWB follow-up cases
- Update status, remarks, call notes
- Review and send drafts if allowed
- Release or request reassignment

### Reviewer

- Only works human-review queue and approvals

### Viewer

- Dashboard and export only

***

## 4) Recommended technical architecture

### Frontend

- Next.js App Router
- TypeScript
- Tailwind CSS + component system
- React Query or SWR for client caching and queue screens
- Supabase auth client
- Realtime subscriptions for live case updates

### Backend

- Next.js route handlers / server actions for light orchestration
- Dedicated worker endpoints or separate worker service for heavy jobs
- Queue-backed processing for email send jobs and ingest jobs

### Data / infra

- Supabase Postgres
- Supabase Storage for file artifacts
- Supabase Realtime for live dashboard updates
- Redis for:
  - idempotency keys
  - send queue state
  - retry counters
  - distributed locks for short-lived processing locks
  - cache for dashboard aggregates
  - rate limiting

### Microsoft automation layer

- Power Automate cloud flows inside a **solution-aware** structure
- Use **environment variables** and **connection references** for deployable flow configuration
- Outlook connectors for inbox triggers and mail actions
- HTTP/API calls into the web app backend

### AI / document layer

- OCR endpoint for attachment text extraction
- LLM classifier endpoint
- LLM draft generator endpoint
- Optional summarizer endpoint for UI explanation cards

***

## 5) Why Power Automate + web app hybrid

### Power Automate is responsible for

- Listening to tagged/shared Outlook mailbox events
- Scheduled reminder and final-reminder checks
- Approval workflows
- Teams/Outlook notifications
- Microsoft-native mailbox actions
- Reliable orchestration around inbox events

### The web app is responsible for

- Batch creation and upload UX
- TIFF/PDF conversion UX
- Queue and case dashboard
- KYC-style claim / assign / release model
- Human review workspace
- Admin analytics
- Templates, prompts, policies, and team configuration
- Exportable master case table

### Rule

Power Automate should be the **workflow spine** for Microsoft events. The web app should be the **system of work** for users.

***

## 6) High-level flow

```text
Pre-alert batch upload
  -> validate rows
  -> match invoice files by AWB
  -> convert TIFF to PDF if needed
  -> create sub-batches
  -> enqueue outbound sends
  -> send mail via configured Outlook-connected path
  -> persist sent events + conversation metadata

Customer replies to tagged mailbox
  -> Power Automate trigger fires
  -> send subject/body/attachments metadata to backend
  -> extract AWB + normalize thread
  -> OCR attachments if needed
  -> classify with rules-first + few-shot LLM
  -> update AWB case
  -> if safe: AI draft or auto-send
  -> else: human-review / urgent queue / assign owner

Scheduled policy engine
  -> detect no reply / reminder due / final reminder due / stale owner / slip
  -> trigger reminder flow, escalation, reassignment suggestion, or call task
```

***

## 7) Detailed product modules

## 7.1 Auth + onboarding

### Initial auth

- Simple email + password using Supabase Auth
- Password reset flow
- Role stored in DB

### Post-login mandatory setup

After first login, user must configure Outlook details inside the app:

- display name
- operational mailbox email
- tagged/CC mailbox used for monitoring
- signature block
- timezone
- optional default templates

Store config in DB and verify connectivity through Power Automate / admin validation flow.

***

## 7.2 Batch pre-alert module

### User journey

1. Click `Create Batch`
2. Enter batch name or accept suggested naming
3. Select mailbox/configuration
4. Upload Excel
5. Map fields if template varies
6. Upload invoice folder/files or use prepared archive
7. See validation results
8. Convert TIFF to PDF if needed
9. Preview sample rows
10. Launch batch
11. Watch send progress live

### UI sections

- batch list page
- create batch wizard
- file validation step
- conversion step
- recipient preview step
- send progress page
- completed run summary page

### Batch states

- draft
- validating
- ready
- converting
- queued
- sending
- partially\_sent
- completed
- failed
- archived

### Sub-batch logic

For 100–300 rows, split internally into sub-batches for better progress visibility and retry handling.

Suggested default:

- sub-batch size: 25 or 50 outbound jobs
- each sub-batch gets its own progress and retry state

***

## 7.3 Client-side TIFF-to-PDF conversion module

This must be implemented exactly as a **client-side pipeline** with zero server upload required for conversion.

### Conversion Pipeline (Client-Side)

All TIFF-to-PDF conversion runs in the browser with zero server uploads:

`TIFF file -> utif.decode() -> RGBA pixel data -> Canvas API -> toBlob('image/jpeg') -> pdf-lib embedJpg() -> PDF`

- `utif` decodes TIFF, including multi-page TIFF, Group4 Fax, LZW, and related formats, into raw RGBA pixel arrays.
- `Canvas API` renders pixels to an offscreen canvas, then exports as JPEG blob.
- `pdf-lib` embeds the JPEG into a new PDF document, one page per TIFF page.
- JPEG at quality `0.92` is used as the intermediate format because browser `canvas.toBlob('image/jpeg')` is hardware-accelerated and significantly faster than PNG encoding.

### Batch processing and concurrency

Use these defaults:

| Parameter         |        Value | Why                                                 |
| ----------------- | -----------: | --------------------------------------------------- |
| Batch size        |     25 files | Limits peak memory; results update after each batch |
| Workers per batch | 4 concurrent | Overlaps canvas processing without saturating CPU   |
| Memory per worker |      \~24 MB | One A4-sized canvas (2000×3000 RGBA)                |

Execution pattern:

```text
Batch 1 (files 1-25)
  Worker 1 -> file 1 -> file 5 -> ...
  Worker 2 -> file 2 -> file 6 -> ...
  Worker 3 -> file 3 -> file 7 -> ...
  Worker 4 -> file 4 -> file 8 -> ...
  await Promise.all(workers)

Batch 2 (files 26-50)
  repeat
```

### Memory handling

- Canvas memory is freed by GC between files.
- Blob URLs are revoked after ZIP download via `URL.revokeObjectURL()`.
- If some files fail, partial downloads must still be available.

### Why no server-side conversion

- No upload bottleneck
- No cold starts
- No CPU throttling from serverless constraints
- Conversion starts instantly in the browser
- Vercel hosts static app delivery; serverless conversion is fallback only

### UX requirements for conversion

If user selects >100 files:

- show amber non-blocking warning
- still allow continue

Display step-wise UX:

1. file scan
2. validation
3. converting batch 1/n
4. generating PDFs
5. packaging artifacts if needed
6. conversion complete

Why show the flow visually:

- users trust heavy operations more when they can see the stage
- large files create unavoidable waiting; explicit stages reduce uncertainty
- operations users need confidence that the tool is actually progressing and not frozen

***

## 7.4 Outbound send engine

### Goal

Be significantly faster and more observable than Excel -> Outlook outbox.

### Design

- Web app creates one outbound job per AWB
- Jobs are enqueued
- Worker processes sub-batches with retry and idempotency
- Store send metadata per email
- UI shows live throughput and failures

### Important metadata to persist

- batch\_id
- sub\_batch\_id
- awb
- recipient\_email
- template\_id
- attachment\_ids
- message\_id
- internet\_message\_id if available
- conversation\_id / thread key if available
- send\_started\_at
- send\_completed\_at
- send\_status
- failure\_reason

### Send states

- pending
- queued
- processing
- sent
- retrying
- failed
- cancelled

### Retries

- exponential backoff for transient failures
- cap retries per job
- admin can requeue failed jobs manually

***

## 7.5 Reply ingestion module

### Inbox pattern

Every outbound pre-alert should CC/tag a monitored operational mailbox.
When the consignee replies, the reply should land in that mailbox and start the workflow.

### Power Automate flow: inbound reply intake

Flow name suggestion: `PA_ReplyIntake_TaggedMailbox`

#### Trigger

- When a new email arrives in shared/tagged mailbox

#### Steps

1. Read message metadata:
   - subject
   - from
   - to / cc
   - body
   - received time
   - attachment info
2. Normalize body basics inside flow if easy
3. Call backend endpoint `/api/inbox/ingest`
4. Backend returns:
   - matched awb/case
   - issue type
   - urgency
   - action needed
   - human review flag
   - suggested owner / queue
5. Flow performs follow-up actions:
   - create approval if needed
   - notify operator/lead if urgent
   - store raw message reference if necessary

### Backend ingest responsibilities

- de-dup incoming message using message id hash
- parse latest reply from thread
- extract AWB using regex + thread matching + known templates
- fetch attachment text via OCR if needed
- run rules engine
- run LLM only when rules do not fully decide
- write all results to DB
- emit realtime update

***

## 7.6 Decision layer architecture

### Best approach

Use a **three-layer decision engine**:

1. **Deterministic rules layer**
2. **Few-shot LLM classifier**
3. **Policy / confidence router**

### Layer 1: deterministic rules

Handle cases like:

- duplicate thread / already processed
- auto response / OOO
- simple PDF invoice request
- payment received confirmation
- obvious escalation keywords
- internal mail only
- bounce/failure mail

### Layer 2: few-shot LLM classifier

Train the behavior using historical examples, but preferably through **prompt-based few-shot classification**, not model fine-tuning in v1.

#### Training data structure

Use your last 1 week of pre-alerts + replies first.
Create a labeled dataset like:

| field                     | description               |
| ------------------------- | ------------------------- |
| awb                       | shipment id               |
| latest\_customer\_message | cleaned latest reply only |
| subject                   | subject line              |
| attachment\_text          | OCR if relevant           |
| true\_issue\_type         | human labeled category    |
| true\_urgency             | human labeled urgency     |
| true\_action              | what should happen        |
| human\_review\_required   | yes/no                    |
| call\_required            | yes/no                    |
| final\_resolution         | eventual outcome          |

#### Label set v1

Issue types:

- no\_action
- info\_only
- pdf\_invoice\_request
- checklist\_request
- status\_query
- payment\_received
- reminder\_needed
- final\_reminder\_needed
- special\_case
- escalation
- unclear

Urgency:

- low
- normal
- urgent

Actions:

- ignore
- ai\_draft
- ai\_send
- human\_review
- assign\_owner
- reminder
- final\_reminder
- call\_task

#### How to improve with data

- Start with 100–300 manually labeled examples.
- Keep a gold set for evaluation.
- Compare model output vs human label daily.
- Add corrected examples to the few-shot bank / retrieval set.
- Only consider fine-tuning later if prompt-based accuracy plateaus.

### Layer 3: policy router

Policy decides:

- if confidence is low -> `ai_suggested_needs_approval`
- if issue is risky -> `human_review`
- if safe and repetitive -> `ai_send`
- if no reply elapsed -> `reminder` / `final_reminder`

***

## 7.7 KYC-style claim / assign / release model

This is a critical module.

### Rules

- Claiming applies only to **follow-up/reply handling**, not initial batch upload.
- A case can be in `unassigned`, `claimed`, `assigned`, `review`, `closed`, `released` states.
- Claim creates temporary exclusive work ownership.
- Owner can:
  - update status
  - add remarks
  - send reply
  - create call note
  - reassign
  - release
- Lead/admin can override lock.

### Recommended locking model

Use **application-level claim state plus optimistic concurrency**.

Do not rely only on DB row locks for long-lived user ownership.

#### Why

- Long-lived pessimistic locks are bad UX.
- Ownership is business state, not only DB transaction state.
- Short DB concurrency control is still needed for safe updates.

### Implementation pattern

Tables hold fields like:

- `owner_user_id`
- `ownership_status`
- `claimed_at`
- `released_at`
- `last_human_action_at`
- `version`

On update:

- include `version`
- reject if current row version changed
- show `This case was updated by X; refresh to continue`

### Slip tracking

For every open case, compute:

- current owner
- last human action time
- next action due time
- whether slipped
- slipped duration

Admin dashboard must include:

- slipped by operator
- slipped by issue type
- slipped by urgency
- reassigned after slip
- aging buckets

***

## 7.8 Human review queue

### Queue entry criteria

- low classifier confidence
- risky category
- escalation / unclear request
- missing AWB
- OCR failure that blocks decision
- repeated failed send
- repeated no-reply beyond threshold

### Reviewer UI must show

- latest customer message
- full thread link / excerpt
- detected AWB
- AI summary
- AI suggested issue type
- AI suggested action
- proposed draft reply
- confidence
- why flagged
- assign / approve / edit / reject buttons

***

## 7.9 Reminder + no-reply engine

### Problem to solve

Currently if no customer reply comes, team often cannot trigger systematic follow-up. This module fixes that.

### Power Automate scheduled flow

Flow name suggestion: `PA_NoReplyReminderScheduler`

#### Trigger

- Recurrence every 1 hour

#### Steps

1. Call backend `/api/cases/due-followups`
2. Get cases where:
   - no reply yet
   - reminder due
   - final reminder due
   - stale owner
   - urgent untouched case
3. For each case, process action
4. Call send-reply endpoint or create approval task
5. Update case state and audit log

### Reminder policy model

At minimum allow per team/mailbox settings:

- first reminder after X hours
- final reminder after Y hours
- urgent case review SLA
- slip threshold by urgency
- call escalation toggle

***

## 7.10 AI call task layer

Do not make calling fully autonomous first.

### v1

- AI can recommend `call_required = true`
- system creates a call task for operator
- operator logs outcome

### v2

- optional outbound AI info-call for safe reminder categories only

Call task record should contain:

- awb
- reason
- script prompt
- customer number
- due\_at
- assigned\_to
- call\_outcome
- remarks

***

## 8) Power Automate solution structure

Build all Power Automate assets inside a proper **Solution**.

### Why

- cleaner deployment
- reusable connection references
- environment variables for dev/stage/prod
- easier handoff and governance

### Solution contents

- cloud flows
- connection references
- environment variables
- optional custom connectors

### Environment variables to define

- APP\_API\_BASE\_URL
- APP\_API\_KEY / secure auth approach
- SHARED\_MAILBOX\_ADDRESS
- DEFAULT\_REPLY\_MAILBOX
- DEFAULT\_TIMEZONE
- FIRST\_REMINDER\_HOURS
- FINAL\_REMINDER\_HOURS
- URGENT\_SLA\_MINUTES
- AI\_REVIEW\_THRESHOLD
- OCR\_ENDPOINT\_URL
- LLM\_CLASSIFIER\_URL
- LLM\_DRAFT\_URL

### Connection references

- Outlook / Office 365 connector
- Teams connector if used
- HTTP connector if used

### Suggested flow inventory

1. `PA_ReplyIntake_TaggedMailbox`
2. `PA_NoReplyReminderScheduler`
3. `PA_AIDraftApproval`
4. `PA_UrgentCaseNotifier`
5. `PA_BatchSendOrchestrator` (optional if send path uses Power Automate)
6. `PA_ReassignmentEscalation`

***

## 9) Web app information architecture

### Main navigation

- Dashboard
- Batches
- Cases
- Human Review
- Reminders
- Calls
- Templates
- Mailboxes
- Team
- Admin
- Audit Logs

### Dashboard widgets

- batches sent today
- pre-alert throughput
- sent success rate
- replies received today
- no-reply backlog
- urgent queue
- human-review queue
- AI-handled count
- slipped cases
- operator workload

### Cases page filters

- date range
- batch
- mailbox
- owner
- status
- issue type
- urgency
- AI vs human
- slipped yes/no
- reminder level

### Batch page filters

- run name
- date
- mailbox
- created by
- total rows
- send status

### Exports

- cases export
- batch run export
- slipped-cases export
- operator productivity export

***

## 10) UX guidance

The product must feel enterprise-grade, not like a raw internal script wrapper.

### UX principles

- Step-by-step wizard for batch creation
- Visible stage progress during heavy actions
- Strong success/error summaries
- Inline validation before launch
- Real-time status chips
- Assignment ownership clearly visible
- Sticky filters and saved views
- Keyboard-friendly tables for operators
- Minimal typing; use structured actions

### Why step loading should be displayed

Because this workflow includes heavy files, conversion, batching, sending, and ingest. Operators trust systems more when stages are explicit, especially for long-running actions.

Example displayed steps:

- uploading data
- validating rows
- matching documents
- converting TIFF files
- preparing sub-batches
- queueing emails
- sending batch
- confirming send results

***

## 11) HLD (high-level design)

```text
Users
  -> Next.js Web App (Vercel)
      -> Supabase Auth
      -> Supabase Postgres
      -> Supabase Realtime
      -> Supabase Storage
      -> Redis
      -> Backend API routes / worker endpoints
          -> OCR service
          -> LLM classifier
          -> LLM draft generator

Microsoft Outlook / Shared Mailbox
  -> Power Automate Flows
      -> Web App APIs
      -> Database updates / case orchestration
      -> Notifications / approvals
```

### Load and scaling notes

- Vercel serves app and lightweight API routes
- Heavy processing should be offloaded to worker processes or background jobs
- Redis coordinates queues, locks, retries, rate limiting
- Dashboard aggregates should be cached
- Inbound reply processing should be idempotent
- Batch send status should stream/revalidate live

### Load balancing considerations

- Stateless app servers behind Vercel scaling
- Background workers should be horizontally scalable
- Use Redis-backed job queues for send and ingest workloads
- Separate read-heavy dashboard endpoints from write-heavy ingest endpoints
- Cache expensive admin summary queries

***

## 12) Suggested Supabase SQL schema

```sql
create table app_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,
  email text unique not null,
  full_name text,
  role text not null check (role in ('admin','lead','operator','reviewer','viewer')),
  team_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table mailbox_configs (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid references app_users(id),
  display_name text not null,
  operational_mailbox text not null,
  tagged_mailbox text not null,
  signature_html text,
  timezone text default 'Asia/Kolkata',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table batch_runs (
  id uuid primary key default gen_random_uuid(),
  run_name text not null,
  run_date date not null,
  mailbox_config_id uuid references mailbox_configs(id),
  created_by uuid references app_users(id),
  status text not null check (status in ('draft','validating','ready','converting','queued','sending','partially_sent','completed','failed','archived')),
  total_rows int not null default 0,
  total_sub_batches int not null default 0,
  sent_count int not null default 0,
  failed_count int not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table batch_items (
  id uuid primary key default gen_random_uuid(),
  batch_run_id uuid references batch_runs(id) on delete cascade,
  awb text not null,
  consignee_name text,
  consignee_email text,
  shipment_data jsonb not null default '{}'::jsonb,
  attachment_status text,
  send_status text,
  created_at timestamptz not null default now()
);

create table file_assets (
  id uuid primary key default gen_random_uuid(),
  batch_run_id uuid references batch_runs(id) on delete cascade,
  batch_item_id uuid references batch_items(id) on delete cascade,
  awb text,
  original_name text not null,
  source_format text not null,
  derived_format text,
  storage_path text,
  checksum text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table email_events (
  id uuid primary key default gen_random_uuid(),
  batch_run_id uuid references batch_runs(id),
  batch_item_id uuid references batch_items(id),
  awb text,
  direction text not null check (direction in ('outbound','inbound')),
  message_id text,
  internet_message_id text,
  conversation_id text,
  subject text,
  body_clean text,
  sender_email text,
  recipient_emails text[],
  received_at timestamptz,
  sent_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table awb_cases (
  id uuid primary key default gen_random_uuid(),
  awb text unique not null,
  latest_batch_run_id uuid references batch_runs(id),
  current_status text not null,
  issue_type text,
  urgency text,
  action_needed text,
  owner_user_id uuid references app_users(id),
  ownership_status text not null default 'unassigned',
  claimed_at timestamptz,
  released_at timestamptz,
  assigned_by_user_id uuid references app_users(id),
  human_review_required boolean not null default false,
  ai_reply_allowed boolean not null default false,
  ai_suggested_needs_approval boolean not null default false,
  call_required boolean not null default false,
  reminder_count int not null default 0,
  final_reminder_sent boolean not null default false,
  last_human_action_at timestamptz,
  next_action_at timestamptz,
  sla_due_at timestamptz,
  slipped boolean not null default false,
  slipped_at timestamptz,
  version int not null default 1,
  summary text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table case_assignments (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references awb_cases(id) on delete cascade,
  from_user_id uuid references app_users(id),
  to_user_id uuid references app_users(id),
  assignment_type text not null check (assignment_type in ('claim','assign','release','override','auto_assign')),
  reason text,
  created_at timestamptz not null default now()
);

create table case_updates (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references awb_cases(id) on delete cascade,
  updated_by uuid references app_users(id),
  update_type text not null,
  old_values jsonb,
  new_values jsonb,
  remarks text,
  created_at timestamptz not null default now()
);

create table ai_classifications (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references awb_cases(id) on delete cascade,
  email_event_id uuid references email_events(id) on delete cascade,
  classifier_version text,
  issue_type text,
  urgency text,
  action_needed text,
  confidence numeric(5,4),
  human_review_required boolean,
  ai_reply_allowed boolean,
  call_required boolean,
  reason text,
  raw_output jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table draft_replies (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references awb_cases(id) on delete cascade,
  email_event_id uuid references email_events(id) on delete cascade,
  generated_by text not null,
  draft_subject text,
  draft_body text,
  approval_status text not null default 'pending',
  approved_by uuid references app_users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table reminder_jobs (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references awb_cases(id) on delete cascade,
  reminder_level int not null default 1,
  due_at timestamptz not null,
  status text not null default 'pending',
  executed_at timestamptz,
  created_at timestamptz not null default now()
);

create table call_tasks (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references awb_cases(id) on delete cascade,
  assigned_to uuid references app_users(id),
  customer_phone text,
  reason text,
  script_prompt text,
  due_at timestamptz,
  status text not null default 'open',
  outcome text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references app_users(id),
  entity_type text not null,
  entity_id uuid,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

### Additional DB notes

- Add indexes on `awb`, `owner_user_id`, `current_status`, `issue_type`, `urgency`, `next_action_at`, `slipped`, `created_at`.
- Add RLS policies so operators only see allowed cases.
- Use DB triggers or app-level hooks to update `updated_at` and increment `version`.

***

## 13) API design

### Web app / backend endpoints

- `POST /api/batches`
- `POST /api/batches/:id/validate`
- `POST /api/batches/:id/launch`
- `GET /api/batches/:id/status`
- `POST /api/inbox/ingest`
- `POST /api/classify`
- `POST /api/drafts/generate`
- `POST /api/cases/:id/claim`
- `POST /api/cases/:id/release`
- `POST /api/cases/:id/assign`
- `POST /api/cases/:id/update`
- `GET /api/cases/due-followups`
- `POST /api/cases/:id/send-reminder`
- `POST /api/cases/:id/send-final-reminder`
- `POST /api/cases/:id/create-call-task`
- `GET /api/admin/metrics`
- `GET /api/export/cases`
- `GET /api/export/batches`

### API contracts for Power Automate

Power Automate should mainly call:

- `/api/inbox/ingest`
- `/api/cases/due-followups`
- `/api/cases/:id/send-reminder`
- `/api/cases/:id/send-final-reminder`
- `/api/cases/:id/escalate`

Use authenticated service tokens / signed secrets.

***

## 14) Redis usage plan

Use Redis only where it creates real value.

### Use Redis for

- job queue backing for send pipeline
- inbound ingest dedupe keys
- temporary distributed processing locks
- rate limiting send bursts
- cached dashboard aggregates
- retry counters and dead-letter queue tracking

### Do not use Redis for

- final source of truth business state
- long-term case ownership records

Source of truth remains Postgres.

***

## 15) Suggested Power Automate deep structure

## Flow A: `PA_ReplyIntake_TaggedMailbox`

Purpose: react to every reply hitting monitored mailbox.

Steps:

1. Trigger on new email.
2. Initialize variables for mailbox, message id, subject, sender, body preview.
3. Optional guard clauses:
   - ignore internal only
   - ignore auto-response patterns if easy
4. Call web app ingest API.
5. Parse JSON response.
6. Condition switch on `action_needed`:
   - `human_review`
   - `ai_draft`
   - `ai_send`
   - `assign_owner`
   - `call_task`
7. Create Teams/Outlook notifications if urgent.
8. Log outcome.

## Flow B: `PA_NoReplyReminderScheduler`

Purpose: periodic reminder and slip engine.

Steps:

1. Recurrence trigger.
2. HTTP GET due cases.
3. Apply to each case.
4. Switch by due action.
5. Send reminder / final reminder / escalate.
6. Update backend state.
7. Emit failure summary if jobs fail.

## Flow C: `PA_AIDraftApproval`

Purpose: human-in-the-loop approval.

Steps:

1. Trigger from approval-needed event.
2. Create approval request.
3. Include AWB, summary, suggested reply.
4. On approve -> call send-draft endpoint.
5. On reject -> mark case human review.

## Flow D: `PA_UrgentCaseNotifier`

Purpose: alert operator/lead on urgent untouched cases.

Steps:

1. Trigger from backend webhook or queue item.
2. Notify owner.
3. If no acknowledgement within threshold, escalate to lead.

## Flow E: `PA_ReassignmentEscalation`

Purpose: handle slipped cases.

Steps:

1. Recurrence trigger.
2. Query slipped cases.
3. Notify lead with owner + delay summary.
4. Optionally create reassignment task.

***

## 16) Training-data plan for decision layer

### Phase 1: labeling

Take 1 week of pre-alert outbound + replies.
Create annotation sheet with:

- cleaned latest reply
- issue type
- urgency
- desired action
- whether safe for AI
- whether human review required
- whether call required

### Phase 2: prompt pack

Use the labeled examples to create:

- system instruction
- category definitions
- 10–30 few-shot examples
- edge-case examples
- negative examples

### Phase 3: evaluation

For new live emails, compare:

- model prediction
- human final action
- mismatch reason

Track accuracy by class.

### Phase 4: controlled automation

Only when stable:

- move simple cases from `ai_draft` to `ai_send`
- keep risky classes under review

***

## 17) Development roadmap for Claude Code

### Milestone 1: foundation

- initialize Next.js app
- Supabase auth
- role-based layout
- DB schema + RLS skeleton
- dashboard shell

### Milestone 2: batch module

- create batch wizard
- Excel parser
- row validation
- batch + sub-batch models
- progress UI

### Milestone 3: client-side TIFF/PDF module

- implement browser-only conversion
- batch progress UI
- partial failures
- ZIP download option if needed
- handoff converted PDFs into batch attachments

### Milestone 4: send engine

- queue model
- job states
- send progress page
- audit logging

### Milestone 5: case management

- master AWB table
- case details page
- claim / release / assign
- optimistic concurrency handling

### Milestone 6: inbox ingest integration

- ingest endpoint
- message dedupe
- AWB extraction
- admin/raw event debug page

### Milestone 7: AI layer

- rule engine
- classifier endpoint
- draft generator
- review queue

### Milestone 8: reminders and slips

- due follow-up endpoints
- scheduler-compatible APIs
- slipped-case analytics

### Milestone 9: dashboards and export

- admin analytics
- operator workload views
- export CSV/Excel

***

## 18) Non-functional requirements

- Must support 100–300 row batch uploads comfortably
- Must keep browser responsive during conversion
- Must avoid duplicate case handling
- Must provide complete audit trail
- Must be safe under partial failures
- Must be recoverable after worker / flow failures
- Must be mobile-usable for quick status views, though desktop-first
- Must be visually polished and enterprise-grade

***

## 19) Claude Code build instructions

Build this as a polished internal operations web app with a serious enterprise feel. Prioritize clarity, reliability, and explainable workflow state over flashy AI. The UX must make long-running actions feel trustworthy with visible progress stages and clear success/failure summaries.

Use Next.js, TypeScript, Supabase, Tailwind, and Redis-compatible abstractions. Structure the code so Power Automate can call a small set of secure backend APIs. Treat the web app as the source of operational truth, and treat Power Automate as the Microsoft workflow orchestrator.

Key rules:

- implement KYC-style case claiming for follow-up work only
- implement optimistic concurrency on case updates
- implement batch/sub-batch send tracking
- implement browser-only TIFF-to-PDF conversion pipeline exactly as specified
- build a rules-first decision engine with pluggable few-shot LLM classification
- keep all AI auto-send paths policy-gated
- make every important action auditable
- make the dashboard excellent

***

## 20) Open defaults already decided

These are the defaults already agreed:

- claiming applies only to follow-up/reply work
- owner can assign/tag another teammate
- timeout/slip logic is dynamic based on urgency and latest activity
- users can name batches freely, but UI should recommend a structured naming convention
- sub-batches are allowed
- decision layer should use historical training data via labeled examples and few-shot prompt design first
- low confidence becomes approval or human review
- stack is Next.js + Supabase + Vercel + whatever else needed
- Redis should be included where useful
- login starts with email + password
- Power Automate writes to app DB through backend APIs

