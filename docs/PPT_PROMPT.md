You are a presentation design expert. Create a professional PowerPoint presentation based on the document below for a Monday morning team presentation at FedEx India Cargo Operations.

## Context
- **Presenter:** Bipul Sikder (individual contributor — intern who built the entire platform alone)
- **Audience:** Team Leader (Shadab, Trace team), Senior Manager (who assigned this project), and team members at FedEx Delhi IGI Airport cargo operations
- **Tone:** Confident, factual, results-driven. Show deep understanding of the team's daily pain points. Position this as a complete solution, not just a demo.
- **Goal:** Get the senior manager's buy-in. Show the system is ready TODAY. Ask for specific resources (Vapi account, phone number, SMTP credentials) to go fully live.
- **Underlying context (do not say this aloud but design for it):** The presenter's internship conversion depends on this presentation. The TL hasn't been listening. The senior manager is the decision-maker. This presentation must establish credibility and show strategic thinking.
- **Duration:** ~20-25 minute presentation with live demo

## Design Requirements

1. **Slide structure:** Create 15-18 slides max. Clean, professional, not text-heavy.
2. **Branding:** Use dark navy blue (#1e293b) and emerald green (#059669) as primary colors. Accent with amber (#d97706) for AI/calling elements. White backgrounds.
3. **Font:** Calibri or similar clean sans-serif.
4. **Data:** Use the real numbers provided (4,322 files, 8 users, 36K records, 12K companies, 6K broker mappings, etc.)
5. **Visuals:** Include simple diagrams/flowcharts where indicated. Use icons (FedEx cargo, phone, database, robot/AI, document).
6. **Each slide should have:**
   - Clear headline (what the audience should take away)
   - Minimal bullet points (3-5 max)
   - Visual element (icon, diagram, or data point)
   - Speaker notes (what to say aloud during this slide)

## Presentation Structure

### Slide 1: Title Slide
- Title: "Cargo Pre-Alert Operations Platform"
- Subtitle: "Complete Solution for the Pre-Alert Team — Built & Ready for Production"
- Presenter: Bipul Sikder
- FedEx logo top right
- Date: July 27, 2026

### Slide 2: The Pre-Alert Team's 8 Problems
- 8 numbered boxes in a 4x2 grid, each with:
  - Problem number + short name
  - One-line description
  - Impact number
- Problems:
  1. Manual Excel processing (100-500 AWBs/day, hours per batch)
  2. Ambiguous clearance types (CALLING/FEBRK, manual phone calls)
  3. No centralized knowledge (each person's mental map, lost when they leave)
  4. Manual email sending (pick template, add CCs, attach files, 100+ emails)
  5. No reply tracking (₹5K-₹10K/day BOE penalty, ₹1K/day DO penalty)
  6. uBond/Consol confusion (duplicate emails, wrong attachments)
  7. No performance visibility (gut-feel decisions, no data)
  8. Manual inbound email triage (slow, inconsistent)
- Bottom: "I've built one platform that solves all 8."
- **Speaker notes:** "These are the 8 problems I identified in our daily workflow. I've spent the last几个月 building a platform that solves every single one. Let me show you."

### Slide 3: The Solution Overview
- Central diagram: Large rectangle "CARGO PRE-ALERT OPERATIONS PLATFORM"
- Three sections inside:
  - Left: "CLEARANCE FILL" → Solves Problems 1, 2, 3
  - Center: "SEND PIPELINE" → Solves Problems 4, 6
  - Right: "POST-SEND INTELLIGENCE" → Solves Problems 5, 7, 8
- Arrows flowing left to right
- Bottom text: "One upload. End-to-end automation. Built by one person."
- **Speaker notes:** "This is the complete picture. Clearance fill is what I'm presenting today, but it sits inside a larger platform that I've already built for the team."

### Slide 4: The Complete Workflow — 4 Steps
- Horizontal flow with 4 boxes and connecting arrows:

  [STEP 1: VBA Script] → [STEP 2: Upload + Auto-Fill] → [STEP 3: AI Calls] → [STEP 4: Download]
  
- **Step 1** details: VBA script runs on Excel BEFORE upload → searches Outlook for each company name → finds NFBRK/FEBRK-Jeena/FEBRK-Sunimpex from email history → writes to "End Result" column → what it can't find stays as "CALLING"
- **Step 2** details: Upload script-processed Excel → 3-chain auto-fill engine refines results → 36K master DB fills gaps from VBA script → fuzzy match by company name
- **Step 3** details: AI voice calls for what still couldn't be resolved
- **Step 4** details: Download enriched Excel
- **Speaker notes:** "This is the full 4-step workflow. Step 1 is the VBA script you already use — it searches Outlook and fills the End Result column. Step 2 is the web system — you upload that script-processed Excel and the 3-chain engine refines everything further against 36K master records. Step 3 is AI calling for whatever still couldn't be resolved. Step 4 is your enriched download."

### Slide 5: Step 1 — The VBA Script (What You Already Use)
- Headline: "Runs on the Excel BEFORE upload. Searches Outlook for every company."
- Flow inside the slide:
  [Excel with company names] → [VBA script searches Outlook per company] → [Finds NFBRK/FEBRK-Jeena/Sunimpex from old emails] → [Writes to End Result column]
- Items NOT found → remain as "CALLING" in Excel
- **Speaker notes:** "This is the VBA clearance type detector I built. It takes each company name from your Excel, searches Outlook inbox and sent items, looks for broker keywords like Jeena or Sunimpex in old emails, and writes the clearance type into the End Result column. Companies it can't find stay as CALLING. This is your first pass."

### Slide 6: Step 2 — Upload + 3-Chain Auto-Fill
- Three columns side by side:
  - Column 1: "CHAIN 1: Clearance Type" — picks up VBA script's results → for CALLING/empty: 36K master exact → fuzzy match by company name keywords
  - Column 2: "CHAIN 2: Broker" — 4 levels (Air India rule → UI pattern rules → FedEx Broker column → broker master)
  - Column 3: "CHAIN 3: Email" — 4 sources (ConsigneeEmail → Standard Remarks → Mail ID → master DB fallback)
- Highlight: "The VBA script already found what it could. Now the master DB fills the rest."
- Below: "80-90% of all items fully resolved after Steps 1 + 2 combined"
- **Speaker notes:** "You upload the script-processed Excel. Chain 1 picks up whatever the VBA script already found. For companies that were still CALLING, it checks the 36K master database — exact match first, then fuzzy by company name keywords. Even if the Excel has extra codes like *I/B* in the company name, the system strips them and finds the match. Chains 2 and 3 independently resolve broker and email. After this, 80-90% of all items are fully resolved without any AI call."

### Slide 6: The Master Database (The Brain)
- Icon: Large database
- Key numbers: 36,353 rows processed → 12,217 unique companies → 6,224 broker mappings
- Source: Historical Excel data, cleaned and deduplicated
- Auto-learns: Every AI call result updates the database — gets smarter over time
- **Speaker notes:** "This is what makes auto-fill possible. I took 36,000 rows of historical data, cleaned the company names, extracted clean emails — not phone numbers mistakenly stored as email — deduplicated everything, and built a searchable knowledge base. The system checks this before any human needs to get involved."

### Slide 7: AI Voice Calling — When Auto-Fill Isn't Enough
- Diagram: Missing fields → Vapi AI agent → calls consignee → result updates batch + master DB
- Agent behavior: "NFBRK or FEBRK? Jeena or Sunimpex? What email?"
- One call covers all missing fields — no multiple follow-ups
- Master DB learns from every call — next time, same company is auto-filled
- **Speaker notes:** "For the 10-20% that auto-fill can't resolve, the AI agent calls the consignee. It knows exactly which fields are missing — clearance type, broker, email — and only asks about those. One call. Results flow back automatically. The database learns, so next time this company appears, it's already known."

### Slide 8: Live Demo
- Simple slide: Just title "Let Me Show You" and a browser screenshot mockup
- What we'll see: Upload Excel → auto-fill results → source breakdown → need AI call section → Vapi dashboard → enriched Excel download
- Note at bottom: "Vapi test via dashboard. Phone number purchase needed for production calls."
- **Speaker notes:** Walk through the live demo. Upload, show the processing animation, show source breakdown cards, show the resolved vs needs-call tables, show the inline override, show the Vapi dashboard test, show the download.

### Slide 9: But I've Built Much More Than Just This
- Headline: "Clearance Fill is the latest piece. Here's everything else I've already built and shipped for this team."
- Simple text slide with a list of 8 items, each with a checkmark icon:
  ✓ Bulk TIFF-to-PDF converter (4,322 files, 8 users)
  ✓ Arrival notice generators (Post-IGM + Pre-IGM)
  ✓ VBA Outlook email fetcher by AWB
  ✓ Email extraction for ML training data
  ✓ VBA clearance type detector (NFBRK/FEBRK via Outlook search)
  ✓ 9-step pre-alert send pipeline (uBond + Consol)
  ✓ Full case management + AI follow-up scheduler
  ✓ AI email classification engine (rules + ML + LLM ensemble)
- **Speaker notes:** "Clearance fill is what I'm presenting today. But it sits on top of a platform I've already built. Let me walk you through each piece quickly."

### Slide 10: TIFF to PDF + Arrival Notices (Already Shipping)
- Two columns:
  - Left: "TIFF to PDF" — Problem: ACCS downloads .tiff, manual export per file. Solution: Browser bulk converter. Result: 4,322 files, 8 users.
  - Right: "Arrival Notice Generators" — Problem: Hand-typing emails. Solution: Upload Excel → branded PDFs. Result: Professional documents, no copy-paste.
- **Speaker notes:** "These two are already in use. 4,322 files converted in the first few weeks. 8 team members are using them daily. The arrival notice generators replaced hand-typed emails with proper branded PDFs."

### Slide 11: VBA Scripts (The Invisible Foundation)
- Three scripts, one theme:
  - Outlook email fetch by AWB — 10-15 min per AWB → seconds
  - Email extraction for ML — created the training dataset that powers all AI
  - Clearance type via Outlook search — hours of pattern matching → seconds
- Bottom: "Without these, the master database and AI engine would have no data."
- **Speaker notes:** "These VBA scripts are invisible — most people don't see them. But they're the foundation. The email extraction created our training data. The clearance detector seeded our knowledge base. Without these, nothing else works."

### Slide 12: Pre-Alert Send Pipeline (Already Shipping)
- Problem: 100+ individual Outlook emails per batch. Pick template, add CC list, attach files, type subject/body. Hours of work. No audit trail.
- Solution: 9-step wizard with uBond/Consol split, AI drafts, SMTP send with retry
- Key features: Auto-column mapping, Consol dedup against uBond, Redis locking prevents double-send, full audit trail
- Impact: 3-5 minutes per batch instead of hours
- **Speaker notes:** "This pipeline is what the team uses for sending pre-alerts. uBond 2-3 times a day, Consol after that — with automatic deduplication so no customer gets the same email twice. Every send is logged, every failure is retried."

### Slide 13: Case Management + AI Follow-ups
- Problem: Emails sent, nobody tracks replies. ₹5K-₹10K/day BOE penalty. ₹1K/day DO penalty.
- Solution: Full case lifecycle (awaiting_reply → reply_received → documents_provided → boe_filed → assessment → out_of_charge → do_ready → do_collected → closed)
- AI follow-up scheduler: Timer-based, AI-authored drafts, human approval gate
- Dashboards: Pre-alert KPIs, post-arrival tracking, penalty exposure, SLA breaches
- **Speaker notes:** "The real money is in penalties. ₹5,000 to ₹10,000 per day for late BOE filing. ₹1,000 per day for late DO collection. This system tracks every case, sends AI-drafted follow-ups on schedule, and shows penalty exposure in real time."

### Slide 14: AI Email Classification
- Problem: Every inbound email read, classified, replied manually. 13 hardcoded regex rules — false positives, compliance risk.
- Solution: Multi-stage AI engine — VIP/Legal hard gates → rule fast-path → embedding classifier (1536d) → LLM verifier (GPT-4o-mini) → ensemble fusion → route decision
- Three routes: AI_AUTO_SEND (safe patterns) / AI_DRAFT_HOLD (needs human approval) / HUMAN_REVIEW (edge cases)
- 12 safety gates govern autonomy
- **Speaker notes:** "The AI engine classifies every incoming email. Routine queries get auto-replied. Edge cases go to humans with an AI draft ready. 12 safety gates prevent mistakes — VIP senders, legal keywords, and low-confidence cases always go to a human."

### Slide 15: This Is What It Took to Build
- Headline: "Built End-to-End by One Person"
- Six categories with brief scopes:
  - Frontend: 15+ UI pages, Next.js 16, Tailwind
  - Backend: 40+ API routes, 50+ DB migrations, queue system, distributed locks
  - Database: PostgreSQL with pgvector, 15+ tables, RLS policies, fuzzy matching
  - AI: Vapi voice agent, GPT-4, embedding classifier, RAG, ensemble fusion
  - Research: POCs for conversion (server vs client), email sending (SMTP vs Graph vs Power Automate), AI voice (Vapi vs Twilio), ML classification approaches
  - VBA + Scripts: 5+ Outlook macros, Python ML training pipelines
- Bottom: "Every line of code, every decision, every test — done independently."
- **Speaker notes:** "I want to be transparent about the scope. This isn't a small script. It's a full-stack platform with frontend, backend, database, AI integration, and research — all built by me. I researched multiple approaches for every major component before choosing the right one."

### Slide 16: What's Needed to Go Live
- Table with three columns: Resource | Why | Cost
  - Vapi API account | AI voice calling platform | $20 minimum deposit
  - Phone number (Twilio) | Outbound calls to Indian numbers | ~$1.15/mo
  - Voice agent credits | Per-minute AI calling (TTS + STT + LLM) | ~$0.05/min
  - SMTP/Graph credentials | Send pipeline email dispatch | Free (IT provided)
  - Shared mailbox access | Inbound email ingestion | Free (IT provided)
- Total estimated monthly cost for AI calling: ~$30-50/month
- Green checkmark column: "Everything else is already built and working"
- **Speaker notes:** "The platform is built. The code compiles with zero errors. The database is seeded with 36,000 records. To go fully live, I need five things from IT — most are free internal resources. The only paid item is the Vapi account at $20 to start, plus ~$30-50/month for AI calling at moderate usage."

### Slide 17: The Ask
- Headline: "You asked for this in 30 days. I'm ready in 1 week."
- Left box: "STATUS" — Clearance fill: ready today. Send pipeline: code complete (waiting on SMTP). AI calls: ready to configure (waiting on Vapi account).
- Right box: "WHAT I NEED" — Vapi account ($20), SMTP credentials, shared mailbox access.
- Bottom: "Give me these resources this week, and the team starts using it this week."
- **Speaker notes:** "My TL asked me to present the outcome on Monday and said we need to start from Monday. The system is ready. The team can start using the clearance fill upload, review, and download workflow today. For AI calling and email sending, I need the resources listed. Give me these this week, and we're fully live this week."

### Slide 18: What the Team Can Start Using RIGHT NOW
- Four cards, each with URL and one-line description:
  - /clearance-fill — Upload Excel, auto-fill, override, initiate calls
  - /clearance-fill/dashboard — View batch history, call results, enriched downloads
  - /clearance-fill/seed — Upload historical Excel to build master DB (one-time)
  - /clearance-fill/broker-rules — Add company→broker mapping rules via UI
- Bottom workflow: "Daily: Excel → Upload → Review → Override → Download"
- **Speaker notes:** "These four URLs work right now. No resources needed. I want everyone to start using /clearance-fill from today. Upload your next Excel, review the auto-fill results, override anything that's wrong, and download the enriched file. The workflow matches what you already do — just faster and automated."

### Slide 19: Thank You
- Simple closing slide
- "Questions?"
- Contact: Bipul Sikder
- FedEx logo
- **Speaker notes:** "I've built this platform to solve real problems I saw in our daily workflow. It's ready. I'm ready. Let's go live this week."

## Format Notes

- Use `<title>` for slide titles
- Use `- ` for bullet points
- Use `---` to separate slides
- Put `[SPEAKER NOTES]` before each slide's speaker notes
- Put `[DIAGRAM]` where a visual diagram is needed (describe what it should look like)
- Put `[DATA]` where real numbers should be highlighted
- Keep each slide content concise — the speaker notes carry the detail
- The audience is the FedEx operations team — use their language (AWB, NFBRK, FEBRK, Jeena, Sunimpex, uBond, Consol, BOE, DO, IGM, CHA)
- The underlying power dynamic: the TL hasn't been listening, the senior manager is the real decision-maker. Design the presentation to speak to the senior manager's concerns (results, readiness, resource requirements, timeline)

Now generate the full presentation content slide by slide.
