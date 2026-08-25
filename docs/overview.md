Real FedEx Pre-Alert Operations (as understood from code + templates)
The daily workflow:
1. Operations team gets an Excel with AWBs, consignees, freight, clearance type
2. They pre-alert each consignee via email with AWB, freight, attachments (DO FORMAT, BANK DETAILS)
3. Consignees reply → some auto-handled, some need human follow-up
4. Reminders at 48h (soft) and 72h (final, penalty warning)
5. DO Collection — consignee pays ₹3068, submits authorization letter + UTR, gets Delivery Order
6. If no DO within 24h → additional ₹1000/day + GST penalty
3 clearance types (mixed in same batch):
- NFBRK → consignee's own broker. Attach DO FORMAT.docx, BANK DETAILS.docx. Consignee handles everything.
- FEBRK-Jeena → FedEx broker Jeena clears. CC 10+ Jeena team members.
- FEBRK-Sunimpex → FedEx broker Sunimpex clears. CC Sunimpex team.
Core Motive of This System
Replace the manual Excel + Outlook workflow with an automated pipeline:
1. Batch send pre-alerts with correct template per AWB (not one-size-fits-all)
2. AI auto-handle 50%+ of consignee replies (payment received, status queries, info-only)
3. Queue the rest for human review with classification
4. Auto-remind at 48h/72h without human intervention
5. Track DO collection — the terminal output of the entire process
6. Team collaboration — claim, assign, escalate, audit trail

----
DO vs Bill of Entry — The Real Process
ARRIVAL DAY (Day 0)
├── Pre-alert sent ──────────── we do this ✓
├── Consignee provides docs ─── we track as "reply_received" ✓
├── **BOE filed by broker** ─── NOT tracked ✗ (₹5000/day penalty if missed!)
│
DAY 1-3
├── Customs clearance ───────── NOT tracked ✗
│
DO COLLECTION (after clearance)
├── DO collected with ₹3068 ─── we track this ✓ (₹1000/day extra if late)
│
CLOSED
Where the real financial impact is
BOE (Bill of Entry) — filed by broker with customs. This is where the ₹5K/10K penalties apply. The 3-hour SLA in the email is about getting documents to the broker SO they can file BOE on arrival day. Missing this = real money.
DO (Delivery Order) — release of cargo after clearance. ₹3068 fee + ₹1000/day late penalty. Important but smaller financial impact.

Current system gap
We jump from reply_received → do_collected but skip the entire BOE filing → Customs clearance middle section where the real compliance risk lives.
The case lifecycle should be:
awaiting_reply → reply_received → documents_provided → boe_filed → clearance_in_progress → do_collected → closed
Where:
- BOE filed = compliance milestone (broker filed with customs)
- Clearance in progress = customs assessing duties
- DO collected = cargo released to consignee
What I recommend we restructure
1. Add boe_filed_at + clearance_completed_at to awb_cases — track the compliance milestones
2. Add documents_provided, boe_filed, clearance_in_progress statuses — reflect real stages
3. BOE penalty calculator — show ₹5K/₹10K per day if BOE not filed by end of arrival day
4. Show both penalty tracks in the case detail — BOE penalty + DO penalty
5. The 3-hour SLA urgency indicator — how long since pre-alert was sent without docs returned