# Context Brief for Claude — FedEx Cargo Ops Automation

> **Purpose of this file:** This is the full context of who I am, the situation I'm in, and the software I built during my internship. I am pasting this to Claude so it can help me craft my presentation for a Senior Manager and, one to two weeks later, for the VP of India. Everything below is factual and verifiable in my codebase. Claude should base its output ONLY on what is stated here — do not invent features, numbers, or capabilities that are not described.

---

## 1. Who I am and why this matters

I am Bipul, an intern at FedEx Delhi IGI Airport. I sit in the **Trace** department, in the **Cargo** team. My internship goal is simple: convert this internship into a full-time job at FedEx.

There are two interns here. I was placed in Trace, and the other intern was placed in Admin.

The stakes are concrete and time-bound:

- I have a **presentation with a Senior Manager in a few days**.
- **One to two weeks after that, the VP of India visits** and told HR they want to interact with the two of us interns.

I have a good relationship with the Senior Manager's assistant. Through them I learned something important, unofficially: **every FedEx gateway needs two engineers**, and the reason is to make operations smooth with early technology adoption. FedEx's operations are currently far behind where the industry is moving. This confirms that what I built has a real need behind it.

The trust I need to build is: **"two interns can do this."** I built the platform below during my internship, mostly working with the Cargo team lead on flow automation. I want the Senior Manager and VP to believe that hiring us (or trusting us with this work) is a safe, high-value bet.

---

## 2. The environment — Trace department at IGI

Trace is the intermediate layer between **customs** and **customers**. Trace's job is to keep customers informed about their shipments and resolve anything in between. This includes:

- Sending **pre-alerts** (informing customers a shipment is arriving and what clearance they need)
- Answering **queries**
- Handling **DO collection** (Delivery Order)
- And other related tasks

Trace has sub-departments:

- **SD** — handles low-value shipments
- **RBOE** — handles high-value / courier shipments
- **Cargo** — the team I am with
- **CD** — another team

My team lead in Trace asked me to focus on **one flow at a time** and gave me the **Cargo team's flow automation** as my project.

### How the team works today (the pain)

- The entire process is **manual** — no agentic work, no automation.
- Pre-alerts are sent using **Excel-sheet-based scripts**.
- Everything is **unstructured**.
- They **delete previous emails due to storage constraints** — so any information older than ~20 days for a shipment is essentially lost. There is no reliable history.
- Knowledge lives in people's heads. New joiners cannot look anything up.

This means: every repetitive task costs hours, nothing is tracked centrally, and there is no memory of what was done before.

---

## 3. The problem, framed as an opportunity

Operations is a **critical** function — this is the ocean. But a huge share of it is **repetitive and rule-bound**. My approach:

1. Find the **repeatable 80%** of the work.
2. **Automate it end-to-end** in one web platform.
3. Keep **human review as a safety net** — AI handles what it can, and a human steps in only where AI is not confident or not allowed to act.

This gives the team the confidence to adopt automation in a critical process: nothing dangerous happens without a human approving it.

---

## 4. The product I built — a full end-to-end Cargo shipment tracker

I built a full web application for the Cargo team. It is **not just pre-alert automation** — it is the system the teammates will work in **instead of Excel sheets**, so everything can be tracked and maintained.

It is a **Next.js** app with a **Supabase** backend (Postgres + vector search + file storage), **QStash** for reliable queueing, **Nodemailer (SMTP)** and **Microsoft Graph** for sending email, **OpenAI** for AI classification/drafting, and **Bolna.ai** for AI voice calls.

The product has **three layers**:

### Layer 1 — Clearance Fill: deciding who clears each shipment

When a shipment arrives, the team must decide its clearance type before anything else can be sent. The choices are:

- **NFBRK** — customer self-clears
- **FEBRK-Jeena** — cleared by Jeena & Co. CHA
- **FEBRK-Sunimpex** — cleared by Sunimpex CHA
- **FEBRK** — cleared by another broker

Today, a teammate opens a 50–100+ row Excel sheet and works each company by **memory or by searching Outlook** — about 1–2 minutes per company, i.e. **2–3 hours per batch**, sometimes 3–4 hours. There are typos, no audit trail, and no memory for new joiners.

What I built to replace that:

1. **VBA Outlook scanner** (`clearance_type_detector.bas`) — scans Outlook history with weighted confidence scoring and pre-fills ~30–50% of rows in ~10 seconds. It only writes when it is confident (score >= 100); anything unsure is left blank for the web platform.
2. **Master database matching** — I seeded a company clearance master from historical data. It holds ~**36,000 rows, ~12,200 unique companies, and ~6,200 broker mappings**. The system matches each row against this master (exact normalized match first, then fuzzy/keyword match) and resolves ~50–70% of rows automatically.
3. **3-chain auto-fill** — clearance type, broker, and consignee email are resolved together from (a) the Excel columns, (b) the master DB, (c) broker rules. Combined this resolves ~70–85% of rows automatically.
4. **AI voice calls** — the remaining unresolved rows get an AI outbound call (Bolna.ai) in **Hinglish** to the consignee, asking only what is actually missing. The call is **context-aware**: the system tells the agent what it already knows (e.g., "clearance type already confirmed as FEBRK") and the agent then only confirms the broker, or only asks for the email — it never re-asks what is already known. Results come back via webhook and update the batch and the master DB in real time.
5. **Exception review** — a human reviews whatever is left or flagged. This is the safety net.

**Result: a task that took 3–4 hours now takes ~10–30 minutes.**

### Layer 2 — Pre-alert send pipeline

Once clearance types are known, pre-alert emails must go out. I built a guided wizard:

- **Upload & map** — upload the Excel, the system guesses the column mapping (AWB, consignee, email, end result, broker, phone, remarks, etc.)
- **Validate** — rows are validated, clearance types/brokers/emails resolved, rows split into sub-batches
- **Review & resolve** — a human resolves any remaining unknowns (or triggers an AI call) directly in the UI
- **Attachments & convert** — scanned documents (TIFF) are converted to PDF client-side
- **Preview** — emails are previewed with live `{VARIABLE}` substitution from the actual row data
- **Send** — emails are sent through SMTP or Microsoft Graph via a reliable queue (QStash) with retries, idempotency, and per-mailbox throttling
- **Summary** — counts of sent/failed, cleared/template types

The email content is **template-driven** (NFBRK, FEBRK-Jeena, FEBRK-Sunimpex, calling, hold, cargo arrival notice, post-day reminders, etc.), with variables like `{AWB}`, `{END_RESULT}`, `{PIECES}`, `{WEIGHT}`.

**Result: sending ~150 pre-alert emails went from ~90 minutes of manual work to a 3–5 minute guided flow.**

### Layer 3 — Post-send intelligence

After the pre-alert goes out, the real work begins — tracking every shipment to closure. I built:

- **Case management** — every AWB becomes a case (awaiting reply, DO collected, BOE filed, duty assessed, out of charge, etc.) with a full timeline
- **DO collect & BOE tracking** — mark DO ready/collected, file BOE, record IGM, duty amounts
- **Hold tracker (TP hold)** — track and release holds
- **Reminders** — automatic level-1 and level-2 reminder emails for un-replied cases (with penalty warnings on final reminders)
- **AI follow-ups** — clearance-type-specific follow-up schedules (e.g., NFBRK at 24h, FEBRK at 48h) with AI-generated draft replies a human approves before sending
- **Inbox ingestion & AI classification** — incoming customer emails are pulled (IMAP), matched to AWBs/cases, and classified by a **12-safety-gate ensemble** (keyword rules + vector-similarity ML + an LLM verifier). Depending on confidence, the email is auto-classified, an AI draft is prepared for human approval, or it goes straight to human review. Nothing is auto-sent unless explicitly enabled, and safety gates (VIP senders, legal keywords, kill-switch) always force human review.
- **Dashboards** — pre-alert and post-arrival metrics, AI impact, team stats, AI accuracy with confusion matrix
- **Human review queue** — a dedicated place for anything the AI flags or cannot handle

### What "working in the system" means

Teammates use this one platform instead of Excel + Outlook + memory. Every action is tracked, every email is stored, every decision is auditable, and the master DB grows every time a row is resolved — so the system gets better the more it is used.

---

## 5. Scripts I built for teammates (usable today)

Beyond the web app, I built two Excel/VBA tools that teammates can use immediately, no web platform required.

### 5.1 `clearance_type_detector.bas` — Outlook history scanner

Scans all Outlook folders (Inbox, Sent, subfolders) and detects the clearance type for each company in an Excel sheet, using weighted confidence scoring on signals like emails from/to/CC with `@jeena.co.in`, `@sunimpex.com`, and explicit self-clearance keywords. It only writes when confident (score >= 100); ties and low-confidence rows are left blank and resolved by the web platform. It does **not** assume NFBRK just because emails exist — it writes only what it confirms.

**Usage guide (teammate-facing):**
1. Open your pre-alert Excel sheet → `Alt+F11` → `File → Import File` → select the `.bas`
2. Check the CONFIGURATION constants (default: AWB = column D, Company = column E, output = column I "End Result", broker = column N "FedEx Broker"); edit if your sheet differs
3. Press `Alt+F8` → run `DetectClearanceTypes`
4. The script scans Outlook per row (progress in the status bar) and writes `FEBRK-Jeena` / `FEBRK-Sunimpex` / `NFBRK` into the End Result column
5. Rows left blank are not confident — upload the sheet to the web platform, which resolves them via master DB + fuzzy match + AI calls

### 5.2 `awb_email_finder.bas` — find emails by AWB number

Searches Outlook folders for emails mentioning specific AWB numbers within a date range, and exports matches (Subject, To, CC, Body ~500 chars, From, Date, Folder) to a results sheet. This directly addresses the "we deleted old emails / no history" pain by letting anyone pull a shipment's email trail from Outlook.

**Usage guide (teammate-facing):**
1. Open an Excel workbook → `Alt+F11` → `File → Import File` → select the `.bas`
2. `Alt+F8` → run `ShowAWBEmailFinder` — a sheet "AWB Email Finder" is created
3. Enter **Start Date** (B3) and **End Date** (E3)
4. Paste AWB numbers in column A from row 6 (one per row)
5. Click **Refresh Folders** → mark **Y** beside the folders to search (Inbox/Sent pre-marked)
6. Click **Run Search** — matches appear in the "Search Results" sheet (columns: AWB, Subject, To, CC, Body, From, Received, Folder)

---

## 6. Scale and proof (verifiable facts)

- **37 pages**, **66 API routes**, **50+ database migrations**, **15+ tables**
- **~36,000 master records**, ~12,200 unique companies, ~6,200 broker mappings (seeded from historical Excel)
- **TIFF → PDF**: ~4,322 files converted for 8 users
- **Send pipeline**: guided wizard, template-driven, retries + idempotency + throttling
- **AI classification**: ensemble (rules + vector ML + LLM) with 12 safety gates, human-review fallback
- **AI voice calls**: Bolna.ai, Hinglish, context-aware (only asks what's missing)
- **Docs I keep updated**: `docs/PROCESS_FLOW.md` (old vs new flow), `docs/PPT_STRUCTURE.md` (presentation story), `docs/BOLNA_SETUP.md` (voice-call setup), `docs/USER_GUIDE.md`

Everything above is in the codebase and has been run/verified during the internship.

---

## 7. What I can do next (vision, not yet built)

I want to make clear the trajectory — what the platform can become if trusted with more time and the right access:

- **Near term:** take AI voice calls fully live (needs a Bolna number), flip the send pipeline to fully automatic, and show dashboards to the team daily
- **Mid term:** extend the same pattern to the other Trace sub-teams (SD, RBOE, CD), enable AI auto-reply for the safest email categories (currently human-approval only), and grow the master DB coverage so AI calls become rare
- **Long term:** full operations intelligence — every shipment tracked end-to-end, anomaly detection, and a platform that makes new joiners productive in days instead of months

The point is: this is not a one-off script. It is a **platform that compounds** — the more it is used, the more it learns, and the less manual work remains.

---

## 8. The ask — the message to leave with the Senior Manager and VP

My pitch in one line: **"One platform. Three layers. Eight problems solved."**

The specific problems this solves for the Cargo team:
1. Manual clearance-type research (hours per batch → minutes)
2. No company/clearance memory (new joiners can't look anything up)
3. Lost email history (~20-day deletion window)
4. Manual pre-alert sending (~90 min → 3–5 min per ~150 emails)
5. No central tracking of shipments/cases (DO, BOE, holds)
6. No automatic reminders or follow-ups (penalties from missed DO/BOE deadlines)
7. Incoming customer queries handled by hand (AI classifier + draft assists)
8. No audit trail or accountability

**What I need (small, concrete, mostly free):**
- A Bolna phone number (~$5/month) and Bolna credits (~$30–50/month) to make AI calls live — **~$35–55/month total**
- SMTP/Graph credentials so the send pipeline runs on the real operational mailbox
- Team access to the platform (I set up roles and permissions already)

**Timeline I will commit to:**
- **Today:** the team starts using Clearance Fill on the web platform
- **This week:** AI voice calls live once the number is provisioned
- **Next week:** send pipeline fully automatic on the operational mailbox

**The trust statement:** Operations is an ocean, but the repetitive part of it is a river — and I've shown it can be channeled. We are two interns who built this in a few weeks. Imagine what we can do with full-time trust, a phone number, and a mailbox.
