# 3-Path Demo — Show the Manager All Three AI Decisions

A live script that demonstrates every decision the AI makes, using real
consignee email IDs already in the platform. Send each email **from the listed
consignee account** to the platform mailbox (`cargopaf.demo@gmail.com`), then
hit **Poll mailbox now** on `/ai/replies` (or wait ≤1 min for the cron).

## The three paths

| Path | What the AI does | Where it shows up |
|---|---|---|
| **PROVEN SAFE** | AI sends the reply (or recognizes machine noise and handles it silently) | `/ai/replies` — outbound auto-reply visible |
| **DEFAULT PATH** | AI drafts, a human always clicks Send | `/ai/drafts` — pending draft awaiting approval |
| **ESCALATED** | Goes to a human review queue — never touched by AI | `/human-review` — unresolved, "awaiting review" |

---

## Path 1 — PROVEN SAFE · "AI sends it" (zero judgment needed)

### 1A. Generic freight FAQ → AI auto-replies
- **From:** `test1alstom@gmail.com` (PINKCITY JEWELHOUSE PVT. LTD.)
- **Subject:** `Re: Pre-Alert 874284953656 / PINKCITY JEWELHOUSE`
- **Body:**
  ```
  What are the freight charges and currency for my shipment AWB 874284953656?
  ```
- **Expected:** `ai_auto_send` (rule fast-path, ~0.5s) → grounded reply with
  the real freight + currency from the AWB row is sent to the customer. The
  reply lands **in the same email thread**.

### 1B. Payment confirmation → AI acknowledges
- **From:** `bs9932338847@gmail.com` (GALLANT JEWELRY)
- **Subject:** `Re: Pre-Alert 874284953654 / GALLANT JEWELRY`
- **Body:**
  ```
  Payment done. Please confirm receipt of payment for AWB 874284953654. UTR 789456123.
  ```
- **Expected:** `ai_auto_send` (~0.3s) → confirmation reply sent.

### 1C. Out-of-office auto-reply → AI recognizes and suppresses
- **From:** `cutq2024@gmail.com` (RITE CONCEPT JEWELS PVT LTD)
- **Subject:** `Automatic reply: Out of Office`
- **Body:**
  ```
  Thank you for your email. I am out of office until Monday and will respond on my return.
  ```
- **Expected:** `ignore` (~0.3s) → no reply sent to an auto-responder, no draft,
  no human. The case is marked AI-handled silently.

### 1D. Mail bounce → AI recognizes and suppresses
- **From:** `mailer-daemon@gmail.com`
- **Subject:** `Delivery Status Notification (Failure)`
- **Body:**
  ```
  Delivery has failed for the following recipient: sikder16bipul@gmail.com
  ```
- **Expected:** `ignore` (~0.3s) → handled silently, no draft.

> **Talking point:** "Routine, safe, and unambiguous — the AI replies on its
> own. It even recognizes out-of-office auto-replies and mail bounces and
> quietly sets them aside. Nothing here ever needs a person."

---

## Path 2 — DEFAULT PATH · "AI drafts, human sends"

### 2A. Documents / checklist request → AI drafts, you send
- **From:** `cutq2024@gmail.com` (RITE CONCEPT JEWELS PVT LTD)
- **Subject:** `Re: Pre-Alert 874284953657 / RITE CONCEPT JEWELS`
- **Body:**
  ```
  We need the invoice and packing list for AWB 874284953657. Please share them.
  ```
- **Expected:** `ai_draft_hold` → a pending draft appears in `/ai/drafts` with
  the customer's message on top and the AI's reply below. **Click Approve &
  Send** → it goes out (threaded as a reply), the draft moves to *Sent*.

### 2B. Follow-up with penalty concern → AI drafts, you send
- **From:** `sikder32bipul@gmail.com` (JAIN GEMS INTERNATIONAL LLP)
- **Subject:** `Re: Pre-Alert 874284953655 / JAIN GEMS`
- **Body:**
  ```
  Will we be charged the 5000 penalty if the documents are submitted late for AWB 874284953655?
  ```
- **Expected:** `ai_draft_hold` → pending draft, human reviews and sends.

> **Talking point:** "The AI writes the draft — the customer's question, the
> facts, the tone — but a person always clicks Send. Every checklist, status
> query, and follow-up works this way. The AI does the writing, the team keeps
> control."

---

## Path 3 — ESCALATED · "Human review queue" (never touched by AI)

### 3A. Legal keyword → human review
- **From:** `nexire.in@gmail.com` (PRERANA INNOTECH)
- **Subject:** `Re: Pre-Alert 874284953658 / PRERANA INNOTECH`
- **Body:**
  ```
  This is a legal notice regarding shipment AWB 874284953658. Our attorney will follow up regarding regulatory compliance.
  ```
- **Expected:** `human_review` (safety gate SG-02 — legal keyword) → case appears
  in `/human-review` as **unresolved / awaiting review**, never auto-replied.

### 3B. VIP sender → human review
- **From:** `ceo@company.com` (configured VIP sender)
- **Subject:** `Re: Pre-Alert 874284953652 / ALISHKA GLOBAL`
- **Body:**
  ```
  I need an update on this shipment AWB 874284953652 immediately.
  ```
- **Expected:** `human_review` (safety gate SG-03 — VIP) → unresolved in the
  human review queue.

> **Talking point:** "VIP senders, legal keywords, low confidence, or anything
> the AI has never seen — those never get a single automated word. They land
> here, marked for human review, and stay there until a person resolves them."

---

## Live demo flow (5 minutes)

1. **Setup check** — open `/ai/replies`, `/ai/drafts`, and `/human-review`
   (three tabs).
2. **Path 1** — send 1A (freight FAQ) and 1B (payment confirm). Click **Poll
   mailbox now**. Show the auto-replies appear in `/ai/replies` within ~10s,
   threaded as replies. Optionally send 1C (OOO) and 1D (bounce) and show they
   were handled with no draft.
3. **Path 2** — send 2A (documents request). Poll. Open `/ai/drafts` → show the
   customer message + AI draft. **Approve & Send** in front of the manager →
   it sends as a reply.
4. **Path 3** — send 3A (legal). Poll. Open `/human-review` → show the case
   **awaiting review**, unresolved. Point out the safety reason.
5. **Close the loop** — "Three paths, one rule: routine + safe + confident →
   automatic; needs a human judgment → draft; risk, VIP, or legal → straight to
   the team. And every single action is logged."

## Verification (run before the meeting)

```
cd cargo-paf && npx tsc --noEmit
```
The live route checks (fast-path results, all <1s for Path 1, `ignore` for
1C/1D, `ai_draft_hold` for Path 2, `human_review` for Path 3) were verified
against the dev server with the exact bodies above.
