# AI Classifier — Training Data Collection Guide

## Overview

To train the AI classification system, we need real examples of how your
team handles customer replies. The AI will learn from these examples to
automatically classify future replies — saving your team ~50% of the time
currently spent on manual review.

## What to Collect

### Source: Ravi's Reply Export

Every day, Ravi exports replies from the shared mailbox into Excel. This
Excel file is exactly what we need. Request the **last 2 weeks** of data.

### Expected Format

Each row in the export should contain:

| Field | Example | How to Get It |
|-------|---------|--------------|
| **AWB** | 382407883458 | From the subject line or body of the reply |
| **Subject** | "Re: Pre Alert - 382407883458 / AASHITA ENTERPRISES" | From the email |
| **Customer Message** | "Please send invoice PDF for clearance at the earliest" | The reply body text |
| **Attachment?** | Yes/No | Was there an attachment? |
| **Sent Date** | 2026-07-10 | When the pre-alert was sent |
| **Reply Date** | 2026-07-11 | When reply was received |

### Then Add Your Labels

For each row, add 5 more columns (this is the **critical** part):

| Column | Options | Description |
|--------|---------|-------------|
| **issue_type** | See table below | What kind of reply is this? |
| **urgency** | low / normal / urgent | How urgent is this? |
| **action_taken** | See table below | What did the team actually do? |
| **human_review_required** | yes / no | Did a human need to personally handle this? |
| **ai_could_handle** | yes / no | Looking back, could AI have handled this alone? |

---

## Issue Types

Pick the one that best describes the reply:

| Type | When to Use | Example Customer Message |
|------|-------------|------------------------|
| `no_action` | Auto-reply, OOO, bounce, spam | "I am out of office until Monday" |
| `info_only` | Just acknowledging, no action needed | "Okay noted, thank you" |
| `pdf_invoice_request` | Customer wants the invoice PDF | "Please share the invoice copy" |
| `checklist_request` | Customer needs DO checklist / docs | "Send me the checklist for clearance" |
| `status_query` | Customer asking where shipment is | "What is the status of my shipment?" |
| `payment_received` | Customer paid, sharing proof | "Payment done, UTR: HDFC123456" |
| `reminder_needed` | Customer needs a nudge | "Will process by end of week" |
| `final_reminder_needed` | Still pending after reminder | "Still haven't received, please follow up" |
| `special_case` | Unusual, needs manual handling | "The invoice amount is wrong" |
| `escalation` | Angry, urgent, legal threat | "This is unacceptable, I want to speak to your manager" |
| `unclear` | Cannot determine from email | (mixed context, need to check thread) |

---

## Actions Taken

| Action | When |
|--------|------|
| `ignore` | No response needed (OOO, auto-reply, spam) |
| `ai_send` | Sent a standard reply (invoice, checklist) |
| `ai_draft_then_human_approve` | Drafted by template, approved by human |
| `human_review` | Human read and decided what to do |
| `call_task` | Needed a phone call |
| `escalated` | Passed to lead/supervisor |

---

## Step-by-Step: Your Task Tomorrow

```
Step 1: Get Ravi's export (last 2 weeks of replies + AWBs)
Step 2: Open in Google Sheets / Excel
Step 3: Add 5 new columns: issue_type, urgency, action_taken, 
         human_review_required, ai_could_handle
Step 4: Label each row (target: 200+ rows)
         - Takes about 15-30 seconds per row
         - Total: ~1-2 hours for 200 rows
Step 5: Export as CSV
Step 6: Drop it into docs/training-data/replies-labeled.csv
         Or share the Google Sheet link
```

### Tips for Good Labels

1. **Be consistent** — same type of reply = same label every time
2. **When in doubt, pick `unclear`** — better to flag for human review
3. **Label for `ai_could_handle` honestly** — if you think "yes, a smart AI with the right template could have sent this reply", mark it yes
4. **Focus on quantity** — 200 good examples beats 50 perfect ones
5. **Cover edge cases** — include a few angry emails, auto-replies, and unusual requests

### Quick Reference Card

Print this or keep it open while labeling:

```
REPLY TYPE → LABEL
─────────────────────
OOO / auto-reply  → no_action
"Okay noted"      → info_only
"Send invoice"    → pdf_invoice_request
"Send checklist"  → checklist_request
"Where is shipment" → status_query
"Payment done"    → payment_received
"Will do later"   → reminder_needed
"Still pending"   → final_reminder_needed
Unusual situation → special_case
Angry / urgent    → escalation
Not sure          → unclear

URGENCY → LABEL
─────────────────────
Routine query  → low
Standard reply → normal
Angry / urgent → urgent
```

---

## What Happens After You Share the Data

1. I load the CSV into a Supabase `training_examples` table
2. I generate embeddings (vector representations) using Gemini
3. I build a few-shot prompt template with the best examples
4. I create the `/api/classify` endpoint that:
   - Takes incoming email → finds 5 most similar examples → builds prompt → calls Gemini
5. We test on 20-30 holdout examples → measure accuracy
6. We deploy to production

---

## Questions?

Ask me if:
- You're unsure about a label
- You find edge cases not covered here
- You want me to review a sample batch before you do all 200
