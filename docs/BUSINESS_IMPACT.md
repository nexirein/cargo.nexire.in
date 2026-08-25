# Business Impact — 4 Slides, One Story

---

## Slide 1: The Cost of Doing Nothing

### 7 People. Every Day. Doing the Same Things.

| Task | People | Time/Day |
|------|--------|----------|
| Excel processing (100-500 AWBs) | 2 | 2-4 hrs |
| Clearance research (Outlook digging) | 2 | 2-3 hrs |
| Phone calls (CALLING entries) | 3 | 1-2 hrs |
| Email sending (100-500 emails) | 1 | 30-40 min |
| Reply tracking + follow-up | 2 | 2-3 hrs |

**7 people. 8-14 hours/day. ₹2,10,000/month in labor — before a single penalty.**

### The Penalty Problem (Real Money Lost Today)

| Penalty | Rate | Monthly Exposure |
|---------|------|-----------------|
| BOE Late Filing | ₹5,000-10,000/day | ₹1,50,000-3,00,000 |
| DO Overdue | ₹1,000/day + GST | Included above |

> Penalties are discovered **only when the customer calls to complain.**

### How the Platform Prevents Penalties

```
Day 0: Pre-alert sent → Reminder scheduled (24h NFBRK / 48h FEBRK)
Day 1: No reply? → Reminder 1 (gentle)
Day 2: Still no reply? → Reminder 2 (escalation)
Day 3: Final reminder (penalty warning) → Escalate to manager
Result: Case resolved BEFORE penalty kicks in
```

### Total Real Cost of Today's Process

```
Labor:         ₹2,10,000/month
Penalties:     ₹1,50,000 - ₹3,00,000/month
─────────────────────────────────────
TOTAL:         ₹3,60,000 - ₹5,10,000/month
```

> **₹3.6 to ₹5.1 lakhs per month. Every month. For the same repetitive tasks.**

---

## Slide 2: The Platform — Cost & Savings

### What the Platform Costs

| Component | What It Does | Monthly Cost |
|-----------|-------------|-------------|
| **Vercel** | Hosting + serverless functions + crons | ₹1,700 |
| **Supabase** | Database + auth + storage + pgvector | ₹2,100 |
| **Upstash Redis** | Token cache + distributed locks | ₹850 |
| **Google Gemini** | LLM chat + embeddings (classify, draft, embed) | ₹850-1,700 |
| **Bolna AI** | Voice calls to consignees in Hinglish | ₹2,500-4,200 |
| **GitHub Actions** | Cron jobs (inbox poll, reminders) | ₹0 |
| **SMTP/Graph** | Email sending (FedEx Exchange) | ₹0 |
| **OpenAI** | Training-time labeling (dev only) | ₹420-850 |
| **TOTAL** | | **₹8,420 - ₹11,400/month** |

### Before vs After

| | Manual (Today) | Platform (Tomorrow) |
|---|---|---|
| **People** | 7 | 1 (35-45 min/day) |
| **Monthly cost** | ₹3.6L - ₹5.1L | ₹8,420 - ₹11,400 |
| **Penalties** | Discovered late | Tracked, prevented |
| **Response time** | 4-7 min per case | 10 seconds (AI) |
| **Knowledge** | In people's heads | In database, forever |
| **Audit trail** | None | Every action logged |

### The Numbers

```
Net savings:     ₹3.5L - ₹5L/month
Annual savings:  ₹42L - ₹60L/year
ROI:             The platform pays for itself in under a day.
```

> **For every ₹1 spent on the platform, ₹35-50 is saved in labor + penalties.**

---

## Slide 3: The Realistic Split — What the AI Actually Handles

### Not 98%. Here's the Truth.

The AI classifier has 3 routes — and the safety gates are strict:

```
┌─────────────────────────────────────────────────────────────┐
│              REPLY DISTRIBUTION                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ROUTE 1: AI AUTO-SEND (confidence ≥ 0.97)                  │
│  ─────────────────────────────────────────────               │
│  • Routine freight FAQ (status, DO, IGM, charges)            │
│  • Payment confirmations                                     │
│  • Out-of-office / mail bounces (ignored silently)           │
│  • Only NFBRK clearance type (V1 scope)                      │
│  • Only when ALL safety gates pass                           │
│                                                              │
│  SHARE: 25-35% of total replies                              │
│                                                              │
│  ─────────────────────────────────────────────               │
│                                                              │
│  ROUTE 2: AI DRAFT, HUMAN APPROVES (confidence 0.70-0.96)   │
│  ─────────────────────────────────────────────               │
│  • Documents / checklist requests                            │
│  • Penalty questions                                         │
│  • Status queries that need context                          │
│  • AI writes the draft, human reviews & approves             │
│                                                              │
│  SHARE: 25-35% of total replies                              │
│                                                              │
│  ─────────────────────────────────────────────               │
│                                                              │
│  ROUTE 3: HUMAN REVIEW (safety gate triggered)               │
│  ─────────────────────────────────────────────               │
│  • Legal keywords (attorney, lawsuit, regulatory)            │
│  • VIP senders                                               │
│  • Urgent / high-urgency emails                              │
│  • Low confidence (< 0.70)                                   │
│  • ALL FEBRK / calling / hold replies (V1 = NFBRK only)     │
│  • Unknown AWB (not in our system)                           │
│                                                              │
│  SHARE: 30-40% of total replies                              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

> **30-40% still need a human. That's not a failure — that's the safety system working.**

### Why 30-40% Go to Human

| Reason | Why |
|--------|-----|
| FEBRK / calling / hold | V1 = NFBRK only. FEBRK has multi-party CC threads — too risky for AI |
| Legal keywords | "Attorney", "lawsuit" — never auto-reply |
| VIP senders | CEO, management — human judgment required |
| Urgent emails | "ASAP", "emergency" — needs immediate attention |
| Low confidence | AI isn't sure — better safe than sorry |

### What the Person Actually Does

| Task | Time |
|------|------|
| Review AI drafts (approve/edit/reject) | 10-15 min/day |
| Handle human-review queue | 15-20 min/day |
| Override AI mistakes | 5 min/day |
| Mark DO payments | 5 min/day |
| **TOTAL** | **35-45 min/day** |

> **The person's day drops from 8 hours of repetitive work to 35-45 minutes of judgment calls.**

### Pilot First, Decide Later

```
PHASE 1 (Weeks 1-4):  Platform runs alongside team. Measure everything.
PHASE 2 (Weeks 5-8):  Compare AI vs manual. Full efficiency analysis.
PHASE 3 (Week 9+):    Data-driven headcount decision.
```

> **We pilot first. We measure everything. Then we decide based on data — not gut feel.**

---

## Slide 4: The Vision — Beyond Cargo

### Cargo is the Pilot, Not the Product

```
TODAY: Cargo Pre-Alerts (this platform)
  ↓
TOMORROW: Same pattern, different ops
  ├── SD (Small Deliveries)
  ├── RBOE (Regional Bonded)
  ├── CD (Customs-Delayed)
  └── Other gateways (Delhi, Mumbai, Bangalore)
  ↓
FUTURE: Any repetitive, rule-bound ops workflow
  ├── Invoice processing
  ├── Customer onboarding
  ├── Compliance tracking
  └── Any workflow where "AI does the routine, human does the judgment"
```

> **The goal isn't automating tasks one at a time — it's making the repetitive, rule-bound 80% of ops something AI reliably owns end-to-end, while every judgment call stays exactly where it belongs: with a person.**

---

## Single Source of Truth (Use These Numbers Everywhere)

| Metric | Value |
|--------|-------|
| **Manual labor** | 7 people × ₹30,000/month = ₹2,10,000/month |
| **Penalty exposure** | ₹1,50,000 - ₹3,00,000/month |
| **Total manual cost** | ₹3,60,000 - ₹5,10,000/month |
| **Platform cost** | ₹8,420 - ₹11,400/month (~₹10,000 for speaking) |
| **Net savings** | ₹3.5L - ₹5L/month |
| **Annual savings** | ₹42L - ₹60L/year |
| **ROI** | "Pays for itself in under a day" |
| **Auto-send rate** | 25-35% of replies |
| **Draft rate** | 25-35% of replies |
| **Human review rate** | 30-40% of replies |
| **Person's daily time** | 35-45 min/day |

---

## Speaker Notes

### Slide 1 — Cost of Doing Nothing:
> "7 people, every day, doing the same tasks. ₹2.1 lakhs a month in labor. Plus ₹1.5-3 lakhs in penalties we're not preventing — discovered only when the customer calls to complain. Total: ₹3.6 to ₹5.1 lakhs per month. Every month."

### Slide 2 — Platform Cost & Savings:
> "The platform costs ₹8,400 to ₹11,400 a month — hosting, database, AI, voice calling. That's ₹10,000 round number. Compared to ₹3.6 to ₹5.1 lakhs we spend today. Net savings: ₹3.5 to ₹5 lakhs a month. ₹42 to ₹60 lakhs a year. The platform pays for itself in under a day."

### Slide 3 — Realistic Split:
> "Let me be honest. The AI auto-replies to 25-35% of emails — routine, safe, high-confidence. It drafts replies for another 25-35% — AI writes it, person approves. And 30-40% go to human review — legal cases, VIP senders, urgent emails, FEBRK threads. That's not a failure. That's the safety system working. The person's day drops from 8 hours of repetitive work to 35-45 minutes of judgment calls. We pilot first, measure everything, then decide based on data."

### Slide 4 — Vision:
> "Cargo is the pilot, not the product. Same pattern — upload, auto-fill, send, track, follow-up — works for SD, RBOE, CD, and any repetitive ops workflow. The goal isn't automating tasks one at a time. It's making the rule-bound 80% something AI owns, while every judgment call stays with a person."
