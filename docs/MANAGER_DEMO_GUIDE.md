# Senior Manager Demo Guide — AI Auto-Reply for Shipment Queries

Live walkthrough for showcasing the AI that answers customer shipment queries
automatically. Target: Senior Manager (and possibly VP India).

---

## 1. The pitch (45–60 seconds)

> "When a customer replies to one of our pre-alerts asking about their
> shipment, the AI:
>
> 1. reads and classifies the email,
> 2. pulls the **real shipment facts from that AWB's row** in our system,
> 3. writes a professional reply email,
> 4. sends it to the customer automatically — in under 10 seconds.
>
> Routine questions are answered instantly. Anything risky or urgent is never
> auto-sent — it is routed to a human for review."

Key message: **speed + safety + audit trail.** Every auto-reply is tracked, so
you can always see what the AI said and why.

---

## 2. Setup checklist (do this BEFORE the meeting)

- [ ] Dev server running: `npm run dev`
- [ ] A batch is created with real shipment data (the JAI batch from the Excel
      sheet — it has 8 shipments with AWB, consignee, freight, pieces, weight,
      clearance, value, IEC, PIN, etc.)
- [ ] You can reach your own email inbox on the second screen / phone
      (the AI will reply to the `From` address you type)
- [ ] Supabase migrations applied (SQL script ran successfully)
- [ ] Quick sanity check: open `/ai/test` → pick **Shipment info request** →
      click **Preview classification (no send)** → confirm route is
      **ai_auto_send** with confidence ≥ 80%

---

## 3. Demo flow (step by step)

### Step 1 — Show the shipment data is captured
Open the batch page for the JAI batch.

> "When we create a batch, every shipment's facts are captured here — AWB,
> consignee, freight, currency, pieces, weight, clearance path, value, IEC,
> PIN. This is the data the AI answers from. It never makes things up — it
> only tells the customer what is actually in our system."

Point at 1–2 rows, e.g. **874285969197 — Pinkcity Jewelhoise — NFBRK —
9 pcs — 73.9 kg — INR 44,502**.

### Step 2 — Introduce the test harness
Open `/ai/test`.

> "This is our AI test lab. I'll send a message the way a customer would, and
> show you how the system decides and replies. I'll use my own email as the
> customer so the reply lands in my inbox live."

### Step 3 — Show the guardrails (no email sent yet)
Click the **Shipment info request** scenario. Set **From** to your own email.
Pick AWB **874285969197** from the dropdown (or type it).

Click **Preview classification (no send)** and read out the result card:

- Route badge: **AI auto-send**
- Clearance: **nfbrk** · Intent: **inquiry** · Urgency: **normal**
- Confidence bar (≈ 95%)
- **Stage details**: rules matched → ML similar-emails → LLM verifier

> "Before any reply, three layers agree on what this is: fast keyword rules,
> a similarity lookup against past emails, and an LLM verifier. Only when they
> agree at high confidence does the AI earn the right to send."

### Step 4 — The moment: AI replies to the customer
Click **Run full pipeline (sends email)**.

Watch the button spin, then show your inbox (phone or second screen) —
**the reply arrives within seconds**.

> "And there it is — the AI has replied to the customer. It includes the
> AWB, consignee, clearance path, pieces, weight, freight, value, IEC, PIN,
> and current status — all taken from that AWB's row. No human touched this
> email."

The reply lands **inside the same email thread** (reply-to, not a new
message), and the whole pipeline runs in **~10 seconds**: rule fast-path
classification (~1-2s, no LLM for routine queries) + grounded reply
generation (~8s). Incoming mail is polled **every minute** on the deployed
cron, or instantly via the **Poll mailbox now** button on the AI Replies page.

### Step 5 — The audit trail
Open **`/ai/replies`** (nav → AI Auto-Replies).

> "Every auto-reply is tracked here. You can see the customer's original
> question on one side and exactly what the AI replied on the other, with the
> classification and confidence. Full transparency — nothing the AI sends is
> invisible."

Show the row for your test: query on the left, AI reply on the right.

### Step 6 — Show it knows when NOT to reply
Back on `/ai/test`, click **Urgent request** and **Preview classification**.

> "Now the same customer says it's urgent. The AI does NOT auto-reply —
> route changes to draft for review / human review. Same for escalations,
> legal keywords, and VIP customers. The AI is fast, but it knows when a
> human should step in."

Click **Escalation / complaint** too and show it again (draft hold).

### Step 7 — (If time) The closed case
Open the case for the test AWB (link on the test page). Show the timeline:

> "The case shows the full story: reply received → AI auto-replied → case
> closed. Automatically."

---

## 4. The exact test email text

Trigger text (type it into the test harness, or send it as a real email to
the app's mailbox):

```
Subject: Need more info about my shipment

Hi Team,
Please share the current status and details of our shipment.

AWB: 874285969197

Regards,
Pinkcity Jewelhoise
```

Rules that make it work:

- The **AWB must be 12 digits** written in the subject or body — the system
  uses it to find the shipment and load that row's facts.
- The reply is sent to the **From** address — use your own email to receive it.
- AWB must exist in a created batch, otherwise the AI has no facts to state
  (it will still reply but only with the limited information available).

Other AWBs from the same sheet you can use:

| AWB | Consignee | Clearance | Pieces | Weight | Freight |
|---|---|---|---|---|---|
| 533042601093 | Alishka Global | NFBRK | 1 | 1 kg | HKD 337.83 |
| 533042600980 | Gallant Jewelry | FEBRK | 2 | 3 kg | HKD 326.33 |
| 874281326424 | Jain Gems International LLP | HOLD | 1 | 21.4 kg | INR 13,333.50 |
| 874285969197 | Pinkcity Jewelhoise Pvt. Ltd | NFBRK | 9 | 73.9 kg | INR 44,502.20 |
| 874288645661 | Rite Concept Jewels Pvt Ltd | NFBRK | 1 | 3.5 kg | INR 13,240.40 |
| 874250144418 | Prerana Innotech | NFBRK | 3 | 28 kg | CNY 1,136.39 |
| 874284953651 | Soni International Jew Pvt Co. | NFBRK | 2 | 21.3 kg | INR 26,322.60 |

---

## 5. Conditions — when the AI auto-replies

| Condition | Auto-reply? |
|---|---|
| Routine info query (status / IGM / DO / charges) or confirmation/ack | ✅ auto-send (~1-2s classify + ~8s reply) |
| Out-of-office / mail bounce (machine noise) | ✅ auto-ignored, no draft, no human |
| Message contains a valid AWB and a case exists | ✅ required |
| Safety gate passes, sender not VIP, no legal keywords | ✅ required |
| Ensemble confidence ≥ 80%, no missing facts (grounded in AWB row) | ✅ required |
| Urgent / high-urgency / escalation / complaint | ❌ human review |
| Legal keywords (attorney, lawsuit, regulatory) or VIP sender | ❌ human review |
| Documents request | ❌ draft for human approval |
| No AWB in the message | ❌ ingested, no case, no reply |

The auto-reply is sent as a **reply in the same email thread**
(`In-Reply-To` + `References` headers), so the customer sees it as a
continued conversation with our pre-alert — not a new email.

> **Ready-made demo script:** see `docs/THREE_PATH_DEMO.md` for the exact
> emails (from real consignee IDs) that show **PROVEN SAFE (AI sends)**,
> **DEFAULT PATH (AI drafts, human sends)**, and **ESCALATED (human review
> queue)** — including an unresolved case that stays in the human review queue.

Explain it simply: **routine + confident + safe → automatic. Everything else
goes to a person.**

---

## 6. Likely questions (and answers)

**"What if the AI gives a wrong answer?"**
> It only states facts from the shipment's own row. If a fact is not in the
> system (e.g. IGM not generated yet), it tells the customer it will be
> provided once generated — it never invents data. And every reply is logged
> on the AI Replies page for review.

**"Why not let it handle everything?"**
> We deliberately restrict it. Urgent, escalated, legal, and VIP cases always
> go to a human. Speed matters, but trust matters more.

**"Is this live in production?"**
> The pipeline is fully built and tested against real shipment data. The
> demo you just saw used real data from our Jaipur batch.

**"How long does the reply take?"**
> Around 5–10 seconds from the email arriving to the reply being sent.

**"What about the DO charges / IGM questions?"**
> Also handled as routine auto-replies — the AI states the current status from
> the system and the standard process (e.g. DO payment to Deldo with UTR +
> authority letter).

---

## 7. Fallbacks (if something fails live)

- **Preview still works** — even if the email send fails, the classification
  screen shows the whole guardrail logic.
- **AI Replies page** — if no new reply arrives, show the existing history
  on `/ai/replies` and explain how each reply was logged.
- **Skip /ai/test entirely** — open `/ai/replies` and walk through 2–3 real
  auto-replies that already exist.
- If the LLM call is slow, it only adds ~3–4 seconds; stay on the
  classification screen and narrate while it loads.

---

## 8. One-line close

> "Customers get an instant, accurate answer about their shipment. The team
> spends time only on the exceptions that actually need a person. That's the
> system."
