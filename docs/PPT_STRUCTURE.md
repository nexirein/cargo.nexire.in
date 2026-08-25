# PPT Structure v3 — Story-Driven

The problem with v2: still reads like a corporate deck. This version is built like a story — each slide makes the audience feel something, not just learn something. Paste the whole thing into Claude.

---

You are a presentation design expert. Create a 13-slide PowerPoint deck. This is NOT a corporate status update. This is a story. Every slide has a clear emotional job.

## Context
- **Presenter:** Bipul Sikder — intern who built everything himself
- **Audience:** Senior Manager (decision-maker), Team Leader Shadab, Trace team
- **Goal:** Manager walks out thinking "this kid gets it. Let's give him what he needs."
- **Tone:** Confident, honest, slightly informal. Like you're telling a story to someone who's on your side.
- **Emotional arc:** Pain (we're wasting time/money) → Hope (there's a fix) → Trust (it's already working) → Action (let's go)

## Design
- Colors: Dark navy (#1e293b), emerald green (#059669), amber (#d97706)
- Font: Calibri
- Max 4 bullets per slide. Short sentences. Let the speaker notes carry detail.
- [SPEAKER NOTES] for each slide — these are what you SAY, not read from slides

---

### Slide 1: Title
Title: "The Pre-Alert Problem — and the Fix I Built"
Subtitle: "Bipul Sikder | FedEx India Cargo | July 2026"

No corporate jargon. No "Cargo Pre-Alert Operations Platform." Just what this is.

[SPEAKER NOTES]
"Good morning everyone. I'm going to walk you through something I've been building. But I'm not going to start with features or screenshots. I'm going to start with yesterday."

---

### Slide 2: A Day in the Life
Headline: "Yesterday, this is what happened."

No bullet points. Three short lines, large font, one appearing after another:

"100 AWBs arrived at 10 AM."

"By 1 PM, someone had finished checking Outlook for each one."

"By 5 PM, emails went out. One reply? Sitting in an inbox nobody checks."

Small text at bottom: "Rs5,000-Rs10,000/day BOE penalty. Rs1,000/day DO penalty. We find out when the customer calls."

[SPEAKER NOTES]
"Yesterday, or the day before, or every day — 100 AWBs land in the pre-alert inbox. Someone has to open Outlook, search company by company, figure out who uses their own CHA and who uses ours. If it's ours, is it Jeena or Sunimpex? Each one takes 1-2 minutes. 100 AWBs = 3 hours of Outlook. Then emails go out from a local script — 30-40 minutes. No tracking. No way to know who replied. And somewhere, a BOE penalty is ticking because nobody followed up. This is every single day."

---

### Slide 3: The Real Problem
Headline: "It's not the team. It's the process."

Two columns:

| What we think | What's actually happening |
|---------------|--------------------------|
| "We need more people" | The same 100 AWBs keep appearing. More people means more cost, same process. |
| "We need to work faster" | Team works fast. Manual Outlook search can only be so quick. |
| "This is just how it works" | It's how it's always worked. Not how it has to work. |

Bottom line: "The process is the bottleneck. Not the people."

[SPEAKER NOTES]
"Whenever we talk about this, the conversation goes to 'we need more people' or 'we need to work faster.' But the team is already fast. The bottleneck isn't the person — it's the process. Manually searching Outlook for every single company, manually calling the ones you can't find, manually sending emails with no tracking — these are process problems. And process problems need software solutions, not people solutions."

---

### Slide 4: What This Costs Us
Headline: "Let me put numbers on it."

Three large cards:

| TIME | MONEY | KNOWLEDGE |
|------|-------|-----------|
| 3-4 hours per batch | Rs5K-Rs10K/day BOE penalty | History lives in people's heads |
| x 2 batches/day | Rs1K/day DO penalty | Walks out when they leave |
| = 6-8 hours/day of manual work | = real money, found too late | = same problem solved differently every time |

Bottom: "These three costs add up. Every day. And they're all solvable."

[SPEAKER NOTES]
"I want to be specific about what this costs us. Three things. Time — 3-4 hours per batch, two batches a day, that's 6-8 hours of work that software can do in 10 minutes. Money — BOE penalties at Rs5,000 to Rs10,000 a day, DO penalties at Rs1,000 a day, and we only find out when the customer calls to complain. And knowledge — the person who knows that Company X always uses Jeena and Company Y always uses Sunimpex — that knowledge lives in their head. When they leave, it's gone."

---

### Slide 5: The Fix — One Platform, Three Layers
Headline: "I built one platform that solves all three."

[DIAGRAM] Three horizontal bars, stacked:

Layer 3 — Post-Send Intelligence → Stops money leaks (problems 5,7,8)
Layer 2 — Pre-Alert Send Pipeline → Fixes email chaos (problems 4,6)
Layer 1 — Clearance Fill → Kills the 3-hour Outlook grind (problems 1,2,3)

Arrow pointing up: "Each layer depends on the one below. I built them in order."

[SPEAKER NOTES]
"I built this in three layers, bottom to top. Layer 1 is Clearance Fill — this is what I'm primarily showing today. It solves the 3-hour Outlook search problem. Layer 2 is the send pipeline — already being used by the team, cuts email time from 40 minutes to 3 minutes. Layer 3 is post-send intelligence — case tracking, AI follow-ups, dashboards — this is where we stop the penalty leaks. Each layer depends on the one below. You can't track replies if you don't know who you sent to. You can't send intelligently if you don't know the clearance type."

---

### Slide 6: Layer 1 — Clearance Fill: The 4-Step Workflow
Headline: "This is where the 3-hour Outlook search becomes a 10-second macro."

[DIAGRAM] Simple horizontal flow:

[Step 1: VBA Script — 10 sec] → [Step 2: Upload + Auto-Fill — instant] → [Step 3: AI Calls — 30 sec/call] → [Step 4: Download — 1 click]

Each step with one-line description:
1. VBA script scans all Outlook folders. Writes what it confidently finds. Leaves blanks.
2. Web platform checks 36K-record master DB. Exact match → fuzzy match. 80-90% resolved.
3. Bolna AI calls remaining in Hinglish. Asks only what's missing. Updates DB.
4. Download enriched Excel. 9 columns. Ready for send.

Time comparison: Before: 3-4 hours → After: 10-30 minutes

[SPEAKER NOTES]
"Here's how it works. Four steps. Step 1 — a VBA script runs on your Excel before you upload. It searches every Outlook folder, looks for signals that tell us Jeena or Sunimpex or own CHA. It writes what it's confident about, leaves blanks for what it's not. Step 2 — upload to the web platform. It checks a master database of 36,000 records. After these two steps, 80-90% of your batch is resolved without a single phone call. Step 3 — for the remaining 10-20%, the AI calls the consignee in Hinglish. Step 4 — one click download. Total time: 10-30 minutes."

---

### Slide 7: [DEMO] Let Me Show You
Headline: "Instead of explaining, let me show you."

Simple slide. Maybe a browser screenshot. Or just the headline and "5 minutes."

What you'll do live:
1. Open /clearance-fill
2. Upload a sample Excel (4 rows: 2 known, 1 CALLING, 1 missing email)
3. Watch auto-fill populate instantly
4. Click "Need AI Call" — show only 1 row left
5. Click "Download" — show 9-column enriched file
6. (If Bolna set up) Show a test call
7. Show Supabase with updated values

[SPEAKER NOTES]
Walk through the demo naturally. Don't narrate every click. Let the speed speak for itself.

---

### Slide 8: While Building Clearance Fill, I Also Built These
Headline: "Clearance Fill is the newest piece. Here's what's already shipping."

Six items, two columns. Each with a stat:

| Feature | Impact |
|---------|--------|
| TIFF → PDF Converter | 4,322 files converted. 8 team members using it. |
| Arrival Notice Generators | Branded PDFs. Zero copy-paste errors. |
| VBA Email Fetcher | Find emails by AWB in seconds. |
| Pre-Alert Send Pipeline | 3-5 min per batch. Used daily. |
| Case Management + Follow-ups | Full lifecycle tracking. Penalty visibility. |
| AI Email Classification | Multi-stage engine. 12 safety gates. |

Bottom: "These aren't demos. They're in production."

[SPEAKER NOTES]
"I want you to understand something. Clearance Fill isn't a prototype. It's the latest piece of a platform I've been building and shipping. The TIFF converter? 4,322 files processed by 8 team members. The send pipeline? Used daily for uBond and Consol batches. Case management? Full lifecycle tracking built. These are real features being used by real people. I'm not asking you to trust a promise — I'm showing you what's already working."

---

### Slide 9: What the Team Can Use RIGHT NOW
Headline: "No resources needed. Four URLs. Working today."

Four cards:
- /clearance-fill → Upload, auto-fill, download. The full workflow.
- /clearance-fill/dashboard → Batch history, results, enriched downloads
- /clearance-fill/seed → Upload historical Excel to build master DB
- /clearance-fill/broker-rules → Add company→broker rules via UI

Bottom: "I want the team to start using /clearance-fill from today."

[SPEAKER NOTES]
"I want everyone in this room to open your browser after this meeting and go to /clearance-fill. Upload your next Excel. Watch it auto-fill. Review anything that looks wrong — you can override any cell by clicking on it. Download the enriched file. The workflow is exactly what you already do — just automated. No training needed."

---

### Slide 10: What It Took to Build This
Headline: "I want you to know what went into this."

Simple list, short lines:
- Frontend: 15+ pages, Next.js
- Backend: 40+ API routes, 50+ database migrations
- Database: PostgreSQL, 15+ tables, 36K seeded records
- AI: Voice agent (Bolna), GPT-4, embedding classifier
- Research: Tested 3+ approaches for every major component
- Scripts: 5+ VBA macros, Python ML pipelines

Bottom: "Built end to end. By one person. In the time between my other work."

[SPEAKER NOTES]
"I want to be transparent. This isn't a small script. It's a full-stack platform. Frontend, backend, database, AI, infrastructure, research — I did every piece myself. I tested multiple approaches for every major decision — server vs client TIFF conversion, SMTP vs Graph vs Power Automate for email, Vapi vs Twilio vs Bolna for voice. I chose the right tool each time. And I built it while doing my regular work."

---

### Slide 11: What I Need From You
Headline: "Five things. Two cost money."

| Resource | Purpose | Cost |
|----------|---------|------|
| Bolna account | AI voice calls | $0 to start, ~$30-50/mo |
| Phone number | Outbound caller ID | ~$5/mo |
| SMTP credentials | Email send pipeline | Free (IT) |
| Shared mailbox | Inbound email ingestion | Free (IT) |
| 30 min of team time | Show them how to use it | Free |

Green callout: "That's $35-55/month total. Everything else is already built."

[SPEAKER NOTES]
"Here's what I need. Five things. Two cost money: a Bolna account at $0 to start with $30-50 monthly for moderate calling, and a phone number at $5 per month. Three are free internal resources from IT: SMTP credentials, shared mailbox access, and 30 minutes of team time to show everyone how to use the system. That's it. $35 to $55 a month to eliminate 3-4 hours of manual work per batch."

---

### Slide 12: The Ask
Headline: "You asked for this in 30 days. I'm ready in 1 week."

Three columns:

| TODAY | THIS WEEK | NEXT WEEK |
|-------|-----------|-----------|
| Team starts using /clearance-fill | Bolna account approved → AI calls live | SMTP credentials → send pipeline auto |
| No resources needed | Phone number purchased | Dashboards visible to management |
| Upload → auto-fill → download | Cost: $35-55/mo | Full platform live |

Bottom bold: "Give me the green light today. We go live this week."

[SPEAKER NOTES]
"My TL asked me to present the outcome on Monday. The system is ready. The clearance fill workflow works right now without any additional resources. I want the team to start using it today. For AI calling and the send pipeline, I need the resources I just listed. Give me the go-ahead today, and we're fully live this week."

---

### Slide 13: Close
"One platform. Three layers. Eight problems solved."

"I built it because I saw the problem every day and decided to fix it."

"It's ready. I'm ready."

"Questions?"

[SPEAKER NOTES]
"I built this because I saw the same problem every single day — the 3-hour Outlook search, the untrackable emails, the penalties we find too late. I decided to fix it. Not with a suggestion, not with a report — with working software. The platform is ready. I'm ready. Let's go live this week. Thank you."
