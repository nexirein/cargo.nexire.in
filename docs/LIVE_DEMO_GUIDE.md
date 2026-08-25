# Live Demo — Complete Step-by-Step Guide

---

## Phase 0: Pre-Demo Setup (10 min before meeting)

### Step 1: Create the Batch with Test Data

Go to `cargo.nexire.in/batches/new` and create a batch:

| Field | Value |
|-------|-------|
| Run name | `Demo Batch — Aug 25` |
| Send-from mailbox | Select your mailbox config |
| Email template | Select "Demo Pre-Alert Template" (or create one) |
| Sub-batch size | 10 |

Click **Create** → you're redirected to mapping page.

### Step 2: Upload the Test Excel

Upload this file (save as `demo-batch.xlsx`):

| AWB | Consignee Email | Consignee Name | Origin | Destination | Commodity | Pieces | Weight | Freight | Currency |
|-----|----------------|----------------|--------|-------------|-----------|--------|--------|---------|----------|
| 874284953656 | test1alstom@gmail.com | PINKCITY JEWELHOUSE | HKG | DEL | Jewellery | 5 | 25.3 | 15,200 | INR |
| 874284953654 | bs9932338847@gmail.com | GALLANT JEWELRY | NRT | DEL | Gems | 2 | 8.1 | 32,500 | INR |
| 874284953657 | cutq2024@gmail.com | RITE CONCEPT JEWELS | FRA | DEL | Jewellery | 3 | 12.4 | 28,750 | INR |
| 874284953655 | sikder32bipul@gmail.com | JAIN GEMS INTERNATIONAL | SIN | DEL | Precious Stones | 1 | 5.2 | 18,900 | INR |
| 874284953658 | nexire.in@gmail.com | PRERANA INNOTECH | PVG | DEL | Electronics | 8 | 45.0 | 92,300 | INR |
| 874284953652 | cutq2024@gmail.com | ALISHKA GLOBAL | DXB | DEL | Textiles | 10 | 67.8 | 45,600 | INR |
| 874285969197 | test1alstom@gmail.com | PINKCITY JEWELHOUSE | HKG | DEL | Jewellery | 9 | 73.9 | 44,502 | INR |
| 874288645661 | bs9932338847@gmail.com | RITE CONCEPT JEWELS | ICN | DEL | Auto Parts | 1 | 3.5 | 13,240 | INR |

### Step 3: Validate and Map

- AWB column → "AWB" (auto-detected)
- Consignee Email → "Consignee Email" (auto-detected)
- Consignee Name → "Consignee Name" (auto-detected)
- Other columns → stored in `shipment_data` JSON

Click **Validate Rows** → should show 8 valid rows.

### Step 4: Attachments (Skip for Demo)

Click **Mark all as "No attachment"** to bypass.

### Step 5: Preview and Send

- Review all 8 rows with rendered email previews
- Click **Launch Batch**
- Watch the send progress: `pending → queued → processing → sent`
- Takes ~30 seconds for 8 emails

### Step 6: Verify Emails Arrived

Check `cargopaf.demo@gmail.com` (or your monitoring inbox) — all 8 pre-alerts should arrive within 1-2 minutes.

---

## Phase 1: The Demo — Send Test Replies

### Setup: Open 3 Tabs

| Tab | URL | Purpose |
|-----|-----|---------|
| Tab 1 | `cargo.nexire.in/ai/replies` | Show auto-sent replies |
| Tab 2 | `cargo.nexire.in/ai/drafts` | Show AI drafts |
| Tab 3 | `cargo.nexire.in/human-review` | Show escalated cases |

Also have Gmail open to send the test replies.

---

### PATH 1: AI Auto-Send (25-35% of replies)

**What happens:** AI reads the email, classifies it as routine, generates a grounded reply using the AWB's real data, and sends it automatically.

#### Email 1A: Freight FAQ → AI auto-replies

| Field | Value |
|-------|-------|
| **From** | `test1alstom@gmail.com` |
| **To** | `cargopaf.demo@gmail.com` |
| **Subject** | `Re: Pre-Alert 874284953656 / PINKCITY JEWELHOUSE` |
| **Body** | `What are the freight charges and currency for my shipment AWB 874284953656?` |

**After sending:**
1. Go to Tab 1 (`/ai/replies`)
2. Click **"Poll mailbox now"**
3. Wait ~10 seconds
4. The auto-reply appears in the list
5. Click on it → show:
   - **Left:** Customer's question ("What are the freight charges...")
   - **Right:** AI's reply with real freight (INR 15,200) and currency from the AWB row
   - **Route:** `ai_auto_send`
   - **Confidence:** ~95%

**Say:** *"The AI read the question, found the freight charges in our system — INR 15,200 — and replied automatically. The customer got an answer in 10 seconds. No human involved."*

---

#### Email 1B: Payment Confirmation → AI acknowledges

| Field | Value |
|-------|-------|
| **From** | `bs9932338847@gmail.com` |
| **To** | `cargopaf.demo@gmail.com` |
| **Subject** | `Re: Pre-Alert 874284953654 / GALLANT JEWELRY` |
| **Body** | `Payment done. Please confirm receipt of payment for AWB 874284953654. UTR 789456123.` |

**After sending:**
1. Poll again
2. Show the auto-acknowledgment in `/ai/replies`
3. The AI confirmed payment receipt and logged the UTR

**Say:** *"Payment confirmations are handled automatically. The AI acknowledges the UTR and confirms receipt. The team doesn't need to touch these."*

---

#### Email 1C: Out-of-Office → AI ignores (optional)

| Field | Value |
|-------|-------|
| **From** | `cutq2024@gmail.com` |
| **To** | `cargopaf.demo@gmail.com` |
| **Subject** | `Automatic reply: Out of Office` |
| **Body** | `Thank you for your email. I am out of office until Monday and will respond on my return.` |

**After sending:**
1. Poll again
2. Show: **no draft, no reply, no human** — the OOO was detected and ignored silently
3. The case is marked "AI-handled" in the background

**Say:** *"The AI recognized this as an out-of-office auto-reply and set it aside silently. No draft, no reply, no human. It knows the difference between a real customer and a machine."*

---

### PATH 2: AI Draft, Human Approves (25-35% of replies)

**What happens:** AI classifies the email, writes a draft reply, saves it for human review. A person clicks "Approve & Send."

#### Email 2A: Documents Request → AI drafts

| Field | Value |
|-------|-------|
| **From** | `cutq2024@gmail.com` |
| **To** | `cargopaf.demo@gmail.com` |
| **Subject** | `Re: Pre-Alert 874284953657 / RITE CONCEPT JEWELS` |
| **Body** | `We need the invoice and packing list for AWB 874284953657. Please share them.` |

**After sending:**
1. Go to Tab 2 (`/ai/drafts`)
2. Poll
3. The new draft appears (status: "pending")
4. Click on it → show:
   - **Top:** Customer's message ("We need the invoice and packing list...")
   - **Bottom:** AI-generated draft reply
   - **Confidence:** yellow (70-89%) — documents request needs approval
   - **Route:** `ai_draft_hold`

**Say:** *"The AI wrote a draft — it knows what documents were requested. But because this involves sharing documents, a person needs to review before it goes out."*

**Then click "Approve & Send" in front of the manager:**
- Watch the status change to "sent"
- Show the case timeline: "AI Draft (Approved)" badge

**Say:** *"One click. The reply is sent as a threaded response — the customer sees it in the same email conversation."*

---

#### Email 2B: Penalty Question → AI drafts

| Field | Value |
|-------|-------|
| **From** | `sikder32bipul@gmail.com` |
| **To** | `cargopaf.demo@gmail.com` |
| **Subject** | `Re: Pre-Alert 874284953655 / JAIN GEMS` |
| **Body** | `Will we be charged the 5000 penalty if the documents are submitted late for AWB 874284953655?` |

**After sending:**
1. Poll
2. Show the draft in `/ai/drafts`
3. The AI drafted a response explaining the penalty structure
4. Approve & Send

**Say:** *"Penalty questions are sensitive — the AI drafts a careful response, but a person always approves. The AI does the writing, the team keeps control."*

---

### PATH 3: Human Review Queue (30-40% of replies)

**What happens:** Safety gate triggered — legal keyword, VIP sender, urgent, or low confidence. Never touched by AI.

#### Email 3A: Legal Keyword → human review

| Field | Value |
|-------|-------|
| **From** | `nexire.in@gmail.com` |
| **To** | `cargopaf.demo@gmail.com` |
| **Subject** | `Re: Pre-Alert 874284953658 / PRERANA INNOTECH` |
| **Body** | `This is a legal notice regarding shipment AWB 874284953658. Our attorney will follow up regarding regulatory compliance.` |

**After sending:**
1. Go to Tab 3 (`/human-review`)
2. Poll
3. The case appears with status **"awaiting review"** / **"unresolved"**
4. Show: the safety reason (legal keyword detected — "attorney", "regulatory compliance")
5. Show: **no draft was generated, no reply was sent**

**Say:** *"The AI detected legal keywords — 'attorney', 'regulatory compliance'. It will never touch this. It goes straight to the human review queue and stays there until a person resolves it. No automated reply, no draft, nothing."*

---

#### Email 3B: VIP Sender → human review (optional)

| Field | Value |
|-------|-------|
| **From** | `ceo@company.com` |
| **To** | `cargopaf.demo@gmail.com` |
| **Subject** | `Re: Pre-Alert 874284953652 / ALISHKA GLOBAL` |
| **Body** | `I need an update on this shipment AWB 874284953652 immediately.` |

**After sending:**
1. Poll
2. Show it's also in `/human-review` (VIP safety gate)
3. Even though the question is simple, VIP senders always go to human

**Say:** *"Even a simple question from a VIP sender goes to human review. The AI is conservative by design — it would rather hand something to a person than send a wrong reply to someone important."*

---

## Phase 2: Close the Loop (2 min)

### Show the Audit Trail

1. Go to `/ai/replies` → show all auto-sent replies with timestamps
2. Go to `/ai/drafts` → show all drafts (pending, sent, rejected)
3. Go to `/human-review` → show escalated cases

**Say:** *"Three paths, one rule: routine + safe + confident → automatic; needs a human judgment → draft; risk, VIP, or legal → straight to the team. And every single action is logged."*

### Show the Numbers

1. Go to `/dashboard/prior`
2. Point to: AI Impact card (ownership breakdown), Volume card (reply rate %)
3. Say: *"Before this, replies sat in individual inboxes. Now every reply is logged, classified, and either answered or flagged — in under 10 seconds."*

---

## The 3 Conditions Summary

| Condition | What happens | Where to see it | % of replies |
|-----------|-------------|-----------------|-------------|
| **Routine + safe + confident** | AI auto-sends reply | `/ai/replies` | 25-35% |
| **Needs human judgment** | AI drafts, person approves | `/ai/drafts` | 25-35% |
| **Risk / VIP / legal / unknown** | Goes to human review queue | `/human-review` | 30-40% |

---

## What to Say (The Narrative)

### Opening:
> "When a customer replies to one of our pre-alerts, the AI reads it, classifies it, and does one of three things. Let me show you all three paths live."

### After Path 1:
> "Routine, safe, and unambiguous — the AI replies on its own. The customer got an answer in 10 seconds. No human involved."

### After Path 2:
> "The AI writes the draft — the customer's question, the facts, the tone — but a person always clicks Send. The AI does the writing, the team keeps control."

### After Path 3:
> "VIP senders, legal keywords, low confidence — those never get a single automated word. They land here and stay until a person resolves them."

### Closing:
> "Three paths, one rule: routine + safe + confident → automatic; needs a human judgment → draft; risk, VIP, or legal → straight to the team. And every single action is logged."

---

## Backup Plan

| If this fails... | Do this instead... |
|-----------------|-------------------|
| Emails don't arrive after polling | Show existing data on `/ai/replies` — walk through 2-3 real auto-replies |
| AI draft doesn't appear | Use `/ai/test` page — pick a scenario, click "Preview classification" |
| Platform is down | Show printed `THREE_PATH_CHEAT_SHEET.html` — walk through on paper |
| Gmail blocks sending | Send all from one account, vary subject lines to simulate different consignees |

---

## Quick Reference — All Test Emails

| # | Path | From | Subject | Body |
|---|------|------|---------|------|
| 1A | Auto-send | test1alstom@gmail.com | Re: Pre-Alert 874284953656 / PINKCITY JEWELHOUSE | What are the freight charges and currency for my shipment AWB 874284953656? |
| 1B | Auto-send | bs9932338847@gmail.com | Re: Pre-Alert 874284953654 / GALLANT JEWELRY | Payment done. Please confirm receipt of payment for AWB 874284953654. UTR 789456123. |
| 1C | Ignore | cutq2024@gmail.com | Automatic reply: Out of Office | Thank you for your email. I am out of office until Monday. |
| 2A | Draft | cutq2024@gmail.com | Re: Pre-Alert 874284953657 / RITE CONCEPT JEWELS | We need the invoice and packing list for AWB 874284953657. |
| 2B | Draft | sikder32bipul@gmail.com | Re: Pre-Alert 874284953655 / JAIN GEMS | Will we be charged the 5000 penalty if documents are submitted late for AWB 874284953655? |
| 3A | Human review | nexire.in@gmail.com | Re: Pre-Alert 874284953658 / PRERANA INNOTECH | This is a legal notice regarding shipment AWB 874284953658. Our attorney will follow up. |
| 3B | Human review | ceo@company.com | Re: Pre-Alert 874284953652 / ALISHKA GLOBAL | I need an update on this shipment AWB 874284953652 immediately. |
