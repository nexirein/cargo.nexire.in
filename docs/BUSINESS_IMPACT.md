# Business Impact — The Numbers That Matter

---

## Slide: The Cost of Doing Nothing

### What 10 People Do Today (Manually)

| Task | People | Time per Day | Monthly Cost (₹) |
|------|--------|-------------|-------------------|
| Excel processing (100-500 AWBs) | 2 people | 2-4 hrs | ₹60,000 |
| Clearance research (Outlook digging) | 2 people | 2-3 hrs | ₹60,000 |
| Phone calls (CALLING entries) | 3 people | 1-2 hrs | ₹90,000 |
| Email sending (100-500 emails) | 1 person | 30-40 min | ₹30,000 |
| Reply tracking (manual inbox check) | 1 person | 1-2 hrs | ₹30,000 |
| Follow-up / reminder calls | 1 person | 1 hr | ₹30,000 |
| **TOTAL** | **~7 people** | **8-14 hrs/day** | **₹3,00,000/month** |

> **This is what 7 people do every single day. The same tasks. Every day.**

---

### What the Platform Does (Automated)

| Task | Platform | Time | Monthly Cost |
|------|----------|------|-------------|
| Excel processing + clearance fill | Auto-fill engine + VBA | 10 min | ₹0 (free tier) |
| Clearance research | 36K master DB + fuzzy match | Instant | ₹0 |
| Phone calls (unresolved only) | AI voice agent (Bolna) | 1-2 min per batch | ₹2,500-4,200 (~200 calls) |
| Email sending | SMTP pipeline + templates | 3-5 min per batch | ₹0 (IT-provided) |
| Reply tracking | IMAP poll + case management | Every 2 min, automated | ₹0 |
| Follow-up / reminders | AI scheduler + drafts | Automated, human-approved | ₹0 |
| **SUBTOTAL (Operations)** | **1 person clicks buttons** | **30-60 min/day** | **₹2,500-4,200/month** |

> **The same work. One person. 30 minutes. ₹2,500-4,200 vs ₹3,00,000.**

---

### Server & Platform Infrastructure Costs

| Platform | What It Does | Plan | Monthly Cost |
|----------|-------------|------|-------------|
| **Vercel** | Hosting + serverless functions + GitHub Actions crons | Hobby (free) → Pro (for crons) | ₹0 → ₹1,700 ($20) |
| **Supabase** | Database + auth + storage + pgvector embeddings | Free tier → Pro (for production) | ₹0 → ₹2,100 ($25) |
| **Upstash Redis** | Token cache + distributed locks (ephemeral, no PII) | Free tier → Pay-as-you-go | ₹0 → ₹850 ($10) |
| **Google Gemini API** | LLM chat + embeddings (classify, draft, embed) | Pay-per-use | ₹850-1,700 ($10-20) |
| **GitHub Actions** | Cron jobs (inbox poll, reminders, requeue) | Free (public repo) | ₹0 |
| **SMTP / Graph** | Email sending (FedEx Exchange mailbox) | IT-provided | ₹0 |
| **OpenAI** | Training-time LLM labeling (dev only, not runtime) | Pay-per-use | ₹420-850 ($5-10) |
| **TOTAL PLATFORM** | | | **₹5,920-7,200/month** |

> **Platform infrastructure: ₹5,920-7,200/month (~$70-85/month)**

---

### Total Cost — Platform + Operations Combined

```
┌─────────────────────────────────────────────────────────────┐
│              TOTAL MONTHLY COST (Platform + Ops)             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Operations (AI calling):        ₹2,500 - ₹4,200            │
│  Vercel (hosting + crons):       ₹1,700                     │
│  Supabase (database + storage):  ₹2,100                     │
│  Upstash Redis (cache + locks):  ₹850                       │
│  Google Gemini (LLM + embed):    ₹850 - ₹1,700              │
│  GitHub Actions (crons):         ₹0                         │
│  SMTP/Graph (email):             ₹0 (IT-provided)           │
│  OpenAI (training only):         ₹420 - ₹850                │
│  ─────────────────────────────────────────────               │
│  TOTAL PLATFORM COST:            ₹8,420 - ₹11,400/month     │
│                                                              │
│  vs                                                          │
│                                                              │
│  MANUAL LABOR:                     ₹3,00,000/month           │
│  PENALTY EXPOSURE:                 ₹1,50,000 - ₹3,00,000    │
│  ─────────────────────────────────────────────               │
│  TOTAL MANUAL COST:               ₹4,50,000 - ₹6,00,000     │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  NET SAVINGS:  ₹4,38,600 - ₹5,88,600/month          │    │
│  │  ANNUAL SAVINGS: ₹52.6 lakhs - ₹70.6 lakhs          │    │
│  │  ROI: 40x - 53x return on ₹11,400/month investment   │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Slide: The 10x Comparison

### Manual (Today) vs Platform (Tomorrow)

```
┌─────────────────────────────────────────────────────────────────┐
│                    10 BANDE KA KAM                              │
│               One platform. One person. One click.              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  BEFORE (Manual)              AFTER (Platform)                 │
│  ─────────────────            ─────────────────                 │
│  7-10 people                  1 person                          │
│  8-14 hours/day               30-60 min/day                     │
│  ₹3,00,000/month              ₹4,800/month                      │
│  No audit trail               Full audit trail                  │
│  Penalties hidden             Penalties visible                 │
│  Knowledge in heads           Knowledge in database             │
│  Inconsistent replies         AI-drafted, human-approved        │
│  Manual tracking              Auto-tracked + reminders          │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  COST REDUCTION: 98.4%                                  │   │
│  │  TIME REDUCTION: 90%+                                   │   │
│  │  PEOPLE REDUCTION: 9 people freed up                    │   │
│  │  PENALTY AVOIDANCE: ₹5K-₹10K/day per case              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Slide: Where the Money Goes

### Cost Breakdown — What You Save

| Category | Manual Cost (Monthly) | Platform Cost (Monthly) | Savings |
|----------|----------------------|------------------------|---------|
| **People time** (7 people × ₹30K/month) | ₹2,10,000 | ₹0 (1 person, existing salary) | ₹2,10,000 |
| **Penalty exposure** (BOE ₹5K-10K/day + DO ₹1K/day) | ₹1,50,000 - ₹3,00,000 | ₹0 (tracked, reminded, avoided) | ₹1,50,000 - ₹3,00,000 |
| **AI calling** (200 calls/month) | ₹0 (manual calls) | ₹2,500 - ₹4,200 | -₹2,500 - ₹4,200 |
| **Email sending** (manual Outlook) | ₹0 (manual) | ₹0 (SMTP/Graph) | ₹0 |
| **Server hosting** (Vercel + Supabase + Redis) | ₹0 (no system) | ₹4,650 | -₹4,650 |
| **AI/LLM costs** (Gemini + OpenAI training) | ₹0 (no AI) | ₹1,270 - ₹2,550 | -₹1,270 - ₹2,550 |
| **TOTAL** | **₹3,60,000 - ₹5,10,000** | **₹8,420 - ₹11,400** | **₹3,48,600 - ₹4,98,600** |

> **Net savings: ₹3.5 - ₹5 lakhs per month.**
> **Annual savings: ₹42 - ₹60 lakhs.**
> **Every ₹1 spent on the platform saves ₹40-53 in manual labor + penalties.**

---

## Slide: The Penalty Problem (Real Money Lost Today)

### What Happens When Nobody Tracks

| Penalty Type | Rate | Per Case | 10 Cases/Day | Monthly Exposure |
|-------------|------|----------|-------------|-----------------|
| **BOE Late Filing** | ₹5,000 - ₹10,000/day | ₹5,000 - ₹10,000 | ₹50,000 - ₹1,00,000 | ₹15,00,000 - ₹30,00,000 |
| **DO Overdue** | ₹1,000/day + GST | ₹1,000 | ₹10,000 | ₹3,00,000 |
| **Customer Complaints** | Reputation cost | — | — | Unmeasured |

> **Today: Penalties are discovered when the customer calls to complain.**
> **Tomorrow: Penalties are tracked in real-time, reminders fire before deadlines.**

### How the Platform Prevents Penalties

```
Day 0: Pre-alert sent → Case created → Reminder scheduled (24h NFBRK / 48h FEBRK)
         │
Day 1: No reply? → Reminder 1 sent (gentle)
         │
Day 2: Still no reply? → Reminder 2 sent (escalation)
         │
Day 3: Final reminder (penalty warning) → Escalate to manager
         │
Result: Case resolved BEFORE penalty kicks in
```

---

## Slide: Throughput — How Fast Does It Work?

### Per Batch Comparison

| Metric | Manual | Platform | Improvement |
|--------|--------|----------|-------------|
| **Excel processing** | 2-4 hours | 10 minutes | **12-24x faster** |
| **Clearance research** | 2-3 hours | Instant (master DB) | **Instant** |
| **Phone calls** | All day (rotated across 7 people) | 1-2 minutes (AI, single shot) | **100x+ faster** |
| **Email sending** | 30-40 min per 200 emails | 3-5 min per 200 emails | **8-10x faster** |
| **Reply detection** | Manual inbox check (hours) | Every 2 minutes (automated) | **Continuous** |
| **Follow-up** | "Did you follow up?" meetings | Auto-scheduled, AI-drafted | **Zero manual effort** |

### Daily Throughput

```
MANUAL:     100-500 AWBs/day
            × 7 people working
            × 8-14 hours
            = ₹3,00,000/month in labor

PLATFORM:   100-500 AWBs/day
            × 1 person clicking buttons
            × 30-60 minutes
            = ₹4,800/month in AI costs

SAME OUTPUT. 98% LESS COST. 90% LESS TIME.
```

---

## Slide: The AI Agent — Doing 10 People's Calls in One Shot

### Before (Manual Calling)

```
7 people × 20 calls/day × 5 min/call = 70 calls/day, all day
Each person stops their other work to make calls
Calls are scattered, rotated, inconsistent
No record of what was said or confirmed
```

### After (AI Voice Agent)

```
1 click → AI places all 20 calls simultaneously
1-2 minutes → all calls complete
Results write back to database automatically
Master DB learns → next time, same company is known
0 people interrupted
```

### The Numbers

| Metric | Manual (7 people) | AI Agent (1 click) |
|--------|-------------------|-------------------|
| **Calls per batch** | 20 (spread across day) | 20 (simultaneous, 1-2 min) |
| **People interrupted** | 6-7, repeatedly | 0 |
| **Time per call** | 4-7 min (call + note + mail + sheet) | 1-2 min (call only) |
| **Cost per batch** | ₹4,750 - ₹11,090/month | ₹1,800 - ₹4,800/month |
| **Batch finish time** | All day (scattered) | 1-2 minutes (one pass) |
| **Record of what was said** | None (mental notes) | Full transcript logged |

> **50-60% cost reduction. Plus the batch finishes in one pass instead of being scattered across everyone's day.**

---

## Slide: What You Get for ₹11,400/Month

### The Complete Package — Platform + Operations

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
| **TOTAL** | | **₹8,420 - ₹11,400** |

### What This Delivers

| Feature | What It Does | Value |
|---------|-------------|-------|
| **Clearance Fill** | Auto-resolves 80-90% of rows without calls | Saves 4-6 hours/day |
| **AI Voice Calling** | Calls remaining 10-20% in Hinglish, 1-2 min | Saves 6-7 people's time |
| **Send Pipeline** | 200+ emails in 3-5 min with templates | Saves 30-40 min/day |
| **Reply Tracking** | Every reply detected, classified, linked | Saves manual inbox checking |
| **AI Auto-Reply** | Routine queries answered in 10 seconds | Saves 4-7 min per case |
| **Follow-up Scheduler** | Reminders before deadlines, AI-drafted | Prevents penalties |
| **Dashboards** | Real-time visibility, penalty exposure | Enables management decisions |
| **Audit Trail** | Every action logged, nothing invisible | Compliance + accountability |

> **For ₹11,400/month (~$135) — less than one person's weekly wage — you get the output of 10 people working full-time.**

---

## Slide: The Real ROI

### Investment vs Return (Including All Platform Costs)

```
┌─────────────────────────────────────────────────────────────┐
│                    RETURN ON INVESTMENT                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  INVESTMENT (Monthly)                                        │
│  ──────────────────                                          │
│  Platform development:        Done (by Bipul, zero cost)     │
│  Vercel (hosting + crons):    ₹1,700 ($20)                  │
│  Supabase (DB + storage):     ₹2,100 ($25)                  │
│  Upstash Redis (cache):       ₹850 ($10)                    │
│  Google Gemini (LLM + embed): ₹850-1,700 ($10-20)           │
│  Bolna AI calling:            ₹2,500-4,200 ($30-50)         │
│  GitHub Actions (crons):      ₹0 (free)                     │
│  SMTP/Graph (email):          ₹0 (IT-provided)              │
│  OpenAI (training only):      ₹420-850 ($5-10)              │
│  ─────────────────────────────────────────────               │
│  TOTAL MONTHLY INVESTMENT:     ₹8,420 - ₹11,400             │
│                                (~$100-135/month)             │
│                                                              │
│  RETURN (Monthly)                                            │
│  ────────────────                                            │
│  Labor savings:               ₹2,10,000 (7 people freed)    │
│  Penalty avoidance:           ₹1,50,000 - ₹3,00,000         │
│  Faster response:             Customer satisfaction ↑         │
│  Audit trail:                 Compliance ↑                    │
│  Knowledge capture:           No more "person leaves = lost" │
│  ─────────────────────────────────────────────               │
│  TOTAL MONTHLY SAVINGS:       ₹3,60,000 - ₹5,10,000         │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  ROI: 40x - 53x return on ₹11,400/month investment  │    │
│  │  PAYBACK PERIOD: Less than 1 day                     │    │
│  │  ANNUAL SAVINGS: ₹52.6 - ₹70.6 lakhs                │    │
│  │                                                      │    │
│  │  For every ₹1 spent on the platform,                 │    │
│  │  FedEx saves ₹40-53 in labor + penalties.            │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Slide: The Human Role — What Changes, What Stays

### The Person Stays. The Work Changes.

```
┌─────────────────────────────────────────────────────────────┐
│              BEFORE vs AFTER — DAILY WORKFLOW                │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  BEFORE (Today)                                              │
│  ──────────────                                              │
│  7 people × 8-14 hours/day                                   │
│  ├── Excel processing (2-4 hrs)                              │
│  ├── Outlook clearance research (2-3 hrs)                    │
│  ├── Phone calls (1-2 hrs, rotated)                          │
│  ├── Email sending (30-40 min)                               │
│  ├── Reply checking (1-2 hrs)                                │
│  └── Follow-up calls (1 hr)                                  │
│                                                              │
│  AFTER (Platform)                                            │
│  ────────────────                                            │
│  1 person × 30-60 min/day                                    │
│  ├── Upload Excel → auto-fill (10 min)                       │
│  ├── Review AI calls results (5 min)                         │
│  ├── Click "Send" on pre-alerts (5 min)                      │
│  ├── Review AI drafts → Approve & Send (10-15 min)           │
│  ├── Handle human-review queue (10-15 min) ← THE ONLY NEW   │
│  └── Mark DO payments on dashboard (5 min)                   │
│                                                              │
│  THE PERSON'S NEW JOB:                                       │
│  ─────────────────────                                       │
│  ✓ Review AI drafts that need approval                       │
│  ✓ Handle escalated cases (legal, VIP, low confidence)       │
│  ✓ Mark DO payments on dashboard                             │
│  ✓ Override anything the AI got wrong                         │
│  ✓ judgment calls only — no data entry                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

> **The person doesn't disappear. They stop doing repetitive tasks and start doing judgment calls.**

---

### The Pilot Approach — Observe First, Then Decide

```
PHASE 1: PILOT (Weeks 1-4)
──────────────────────────
• Platform runs alongside existing team
• 1 person operates the platform daily
• Observe: How many replies are auto-handled?
• Observe: How many go to human review?
• Observe: How many drafts need editing?
• Measure: Time saved per batch
• Measure: Reply rate improvement
• Measure: Penalty avoidance

PHASE 2: MEASURE (Weeks 5-8)
─────────────────────────────
• Compare: Platform output vs manual output
• Compare: Response time (AI vs human)
• Compare: Error rate (AI vs human)
• Compare: Customer satisfaction
• Report: Full efficiency analysis to management

PHASE 3: DECIDE (Week 9+)
──────────────────────────
• Based on data, decide headcount adjustment
• If 80%+ replies auto-handled → reduce calling team
• If 90%+ drafts approved without edits → reduce triage team
• If penalties drop 90% → reduce follow-up team
• OR: Keep same team, redirect to higher-value work
```

> **We're not replacing anyone. We're measuring how much the platform handles, then deciding based on data — not gut feel.**

---

### What the Person Actually Does (Day by Day)

| Time | Task | Platform Handles | Human Handles |
|------|------|-----------------|---------------|
| **9:00 AM** | Upload today's Excel | Auto-fill resolves 80-90% | Review remaining 10-20% |
| **9:15 AM** | AI calls unresolved items | All calls placed in 1-2 min | Check results, override if wrong |
| **9:20 AM** | Send pre-alerts | 200+ emails in 3-5 min | Click "Launch" |
| **9:30 AM** | Check replies | IMAP polls every 2 min | Review AI drafts (10-15 min) |
| **10:00 AM** | Handle escalations | — | Legal/VIP/low-confidence cases |
| **10:30 AM** | Mark DO payments | Dashboard shows who paid | Enter UTR numbers |
| **Rest of day** | Exceptions only | — | Only when needed |

> **Total active time: 30-60 minutes. The rest of the day: the person handles exceptions, not routine work.**

---

### The Efficiency Metric — How We Measure Success

| Metric | How to Measure | Target |
|--------|---------------|--------|
| **Auto-reply rate** | % of replies handled by AI without human | >60% after 4 weeks |
| **Draft approval rate** | % of AI drafts approved without edits | >80% after 4 weeks |
| **Human review queue** | # of cases needing manual handling | <20% of total replies |
| **Response time** | Time from reply received to response sent | <10 seconds (AI) vs 4-7 min (manual) |
| **Penalty avoidance** | # of penalties prevented by reminders | 100% (all tracked) |
| **Time saved per batch** | Manual time vs platform time | >90% reduction |
| **Error rate** | Wrong replies sent / total replies | <1% (AI) vs 5-10% (manual) |

> **After 4 weeks of piloting, we'll have hard data on exactly how much the platform handles — and exactly how many people we need for the remaining 20%."**

---

## Slide: The Vision — Beyond Cargo

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

## Speaker Notes — What to Say

### For the "Cost of Doing Nothing" slide:
> "This is what we spend today. Seven people, every day, doing the same tasks. Excel processing, Outlook digging, phone calls, email sending, reply tracking. ₹3 lakhs a month in labor alone — and that's not counting penalties."

### For the "10x Comparison" slide:
> "Same work. One person. 30 minutes. ₹4,800 instead of ₹3 lakhs. That's not a 10% improvement — that's a 98% cost reduction. The platform does in one click what 10 people do all day."

### For the "Penalty Problem" slide:
> "The real money isn't in labor savings — it's in penalties we're not preventing. ₹5,000 to ₹10,000 per day for late BOE filing. ₹1,000 per day for late DO collection. Today we find out when the customer calls to complain. Tomorrow, the system tracks it in real-time and sends reminders before deadlines."

### For the "AI Agent" slide:
> "This doesn't replace anyone — calling is a shared, part-time duty, not a role. It removes one recurring task from all seven people's day, every day, for less than half of today's cost. And the batch finishes in one pass instead of being scattered across everyone's day."

### For the "What You Get" slide:
> "For ₹11,400 a month — less than one person's weekly wage — you get the output of 10 people working full-time. Vercel hosting, Supabase database, Gemini AI, Bolna voice calling, GitHub Actions crons, email sending. All of it. Every ₹1 spent saves ₹40-53 in labor and penalties."

### For the "ROI" slide:
> "The ROI is 40x to 53x. The payback period is less than one day. For every rupee spent on the platform, FedEx saves 40 to 53 rupees. This isn't an investment — it's a no-brainer."

### For the "Team" slide:
> "The person doesn't disappear. They stop doing repetitive tasks and start doing judgment calls. The platform handles 80% automatically. The person handles the 20% that needs a human — legal cases, VIP senders, low-confidence replies. We pilot first, measure everything, then decide based on data how many people we actually need."

### For the "Pilot" slide:
> "We're not replacing anyone today. We're measuring. After 4 weeks, we'll know exactly how much the platform handles — and exactly how many people we need for the remaining 20%. That's not a cost-cutting move — that's a data-driven decision."
