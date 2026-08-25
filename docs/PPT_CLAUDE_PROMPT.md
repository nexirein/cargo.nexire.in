# INSTRUCTIONS FOR CLAUDE / AI — Generate a PowerPoint Presentation

You are helping an intern build a presentation to present to senior management including the Senior Manager, Team Leader Manager, and Operations Team Lead. The goal is to showcase a project built during the internship and secure a PPO (Pre-Placement Offer).

## TONE & STYLE
- Professional but not overly technical for the management audience
- Confident but humble — the intern built this as a solo project
- Focus on BUSINESS IMPACT, not just technical features
- Every slide should answer: "Why does this matter to FedEx?"
- Use FedEx purple as accent color: `#4D148C`
- 20-25 slides total
- Each slide should have a clear title, 3-5 bullet points max, one key visual or metric

## VISUAL STYLE
- Dark purple (#4D148C) headers, clean white backgrounds
- Data should be visualized: bar charts, flow diagrams, comparison tables
- Use a consistent progress/flow arrow to show "Before → After"
- Screenshot mockups of the actual app dashboard, cases page, batch wizard
- Each slide should have a footer with "Cargo Pre-Alert & Follow-Up Platform"

## STRUCTURE

---

### SLIDE 1: Title Slide
- Title: "Cargo Pre-Alert & Follow-Up Platform"
- Subtitle: "Automating Operations — From 90 Minutes to 3 Minutes"
- Name: [Intern Name]
- Role: Operations Technology Intern
- Date: July 2026
- Department: Cargo Operations

---

### SLIDE 2: The Problem — Why I Built This
**Headline:** "Our team spends 3+ hours every day on manual email work."

Key points:
- Every morning: export 150+ AWBs from IGM console into Excel → VBA script → Outlook → send one-by-one
- Takes ~90 minutes to send 150 pre-alerts
- No tracking of which AWBs sent, which failed, which got replies
- Follow-ups: manually export replies from Outlook, search by AWB, track in spreadsheet
- No dashboard, no metrics, no visibility for management
- **Hidden cost:** ~50 out of 140 replies are auto-replies or info-only — but human checks every single one

Context slide — show a "Before" picture that everyone in the room recognizes:
- Screenshot of Outlook with 150 emails being sent
- Screenshot of an Excel tracker with manual reply tracking
- Photo of a whiteboard with handwritten follow-up status

---

### SLIDE 3: The Solution — What I Built
**Headline:** "A web platform that automates the entire pre-alert lifecycle."

- A web application (not a script — a proper platform)
- Handles 3 phases: Send → Track → Follow-up
- Built in 8 weeks as a solo intern project
- Zero additional cost to the company — uses existing Gmail infrastructure
- Ready for prealert@fedex.com migration when IT provisions it

Show the 3-phase flow diagram:
```
Phase 1: SEND      →  Phase 2: TRACK    →  Phase 3: FOLLOW-UP
Upload ACCS Excel   →  Auto-detect       →  Auto-schedule reminders
Map columns          →  replies via IMAP    →  48h / 72h escalation
Validate rows        →  Extract AWB        →  Slipped-case alerts
Launch 150 in 3 min  →  Link to case       →  Dashboard visibility
```

---

### SLIDE 4: Before vs After — The Key Metric
**Headline:** "90 minutes → 3 minutes. That's a 97% reduction."

Big comparison table:

| Metric | Before (Excel + Outlook) | After (This Platform) | Improvement |
|--------|-------------------------|----------------------|-------------|
| Time to send 150 emails | ~90 minutes | ~3-5 minutes | **97% faster** |
| Record of sent emails | None | Full per-AWB status history | **100% traceable** |
| Reply tracking | Manual export → Excel | Auto-ingested via IMAP | **Zero manual** |
| AWB-to-reply linking | Search Outlook manually | Auto-extract + link | **Instant** |
| Follow-up reminders | Calendar + sticky notes | Auto-scheduled | **Never miss one** |
| Team workload visibility | None | Dashboard with metrics | **Real-time** |

---

### SLIDE 5: Architecture — Simple & Powerful
**Headline:** "Modern cloud stack, zero infrastructure cost."

Show a clean architecture diagram:

```
[User] → [Next.js Web App]
              ↓
    ┌─────────────────┐
    │  Postgres DB     │  ← All state: batches, cases, users
    │  (Supabase)      │
    └─────────────────┘
              ↓
    ┌─────────────────┐
    │  Send Engine     │  ← SMTP → Gmail (current)
    │  (QStash Queue)  │  ← Graph → Exchange (upgrade)
    └─────────────────┘
              ↓
    ┌─────────────────┐
    │  Reply Engine    │  ← IMAP polling every 5 min
    │  (Vercel Cron)   │  ← Extracts AWB, links to case
    └─────────────────┘
```

Key technical decisions and WHY (important for managers who want to know you made smart choices):
- **SMTP first, Graph later** → Gmail works today, Exchange upgrade is a config change, not a rewrite
- **IMAP polling** → works with ANY email provider (Gmail, Outlook, Exchange, Yahoo)
- **QStash queue** → reliable, retries failed sends, doesn't lose emails
- **Supabase** → all-in-one: database, auth, storage, realtime (no managing multiple services)

---

### SLIDE 6: The Batch Wizard — Step by Step
**Headline:** "Upload → Map → Validate → Launch. 30 seconds of human work."

Show the wizard flow with screenshots of each step:

1. **Upload Excel** (ACCS export or any format — system auto-detects columns)
2. **Map Columns** (AWB, Email, Name — drag and drop, takes 10 seconds)
3. **Validate Rows** (checks for missing emails, invalid AWBs, duplicates)
4. **Upload Invoices** (drag-and-drop PDFs/TIFFs named by AWB)
5. **Preview** (see every email before sending — subject, body, attachments)
6. **Launch** (one click sends 150 emails in parallel)

---

### SLIDE 7: The Send Engine — How 150 Emails Go Out in 3 Minutes
**Headline:** "Parallel sending with automatic retry."

Key points:
- Each email is sent independently via the queue
- 4 concurrent sends per mailbox (configurable)
- Each email gets 5 retry attempts with backoff
- Every send is recorded: timestamp, recipient, subject, message-id
- Failed sends are flagged for human review
- Real-time progress shows on screen: "142/150 sent, 8 in progress"

Show a timeline:
```
0:00 — Launch clicked
0:15 — 25 emails sent (QStash queue)
0:30 — 50 emails sent
1:00 — 100 emails sent
1:30 — 130 emails sent
2:00 — 145 emails sent
3:00 — 150/150 completed
```

---

### SLIDE 8: Reply Capture — The Magic
**Headline:** "When a consignee replies, the system knows within 5 minutes."

Show the flow:

```
Consignee replies to pre-alert
         ↓
Reply lands in operational mailbox
         ↓
Gmail forwarding rule → monitoring inbox
         ↓
IMAP poller picks it up (every 5 min)
         ↓
System extracts AWB from reply text
         ↓
If AWB matches a sent pre-alert → Link to existing case
If AWB doesn't match → Create new case
         ↓
Case status updates to "reply_received"
         ↓
Reply text visible in case timeline
```

Key points for management:
- **Zero human effort** to collect replies — no more exporting from Outlook
- **AWB extraction** is automatic — regex finds 12-15 digit AWB numbers anywhere in the email body
- **Case linking** is automatic — every reply is connected to the right AWB
- **Audit trail** — every reply is stored permanently, not lost in someone's inbox

---

### SLIDE 9: Cases Dashboard — Everything in One Place
**Headline:** "Every AWB becomes a trackable case with full timeline."

Show screenshot of the Cases page with:
- Status badges: `awaiting_reply` (grey), `reply_received` (green), `claimed` (blue), `closed` (purple)
- Search by AWB or consignee name
- Filters by status, date, owner

Key features:
- **Case claiming** — no two teammates work the same case
- **Full timeline** — sent email, reply text, status changes, all in one view
- **Case updates** — add notes, mark as closed, escalate

---

### SLIDE 10: Auto-Reminders — Never Miss a Follow-Up
**Headline:** "Auto-scheduled reminders at 48h and 72h. Zero manual tracking."

Key points:
- Every sent pre-alert auto-schedules reminder 1 at 48 hours
- If no reply after 72 hours → reminder 2 (final)
- If still no reply → flagged as "slipped" for escalation
- Team can see all pending reminders in one dashboard
- **No more sticky notes, no more "did you follow up?"**

Show reminder flow:
```
Pre-alert sent
     ↓
48 hours — No reply? → Auto-send Reminder 1
     ↓
72 hours — Still no reply? → Auto-send Reminder 2
     ↓
96 hours — No reply? → Flag as "slipped" for team leader review
     ↓
            → Future: AI calling agent calls the consignee
```

---

### SLIDE 11: Dashboard — Real-Time Operations View
**Headline:** "What every manager wants: one screen with all the numbers."

Show the 8-card dashboard layout:
| Card | What It Shows |
|------|---------------|
| Pre-alerts sent today | Count |
| Send success rate | % |
| Replies received | Count + rate % |
| Open cases | Count |
| Awaiting reply | Count |
| Slipped cases | Count (with red alert if > 0) |
| Cases claimed today | Count |
| Average reply time | Hours |

Key point: **This dashboard didn't exist before. The team had zero visibility into their own performance.**

---

### SLIDE 12: Demo — See It Live
**Headline:** "Let me show you."

Step-by-step live demo plan:
1. **Dashboard** — show today's metrics
2. **Create a batch** — upload 10-row Excel → map → validate → launch
3. **Watch it send** — live progress on screen
4. **Reply to an email** — from a test account, watch it appear in Cases
5. **Open the case** — show the timeline with sent email and reply
6. **Reminders page** — show auto-scheduled follow-ups

---

### SLIDE 13: Technology Stack — Why These Choices
**Headline:** "Best-in-class tools, zero licensing cost."

Simple table showing each tech choice and why:

| Technology | Why We Chose It | Alternative | Our Advantage |
|-----------|----------------|-------------|---------------|
| Next.js 16 | Full-stack React, server actions | Django, Flask | Faster development, same language front+back |
| Supabase | Postgres + auth + storage + realtime | AWS RDS, Firebase | All-in-one, generous free tier |
| Upstash | Serverless Redis + QStash queue | AWS SQS, BullMQ | No server management, pay per request |
| Gmail SMTP | Works today, zero cost | SendGrid, AWS SES | No vendor approval needed |
| Vercel | Zero-config deployment, cron jobs | AWS, Azure | Free preview URLs, instant deploys |

---

### SLIDE 14: Cost Analysis — Built at Zero Additional Cost
**Headline:** "The entire platform runs on free tiers and existing infrastructure."

Monthly cost breakdown:
| Service | Cost | Notes |
|---------|------|-------|
| Vercel (hosting) | $0 | Hobby tier (free) |
| Supabase (database) | $0 | Free tier (500MB DB, 1GB storage) |
| Upstash (queue + cache) | $0 | Free tier (10k msg/day) |
| Gmail SMTP (sending) | $0 | Existing accounts |
| Google Gemini (AI) | $0 | Free tier until >60 requests/min |
| **Total** | **$0/month** | |

When the platform moves to production with 150+ daily emails and real users:
- Vercel Pro: $20/mo
- Supabase Pro: $25/mo
- Upstash: $5-15/mo
- **Total production cost: ~$50-60/month**

Compare to: Power Automate premium licenses, third-party email marketing tools, custom SharePoint development.

---

### SLIDE 15: Phase 2 — What Comes Next
**Headline:** "The platform is designed to grow with our needs."

Three tracks of future development:

**Track 1: prealert@fedex.com Integration (IT-dependent)**
- Switch from Gmail SMTP to Microsoft Graph API
- All pre-alerts come from the official FedEx address
- IMAP polling on Exchange Online (or Graph webhooks)
- No code changes — just environment variable swap

**Track 2: AI Classification (data-dependent)**
- Automated reply classification with Google Gemini
- Categories: info-only, invoice request, payment received, escalation
- Auto-send for simple requests, human review for complex ones
- Target: 60-70% of replies handled without human touch
- Blocked on: 200+ labeled historical replies from the team

**Track 3: AI Calling Agent (future)**
- Automated phone calls to consignees who don't reply
- Integration with Vapi or Bolna (AI voice agents)
- Call outcome tracked in case timeline

---

### SLIDE 16: The Journey — 8 Weeks, Solo
**Headline:** "From idea to production-ready in 8 weeks."

Timeline visualization:
```
Week 1-2: Research & Architecture
  └── Interviewed team members, understood current process
  └── Designed database schema, chose tech stack

Week 3-4: Core Infrastructure
  └── Supabase setup, auth, RBAC, seed data
  └── Mailbox configs, Excel parsing, validation

Week 5-6: Send Engine + Batch Wizard
  └── SMTP driver, QStash queue, progress tracking
  └── Batch wizard: upload, map, validate, launch, summary

Week 7-8: Reply Engine + Dashboard
  └── IMAP poller, AWB extraction, case management
  └── Dashboard, reminders, analytics
  └── UI redesign with FedEx purple theme
  └── Training guide, templates, polish
```

Key point: **Built by one intern in 8 weeks — not a team, not a vendor, not a 6-month project.**

---

### SLIDE 17: What I Learned
**Headline:** "This project taught me more than any classroom."

If asked in Q&A or as a personal touch slide:

- **Real-world complexity** — edge cases in AWB formats, email deliverability, IMAP quirks
- **User empathy** — every feature was built based on talking to the operations team
- **Trade-offs** — when to build, when to buy, when to defer (SMTP vs Graph, polling vs webhooks)
- **Communication** — translating technical decisions into business value
- **Ownership** — taking a vague problem and delivering a complete solution

---

### SLIDE 18: Ask — Why This Deserves a PPO
**Headline:** "I want to keep building. Here's what's next."

Be direct about the ask:

1. **I've demonstrated** I can take an ambiguous operational problem and build a production-ready solution — solo, in 8 weeks
2. **The platform is already** saving the team hours every day. It works today with Gmail and is ready for prealert@fedex.com when IT provisions it
3. **What I want:** A PPO to continue building Phase 2 (AI classification, FedEx GraphQL integration, calling agent)
4. **The ROI is clear** — the platform cost $0 to build. The time savings alone pay for the role many times over

---

### SLIDE 19: Q&A Preparation
**Headline:** "Anticipating your questions."

| Likely Question | Suggested Response |
|----------------|-------------------|
| "What about security?" | All data in Supabase with row-level security. Service-role key never leaves the server. IMAP/ SMTP credentials encrypted in env vars. Audit log for every action. |
| "What if Gmail goes down?" | SMTP is swappable. SendGrid, AWS SES, or Exchange are all config changes, not code changes. |
| "How do we know replies are captured reliably?" | Every ingested reply is logged with a unique message-id. Duplicate detection prevents double-processing. Manual trigger available to poll on demand. |
| "Can this handle 500+ AWBs?" | Tested with 150. Architecture is horizontally scalable — QStash queue handles unlimited throughput. Bottleneck is SMTP rate limits (Gmail: 150/day free, 2000/day Workspace). |
| "What training is needed?" | Built-in training guide in the app with role-based sections. 30 min to onboard a new operator. |
| "When can we go live?" | Today. With Gmail accounts and App Passwords, it works immediately. |

---

### SLIDE 20: Thank You
**Headline:** "Thank you for the opportunity."

- "I'm excited to continue building this platform for the cargo operations team."
- "The best is yet to come — Phase 2 AI classification, Phase 3 calling agent."
- "I'd love to turn this internship into a full-time role and see this through."
- Contact: [Intern Name] / [Email]

---

## ADDITIONAL NOTES FOR CLAUDE

### Key Messages to Reinforce Throughout:

1. **Built by one intern in 8 weeks** — this is the headline story
2. **Zero cost to build, runs on free tiers** — no budget was needed
3. **Working today with Gmail** — not a prototype, not a concept, a real working platform
4. **Phase 2 upgrade path is designed** — prealert@fedex.com is a config change, not a rewrite
5. **The team's pain was real** — the intern talked to operators, understood their daily struggle, and solved it

### Data Points to Emphasize in Q&A:
- 150 emails in 3-5 min vs 90 min before = 97% faster
- 5 min reply detection vs manual daily export = 288x faster detection
- Built at $0 cost, production cost $50/mo
- 8 weeks, solo intern, from zero to production-ready

### Visual Mockups Needed:
- Dashboard screenshot (8 metric cards)
- Batch wizard flow (upload → map → validate)
- Cases page with status badges
- Case timeline (sent email + reply + updates)
- Reminders page
- Architecture diagram
- Before/After comparison graphic

### Audience:
- Senior Manager (cares about: cost savings, team efficiency, risk)
- Team Leader (cares about: daily workflow, team workload, visibility)
- Operations Team Lead (cares about: does it actually work, is it easy to use)

### Persuasion Strategy:
- For Senior Manager: Show the hard numbers (97% faster, $0 cost, built by intern)
- For Team Leader: Show how it makes their job easier (dashboard, auto-reminders, no more Excel)
- For Operations Lead: Show it's practical and ready (demo it, training guide built in, works today)
