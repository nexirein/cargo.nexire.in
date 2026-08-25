# Auto-Send Pipeline (NFBRK-First)

The automated pre-alert send pipeline. **NFBRK (≈80% of volume) is fully
automated**: AI confirms the clearance path → the correct template is selected
automatically → the email is sent immediately on confirmation → DO payment is
tracked (who paid / who didn't). **FEBRK shares the same mail engine and
templates but its human/CHA steps stay exactly as today** — only the send is
candidate for automation once the broker is confirmed.

## Why a redesign

The old flow mixed NFBRK and FEBRK everywhere: the template was chosen from the
sheet's "End Result" column at validate time, not from what the AI actually
confirmed, and there was no tracking of the NFBRK end result (DO charge payment
to `Deldo@corp.ds.fedex.com`). 80% of cases are NFBRK, whose end-to-end flow is
simple and fully automatable:

1. Pre-alert mail with AWB/CI + DO-collection instructions + bank details
2. Consignee pays DO charges (₹3068 day-of arrival / ₹4248 next day)
3. We track who paid and who didn't (Trace marks it on the dashboard)

FEBRK is complex (CHA involvement, KYC/checklist/BOE steps with the broker) so
it keeps the batch-wise flow and human handling.

## Flow

```
Sheet upload → validate (master-data autofill) → AI call (Bolna) confirms:
  NFBRK | FEBRK-Jeena | FEBRK-Sunimpex
        │
        └── webhook writes back clearance_type + auto-selects template
            └── processSendJob → email sent immediately
                ├─ NFBRK          → 'nfbrk' template (+ DO FORMAT.docx, BANK DETAILS.docx)
                ├─ FEBRK-Jeena    → 'febrk-jeena' template (CC Jeena team)
                └─ FEBRK-Sunimpex → 'febrk-sunimpex' template (CC Sunimpex team)

NFBRK end result → DO ready → consignee pays → Trace marks paid (UTR) on dashboard
```

## What was built

### Migrations
- **`0044_send_pipeline_confirmation.sql`** — relaxes `batch_items.send_status`
  check to allow `skipped` (the send job writes it for consol-dedup / calling
  items; the original `0005` constraint rejected it). Adds
  `batch_items.confirmation_source` (`ai_call|master|sheet|manual`) and
  `confirmed_at`. Points the `template_id` default at `nfbrk` (was the stale
  `prealert_v1`).
- **`0045_do_payment_tracking.sql`** — adds DO payment tracking to `awb_cases`:
  `do_payment_status` (`pending|paid|overdue`), `utr_no`, `do_amount`,
  `payment_received_at`, `payment_confirmed_by`, `do_payment_notes`.

### Send engine (shared NFBRK + FEBRK)
- **`src/lib/send/select-template.ts`** (new) — the single
  `clearance_type → template` mapping. NFBRK/FEBRK-Jeena/FEBRK-Sunimpex map to
  their templates; generic unresolved `febrk` / `calling` / `hold` never fall
  back to the NFBRK email (they need humans).
- **`src/app/api/bolna/webhook/route.ts`** and **`vapi/webhook/route.ts`** —
  on confirmed clearance type, also set `template_id` (from the mapping) +
  `confirmation_source='ai_call'` + `confirmed_at`, then fire `processSendJob`
  so the mail sends immediately.
- **`src/lib/send/process-send-job.ts`** — auto-select guard: if an item has a
  confirmed clearance path but no usable template, resolve it automatically
  before sending.
- **`src/app/api/batches/[id]/validate/route.ts`** — fallback template fixed
  from the stale `prealert_v1` to `nfbrk`.

### DO payment tracking (NFBRK)
- **`src/app/api/cases/[id]/do-payment/route.ts`** (new) — Trace marks an AWB as
  paid (UTR + optional amount + notes). Amount defaults to ₹3068 within 24h of
  DO-ready, ₹4248 after. Collects the DO in the same action.
- **`src/app/api/cron/do-overdue-reminders/route.ts`** — skips cases already
  `paid`, and flips pending cases to `do_payment_status='overdue'` past 24h.

### Dashboard
- **`src/app/(app)/dashboard/post/page.tsx`** — DO Collection card now shows
  paid/unpaid chips; Recent Arrival Cases table gained **DO Payment** (status +
  amount) and **UTR** columns → "who paid / who didn't" at a glance.

### AI content (broader but safe)
- **`src/lib/email/render-shared.ts`** — new template variables so the NFBRK
  template never hard-codes amounts: `{DO_BASE}` (2600), `{DO_ADMIN_FEE}` (1000),
  `{DO_AMOUNT_DAY_OF}` (3068), `{DO_AMOUNT_NEXT_DAY}` (4248). Shipment-context
  blocks (MAWB/IGM/flight/ports) are already injected for post-arrival in
  `process-send-job.ts`.

## Design decisions (confirmed)

- **AI fills dynamic blocks in fixed regulatory templates** — no free-form
  AI-generated email bodies. The NFBRK mail is a legal/regulatory notice; the
  fixed template is the source of truth.
- **DO payment is marked manually on the dashboard** — Trace sees the Deldo
  replies in Outlook and records UTR. No mailbox auto-parsing (can be added
  later; the schema supports it).
- **FEBRK: engine-ready, flow unchanged** — the engine *can* auto-send FEBRK
  pre-alerts on confirmation, but CHA/checklist/human steps stay manual.
- **Send immediately on confirmation** — no human gate; the moment the AI
  confirms NFBRK/Jeena/Sunimpex, the right template goes out.

## To run

1. Push/apply migrations `0044` and `0045`.
2. Confirm the `templates` table has active `nfbrk`, `febrk-jeena`,
   `febrk-sunimpex` templates (seeded by `0019`/`0025`).
3. Keep the Bolna webhook (`api/bolna/webhook`) reachable — it is what triggers
   the auto-send.
4. Mark DO payments on a case via
   `POST /api/cases/[id]/do-payment` with `{ utrNo, amount?, notes? }`.

## Known gaps / next steps

- Generic `febrk` (broker unresolved after the call) intentionally does **not**
  auto-send — route it to human review.
- Optional: auto-parse `Deldo@corp.ds.fedex.com` replies for UTR/payment once
  mailbox access is available.
- `send_status='skipped'` items now persist correctly after `0044`; existing
  rows written before the migration still need the constraint relaxed (the
  migration handles it).
