# AI Training & Analytics Guide

## How the AI Classification Pipeline Works

```
Incoming email
    ↓
IMAP monitor → ingest-email.ts
    ↓
Rule-based classifier (keyword regex matching)
    ↓
Classification result (issue_type, urgency, confidence, action_needed)
    ↓
┌─ Confidence ≥ threshold & action_needed = "ignore"/"auto_send" ──→ Auto-reply → Auto-close
├─ Confidence ≥ threshold & action_needed = "draft_approve" ──→ Draft saved → Human approves/sends
├─ Confidence ≥ threshold & action_needed = "human_review" ──→ Human Review Queue
└─ Confidence < threshold (no rule matched) ──→ "unclear" → Human Review Queue
```

The classifier is **purely rule-based** (regex keyword matching), running inline
with zero network calls. Each rule has:

| Field                 | Meaning                                              |
| --------------------- | ---------------------------------------------------- |
| `name`                | Internal rule identifier                             |
| `keywords`            | Array of regex patterns (matches any = rule fires)   |
| `issueType`           | Classification category                              |
| `urgency`             | low / normal / urgent                                |
| `actionNeeded`        | ignore / auto\_send / draft\_approve / human\_review |
| `confidence`          | Base confidence (0.0–1.0)                            |
| `humanReviewRequired` | Whether case must go to human                        |

Confidence gets a **boost** of +0.05 per additional keyword match (max +0.10),
capped at 0.99.

***

## Current Issue Types (10 + 1 fallback)

| Issue Type            | Action         | Auto-Reply? | Auto-Close? | Confidence |
| --------------------- | -------------- | ----------- | ----------- | ---------- |
| `out_of_office`       | ignore         | No          | Yes         | 0.90       |
| `bounce`              | ignore         | No          | Yes         | 0.95       |
| `payment_received`    | auto\_send     | Yes         | Yes         | 0.85       |
| `freight_query`       | auto\_send     | Yes         | Yes         | 0.80       |
| `pdf_invoice_request` | auto\_send     | Yes         | Yes         | 0.80       |
| `checklist_request`   | draft\_approve | No (draft)  | No          | 0.70       |
| `status_query`        | draft\_approve | No (draft)  | No          | 0.75       |
| `reminder_needed`     | human\_review  | No          | No          | 0.70       |
| `info_only`           | ignore         | Yes         | Yes         | 0.70       |
| `escalation`          | human\_review  | No          | No          | 0.85       |
| `special_case`        | human\_review  | No          | No          | 0.75       |
| `unclear` (fallback)  | human\_review  | No          | No          | 0.00       |

### Auto-reply Templates

Currently 4 templates (sent via SMTP when `actionNeeded` is `auto_send` or
issue is `info_only`):

1. **payment\_received** — Confirms payment, offers DO/receipt
2. **freight\_query** — Advises to check invoice or email <india@fedex.com>
3. **pdf\_invoice\_request** — Attaches the invoice
4. **info\_only** — Acknowledges the note

All auto-replied cases get **auto-closed** (status → `closed`,
`human_review_required` → false) if they are in a pre-clearance status
(`awaiting_reply`, `reply_received`, `human_review`).

***

## How to Train / Improve the Classifier

### Step 1: Review Human Review Queue

Go to **Review Queue** (PRE-ALERT section) or **Exception Review** (ARRIVAL
section). Every case here had `humanReviewRequired: true` or was classified as
`unclear`. For each case:

1. Read the email thread
2. Decide which issue type it actually is
3. Check if the AI's classification was correct

### Step 2: Export Training Data

Go to **Admin → Training Data**. Export cases with their `issue_type`,
`confidence`, `human_review_required`, and the raw email text. The export
format is:

| Column                  | Description                                          |
| ----------------------- | ---------------------------------------------------- |
| awb                     | AWB number                                           |
| subject                 | Email subject line                                   |
| body\_clean             | Cleaned email body text                              |
| issue\_type             | AI-classified issue type                             |
| urgency                 | low / normal / urgent                                |
| confidence              | 0.0000–0.9999                                        |
| action\_needed          | ignore / auto\_send / draft\_approve / human\_review |
| human\_review\_required | true/false                                           |
| human\_corrected\_type  | (leave blank for AI, fill for human)                 |
| human\_notes            | Operator notes on what was wrong                     |
| resolution              | How the case was resolved                            |
| created\_at             | Timestamp                                            |

### Step 3: Identify Rule Gaps

Common patterns that lead to `unclear` classifications:

- **Misspellings** — Keywords don't match non-standard spellings
- **Mixed queries** — Email asks for both status AND invoice
- **Context-dependent** — "Please check" could be status query or reminder
- **Freight amount** — "What is the freight amount?" or "Freight charges kya hai?"

### Step 4: Add/Modify Rules in Code

Rules live in `src/lib/email/ingest-email.ts` in the `RULES` array.

**To add a new rule:**

```typescript
{
  name: "your_rule_name",                    // unique identifier
  keywords: [/regex pattern 1/i, /pattern 2/i],  // one match = rule fires
  issueType: "your_issue_type",              // must match DB enum
  urgency: "normal",                         // low | normal | urgent
  actionNeeded: "human_review",              // ignore | auto_send | draft_approve | human_review
  confidence: 0.8,                           // 0.0–1.0
  humanReviewRequired: true,                // true = send to human review queue
}
```

**To add an auto-reply template:**
Update `sendAutoReply()` in the same file — add a new `case` in the switch.

**To add a new issue type (requires migration):**

1. Add the new value to the `issue_type` check constraint on `awb_cases`
2. Add corresponding templates in the templates table
3. Add auto-reply template in `sendAutoReply()`
4. Add the rule to `RULES`

### Step 5: Monitor Classification Analytics

The `ai_classifications` table records EVERY classification:

| Column                  | Description                    |
| ----------------------- | ------------------------------ |
| case\_id                | Linked case                    |
| email\_event\_id        | Linked email                   |
| classifier\_version     | "rules-v1"                     |
| issue\_type             | What the AI said               |
| urgency                 | What the AI said               |
| action\_needed          | What the AI decided            |
| confidence              | Numeric score                  |
| human\_review\_required | Whether it went to human queue |
| reason                  | Human-readable explanation     |
| raw\_output             | Full classification JSON       |

***

## Classification Analytics Dashboard

The following metrics are computed in real-time on the **Human Review** page:

| Metric          | Source                         | Meaning                       |
| --------------- | ------------------------------ | ----------------------------- |
| Total Cases     | `awb_cases` count              | All cases in the system       |
| AI Handled      | `auto_closed = true`           | Cases AI resolved end-to-end  |
| Awaiting Review | `human_review_required = true` | Cases needing human attention |
| Urgent          | `urgency = urgent`             | Escalations / urgent issues   |
| AI Ownership %  | AI Handled / Total             | AI effectiveness rate         |

### Additional Tracked Fields (on `awb_cases`)

- `auto_classified` — Was this case classified by AI?
- `auto_replied` — Did AI send an auto-reply?
- `auto_closed` — Did AI close the case without human?
- `human_ever_opened` — Did a human ever open this case?
- `ai_actions_count` — Number of AI actions
- `human_actions_count` — Number of human actions
- `slipped` — Was the case missed/slipped?

### Case Updates (audit trail)

Every action (AI or human) is logged in `case_updates` with `actor_type`:

- `ai` — Automated action
- `human` — Manual operator action
- `cron` — Scheduled reminder/job
- `system` — System-level change

***

## Freight Query Auto-Reply

Implemented as of this guide:

When a consignee emails asking about freight charges (e.g., "freight amount
kya hai?", "what is the freight charges?", "provide freight details"), the
classifier matches as `freight_query` and auto-replies:

> Thank you for reaching out regarding the freight charges for AWB \[AWB].
> The freight charges for this shipment have been mentioned in the invoice
> shared with the pre-alert email. You may also write to <india@fedex.com>
> for any freight-related queries.

The case is then auto-closed. If this auto-reply is too generic or customers
keep re-asking, change the `actionNeeded` to `draft_approve` or add more
specific keywords to the rule.

***

## Pending Phases & Next Steps

From the system build history, these phases are identified as not yet
implemented or in-progress:

| Phase                                        | Status        | Notes                                                                                           |
| -------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------- |
| AI Training Data admin page                  | ⏳ Placeholder | `admin/training-data/page.tsx` exists but has no export/upload UI                               |
| Calling confirmation workflow UI             | ❌ Not started | Upload → confirm NFBRK/FEBRK → send template                                                    |
| Post Review Queue (AI-classified post items) | ❌ Not started | User wants a dedicated tracker in ARRIVAL section                                               |
| Fleet monitor / real-time email dashboard    | ❌ Not started | Visibility into mailbox ingestion lag                                                           |
| Human review draft approval flow             | ❌ Not started | `draft_replies` table exists but no UI to approve/reject/send AI drafts                         |
| Migration 0031                               | ⏳ Not run     | `tp_hold_arrival_date`, `pieces_arrived`, `tp_hold_clear_remarks`, `tp_hold_cleared_at` columns |

***

## Best Practices

1. **Review daily** — Check the Human Review Queue every morning. The faster
   you correct AI mistakes, the fewer repeated errors.
2. **Label edge cases** — When you see an `unclear` classification, note what
   the correct issue type should have been. These are candidates for new rules.
3. **Balance auto-reply vs human** — `freight_query` and `pdf_invoice_request`
   are good auto-reply candidates. `escalation` and `special_case` should
   ALWAYS go to human.
4. **Keyword quality over quantity** — One precise regex is better than ten
   vague ones. Test new rules on historical emails before deploying.
5. **Monitor confidence trends** — If most classifications are below 0.8,
   the rules need improvement. If most are above 0.95, the rules may be
   overfitted to specific phrasing.

