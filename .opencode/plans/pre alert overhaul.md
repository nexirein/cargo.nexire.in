lets make our pre alert better first to absolute fcking insane , means fully working means from uploading excel file to figure out calling section and we hit run to the calls to ai generated calls for that i wiil use vapi api call to call them and ask the following thing with a proper fedex representative like call with the data on that AWB have freight coming from or whatever "10:22 AM	Loc	Date	AWB Numbers	Consignee Name	Freight	Currency	End Result	Mode	PIN Code	Standard Remarks	FedEx Broker	Contact	ConsigneeEmailID	Duty Bill Account 	Value	PieceQty	KiloWgt	IEC	InstructionCD	Commit date	Account	SQL Account Customer Name	Primary CEP	Secondary CEP
Ayush Saklani	JAI	14-Jul-26	533042601093	ALISHKA GLOBAL	337.83	HKD	N FBRK	C	302020	sikder16bipul@gmail.com	#N/A	0	91-9166350130		1239351.68	1	1	NCP	0	15-Jul-26	#N/A	#N/A		
Ayush Saklani	JAI	14-Jul-26	874198708473	ALIF GENERAL TRADING	537.38	AUD	Calling	S	400056	bipul.sikder_btech22@gsv.ac.in	#N/A	AIM2UK@GMAIL.COM	9.1903E+11	204427818	931000	1	23	0	0	17-Jul-26	AU	AVON GLOBAL	#N/A	#N/A
Ayush Saklani	JAI	14-Jul-26	533042600980	GALLANT JEWELRY	326.33	HKD	 FEBRK	C	302022	bs9932338847@gmail.com	0	0	91-9784000294		7268669.46	2	3	1302007475	ALL SHIPMENT SELF CLEARANCE IN SEZ JAIPUR	16-Jul-26	#N/A	#N/A	#N/A	#N/A
Ayush Saklani	JAI	14-Jul-26	874281326424	JAIN GEMS INTERNATIONAL LLP	13333.5	INR	HOLD	O	302022	sikder32bipul@gmail.com	0	0	9.11413E+11	678635596	27602383.2	1	21.4	0	0	16-Jul-26	IN	JAIN GEMS INTERNATINL LLP*I/B*	#N/A	#N/A  " like this we will have in our db we will give the ai agent feeded so it will have context around the AWB and if customer requires some info it will give them info about the shipment.. like that with guide me end to end setup for vapi.. all the things ,and right now the batches creation there needs to be enhance the user ex its confusing confusing about selecting the template and we should able to select the template cause in our data field nfbrk febrk and calling is there so according to the field in upload in map field they can sleect thetemplate what they wanted to send to the consignee.. for example the data pasted above will go to pre alert here Map your columns
8 rows detected. Every other column is kept and stored alongside the shipment automatically.

AWB *

AWB Numbers
Consignee email *

ConsigneeEmailID
Consignee name

Consignee Name
Template

End Result  template dropdown is there but heres a error its dropdown doesnt contains the templates to selct instead the data field selection option from the excel next in attachments after validating , where there should be clear visible to select tiff folder right now have to select two times at a row one while in attachments and then click "Continue to convert TIFFs" then again in 4th step have to slect the folder then , it will be dont showcase this "Invoice files
No file chosen
Files are matched to an AWB by filename automatically — check the match before uploading. " in 3 attachments only 0 of 8 AWBs have an attachment

Continue to convert TIFFs
AWB	Consignee	Attachment " this is enough while click that button then team slect the folder and right now its uploading in supabase taking too much time to convert the tiff to pdf and attach with that respective AWB mails , and in valipdate or map only we should showcase the number of calling and get a confirm x no of calling ? yes like when classifed from mail and the nfbrj and febrk would be send , another very important thing i wanted to highlight is in the sheet there is a coloumn called "FedEx Broker" for nefbrk that doesnt needed if empty or anything that works but for Febrk the broker name is must in the data field so when the febrk broker is empty or 0 null then we have to play a different game first is we have to maintain a unified master data for all the company info ,cause in fedex its 90% of the case are when its 0 in the brker in febrk they teamates manually maintained a master excel sheet where they search on that company name and they got the broker name previously , in call we have to make two tabs one is for confirmation of nefbrk or febrk and another is for that data they cant able to find in database manually they assing to that to a calling agent for getting the confirmation of the broker sunimpex or jeena or they can manully also edit in the data that appeared infront of them so , so we need to reframe it such a way in our supabase database have to maintain a unifed master data aligning the company name and the previous broker they have worked with in febrk fedex. they manaully do this they search in there excel master sheet i will get the data soon the all data and import it in supabase for autofill the broker sunimpex or jeena based upon the previosu data and that if not present in our database and showcsae in ui that doesnt find in master then teammate shoudl have option manually search in there outlook with the company name then they got the data and update directly on the ui jeena or sunimpex still that doesnt find in outlook also they can slect all and assign to the ai calling agent..this agent confirms and update live on the dashboard so in every batch two types of call would be generated right ? 1. for "End Result" coloumn  which doesnt mention febrk or nfbrk only calling, the coloum so here also we can first check in our master if its available replace it to the respected nfbrk febrk and make sure it highlight that it has been updated from master so that later we have tracking metrics of how we are solving this problems how many we have replced the manually searching effort from outlook and master excel one by one .. in the dashboard we should have this metrics .. so how many manula efforts is replaced via call or  this one by one copy pasting thing from master excel .. and another thing is the conversion of tiff files should be in local and its already local but after that its supabase uploading taking too much time 20 second to upload one pdf *200 pdfs takes too much time any other method that we can attach to the specific pdf with the mail. please plan it out the whole thing how we can implement
Thought: 3.7s
The user has laid out a massive set of requirements. Let me break this down into clear areas:

1. Calling workflow with Vapi AI — AI-powered calls for calling-type clearance, with context from the AWB data
2. Template selection in mapping — The End Result column should map to templates, and the template dropdown should show actual templates from the DB, not just data field selection
3. Attachments/Convert flow — Too many steps, TIFF→PDF conversion too slow via Supabase storage upload
4. Calling confirmation & broker lookup — Two types of calls needed:
   a. Confirmation calls (NFBRK/FEBRK calling-type)
   b. Broker lookup calls (when FEBRK has no broker, need to find from master data)
5. Unified master data for brokers — Company → Broker mapping in Supabase, auto-fill when available
6. Dashboard metrics — Tracking manual effort replaced, master data hits, calling outcomes
7. TIFF conversion speed — Uploading to Supabase storage is slow for 200+ files

I'm in plan mode - I can only read/observe/plan. Let me explore the codebase to understand the current implementation and then present a comprehensive plan.

Let me start by exploring the key files.
Let me explore the current implementation to understand what needs to change before planning.
✓Explore Task — Explore batch mapping wizard
↳ 56 toolcalls · 1m 27s
✓Explore Task — Explore email send & storage
↳ 31 toolcalls · 1m 4s
ctrl+x down view subagents
Thought: 1.8s
Now I have a thorough understanding of the entire system. Let me formulate a comprehensive plan addressing all the user's points:

1. Vapi AI Calling Integration — Use Vapi API to make AI-powered calls for calling-type clearance
2. Template Selection in Mapping — Current mapping shows Excel column headers, not DB templates. Need to fix this
3. Attachments/Convert Flow — Current flow requires selecting TIFFs twice, too many steps
4. Calling Confirmation & Broker Lookup — Two types of calls
5. Unified Master Data for Brokers — Company → Broker mapping table
6. TIFF Conversion Speed — Supabase upload is slow for 200+ files
7. Dashboard Metrics — Tracking manual effort replaced

Let me organize this into a phased plan that makes sense.

Actually, I'm in plan mode - I can't make any edits. Let me present a comprehensive plan to the user.
Here's my comprehensive plan after understanding the full codebase:
Comprehensive Plan: Pre-Alert Overhaul
Phase 1: Fix & Simplify Batch UX
1.1 Template Selection in Mapping Wizard
Problem: The "Template" dropdown shows Excel column headers (like "End Result") instead of actual template names from the DB. The user has to know the convention (NFBRK → nfbrk template, CALLING → skip, etc).
Fix:
- In mapping-wizard.tsx, split the template column into two parts:
1. A dropdown to select which Excel column contains the clearance type (End Result / FedEx Broker)
2. Below that, load templates from the DB and let the user map Excel values to templates (e.g., "if 'NFBRK' in Excel → use 'NFBRK' template")
- Show a clear preview of how many rows map to each template type
File changes: mapping-wizard.tsx, validate/route.ts
1.2 Consolidate Attachments + Convert into One Step
Problem: User has to select files on Attachments page, then click "Continue to convert TIFFs", then select files AGAIN on Convert page. Also "0 of X AWBs have attachment" is shown before any files are picked — confusing.
Fix:
- Merge attachments + convert into a single step in the wizard
- Show the "Invoice files" drop zone and TIFF auto-detection inline
- Remove the two-click flow — user selects folder once, system auto-sorts TIFFs vs PDFs
- Show per-AWB match preview instantly after file selection
File changes: wizard-steps.tsx, merge attachments/page.tsx + convert/page.tsx into one page
1.3 Show Calling Count on Validate/Mapping Page
Problem: No visibility into how many calling-type rows exist.
Fix:
- During validation, count rows by clearance_type and return in the response
- Show a summary card: "X Calling · Y NFBRK · Z FEBRK" on the validate page
- Add a confirmation prompt: "X calling-type AWBs detected. These will create call tasks. Confirm?"
File changes: validate/route.ts, validate/page.tsx
Phase 2: Unified Broker Master Data
2.1 New broker_master Table
Create a new SQL migration:
CREATE TABLE broker_master (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  company_name_normalized text NOT NULL,  -- lowercased, no special chars for matching
  broker_type text NOT NULL CHECK (broker_type IN ('febrk-sunimpex', 'febrk-jeena')),
  broker_name text,
  broker_contact text,
  broker_email text,
  source text DEFAULT 'manual',  -- 'master_excel_import' | 'outlook_search' | 'call_confirmation'
  confirmed_count integer DEFAULT 0,
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX idx_broker_master_company ON broker_master(company_name_normalized, broker_type);
2.2 Import Existing Master Excel
- Create an upload page under Admin > Broker Master Data
- Parse the existing Excel and upsert into broker_master
- Normalize company names for fuzzy matching
2.3 Auto-Resolve Broker During Validation
In validate/route.ts, when processing febrk rows:
- Check FedEx Broker column value in the Excel
- If cell is 0 or empty or #N/A:
- Look up consignee_name / company_name in broker_master
- If found → auto-set clearance_type to febrk-sunimpex or febrk-jeena
- Log that it was resolved from master data (for metrics)
- Highlight in UI: "🔄 Resolved from master: → FEBRK Sunimpex"
- If not found:
- Flag for operator action: search in Outlook or assign to calling agent
- Two options in UI: "Search Outlook" (opens mailto: search) or "Assign to AI Calling Agent"
2.4 UI: Broker Resolution Dashboard
On the validate page or a new batch step:
- Show table of unresolved FEBRK rows
- For each: company name, search button, dropdown to select broker (Jeena/Sunimpex + name)
- Bulk actions: "Assign all unresolved to AI Calling"
Phase 3: Vapi AI Calling Integration
3.1 Vapi Setup (End to End)
3.1.1 Vapi Account Setup
1. Sign up at vapi.ai (https://vapi.ai)
2. Create an API key
3. Set VAPI_API_KEY env var
4. Create an assistant in Vapi dashboard with:
- Voice: FedEx professional (choose a natural Indian English voice)
- Model: GPT-4 or Claude for context understanding
- System prompt (see below)
3.1.2 System Prompt for AI Agent
You are a FedEx customer service representative calling consignees about their
shipment clearance. Your tone is professional, polite, and helpful.

You have access to the following shipment data:
- AWB Number: {awb}
- Consignee Name: {consignee_name}
- Origin: {origin}
- Destination: {dest}
- Pieces: {pieces}
- Weight: {weight}
- Freight: {freight} {currency}
- Clearance Type: {clearance_type}
- Shipper: {shipper}

Your call purpose:
1. For CALLING type: Confirm whether the consignee wants FedEx CHA clearance
   (FEBRK Jeena or FEBRK Sunimpex) or their own CHA (NFBRK).
2. For FEBRK without known broker: Ask if they prefer Jeena & Co. or Sunimpex
   for FedEx clearance.
3. If the customer asks about freight charges, inform them it's mentioned in
   the invoice or they can email india@fedex.com.

Rules:
- Do NOT share confidential pricing information
- If the customer seems confused, offer to send them an email with details
- Always confirm the AWB number at the start of the call
- Take notes on the customer's response
- At the end, confirm next steps clearly
3.1.3 Create Vapi Assistant via API
Create a server action src/lib/vapi/create-assistant.ts:
export async function createFedExAssistant() {
  const response = await fetch("https://api.vapi.ai/assistant", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: "FedEx Clearance Agent",
      model: {
        provider: "openai",
        model: "gpt-4",
        temperature: 0.7,
        systemPrompt: `...` // above prompt
      },
      voice: {
        provider: "11labs", // or Azure, etc
        voiceId: "chris", // pick an appropriate voice
      },
      firstMessage: "Hello, this is [Name] calling from FedEx India. Am I speaking with [Consignee Name]?",
    }),
  });
  return response.json(); // returns assistantId
}
Store the assistantId in an env var or DB config.
3.1.4 Initiate a Call
Server action src/lib/vapi/start-call.ts:
export async function startCall(callTaskId: string) {
  const callTask = await getCallTask(callTaskId);
  const caseData = await getCaseWithAwbData(callTask.awb_case_id);
  
  const response = await fetch("https://api.vapi.ai/call", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
    },
    body: JSON.stringify({
      assistantId: process.env.VAPI_ASSISTANT_ID,
      phoneNumber: caseData.contact_phone, // from the Excel data
      customer: {
        number: caseData.contact_phone,
      },
      metadata: {
        callTaskId,
        awb: caseData.awb,
        caseId: caseData.id,
      },
      variables: {
        awb: caseData.awb,
        consignee_name: caseData.consignee_name,
        origin: caseData.origin_port,
        dest: caseData.dest_port,
        pieces: caseData.pieces_arrived,
        weight: caseData.weight,
        freight: caseData.freight,
        currency: caseData.currency,
        clearance_type: caseData.clearance_type,
        shipper: caseData.shipper,
      },
    }),
  });

  const { id: vapiCallId } = await response.json();
  
  // Update call_task with vapi_call_id
  await updateCallTaskVapiId(callTaskId, vapiCallId);
  
  return vapiCallId;
}
3.1.5 Webhook Handler for Call Results
Create src/app/api/vapi/webhook/route.ts to receive Vapi call events:
- call.ended → Fetch recording transcript + summary
- If clearance_type was resolved (NFBRK/FEBRK):
- Update the batch_item's clearance_type
- Update broker_master if new broker info was confirmed
- Log the call outcome
- Mark call_task as completed with result data
3.2 Call Types and Flow
Type 1: Confirmation Calls (for "CALLING" clearance type)
- Purpose: Confirm if NFBRK or FEBRK (and which broker)
- Trigger: During batch send, when clearance_type = "calling" → create call_tasks with call_type = "confirmation"
- After Vapi call confirms:
- If NFBRK → update clearance_type to nfbrk, send email
- If FEBRK Jeena → update to febrk-jeena, send email
- If FEBRK Sunimpex → update to febrk-sunimpex, send email
Type 2: Broker Lookup Calls (for FEBRK without known broker)
- Purpose: Confirm whether consignee wants Jeena or Sunimpex
- Trigger: When FEBRK row has empty/0 broker AND not found in master data
- After Vapi call confirms:
- Update clearance_type and broker_master table
- Proceed with sending the appropriate template
Type 3: Follow-up Calls (existing — DO/BOE follow-ups)
- Already implemented, no change needed
3.3 UI: Call Dashboard
Tab 1: "Confirmation Calls" (PRE-ALERT section)
- Shows call_tasks with call_type = "confirmation"
- Each row: AWB, Consignee, Status, Vapi Call ID, Result
- Action: "Call Now" → triggers Vapi call → shows live status
- Batch action: "Call All Pending"
Tab 2: "Broker Lookup" (NEW — in ARRIVAL section or shared)
- Shows FEBRK rows where broker was not found in master
- Each row: AWB, Company Name, Status, Notes
- Actions: "Search Outlook", "Assign to AI Call", "Manual Edit" (dropdown to pick Jeena/Sunimpex + name)
Phase 4: TIFF Conversion Speed
Problem: After converting TIFF→PDF in-browser, each PDF is uploaded to Supabase Storage individually. For 200 PDFs × 20 seconds = ~67 minutes. The bottleneck is the sequential upload + DB registration.
Solutions (in order of effectiveness):
Option A: Parallel Uploads (Easiest, ~5x faster)
- Currently, converted PDFs are uploaded one at a time via the register API
- Change to batch upload: upload all PDFs in parallel (Promise.all with a concurrency limit of 10)
- Then batch-register all file_assets in a single DB call
Option B: Upload as ZIP (Recommended)
- After conversion, package all PDFs into a single ZIP blob in-browser
- Upload the single ZIP to Supabase Storage
- On the server, extract the ZIP and register each file
- Reduces 200 uploads → 1 upload
Option C: Skip Storage Entirely (Most Complex)
- Store attachments as base64 directly in batch_items or a new attachment_data table
- Avoid Supabase Storage calls entirely
- Trade-off: larger DB rows, but no storage round-trips during send
Recommended: Option B (Upload as ZIP)
- In conversion-runner.tsx, after all conversions complete, zip the PDFs using JSZip
- Upload single ZIP to Supabase Storage
- New API route: POST /api/batches/{id}/attachments/extract-zip that:
1. Downloads the ZIP from storage
2. Extracts each PDF
3. For each PDF: uploads to invoices/{batchRunId}/{awb}/{pdfName}
4. Registers file_assets in bulk
5. Deletes the ZIP
- This moves the per-file upload to the server (faster network)
- Add a progress indicator showing "Extracting files on server..."
Phase 5: Dashboard Metrics
Add a new "AI & Automation" tab on the Dashboard or a dedicated page:
5.1 Metrics to Track
Metric	Source	Meaning
Calls made (Vapi)	call_tasks.vapi_call_id IS NOT NULL	Total AI calls initiated
Calls completed	call_tasks.status = 'completed' AND vapi_call_id IS NOT NULL	Successful calls
Broker auto-resolved	awb_cases where broker was set from broker_master	Master data hits
Broker via Outlook	Manually tracked	Searched in Outlook
Broker via call	call_tasks with call_type = 'broker_lookup' completed	Confirmed via AI call
Manual effort saved	Sum of broker_auto_resolved + broker_via_call	Total replacements
Master data coverage	broker_master count	Size of broker database
5.2 Data Sources for Tracking
Add columns to awb_cases or a new batch_metrics table:
-- On awb_cases
ALTER TABLE awb_cases ADD COLUMN IF NOT EXISTS broker_resolved_from text; -- 'master' | 'call' | 'outlook' | 'manual'
ALTER TABLE awb_cases ADD COLUMN IF NOT EXISTS broker_resolved_at timestamptz;
ALTER TABLE awb_cases ADD COLUMN IF NOT EXISTS broker_original_value text; -- what was in the Excel before resolution
Add to call_tasks:
ALTER TABLE call_tasks ADD COLUMN IF NOT EXISTS vapi_call_id text;
ALTER TABLE call_tasks ADD COLUMN IF NOT EXISTS vapi_recording_url text;
ALTER TABLE call_tasks ADD COLUMN IF NOT EXISTS vapi_transcript text;
ALTER TABLE call_tasks ADD COLUMN IF NOT EXISTS vapi_summary text;
ALTER TABLE call_tasks ADD COLUMN IF NOT EXISTS result_data jsonb; -- already exists
ALTER TABLE call_tasks ADD COLUMN IF NOT EXISTS call_type ADD VALUE 'broker_lookup';
Phase 6: Implementation Order
 1. P1: Fix template selection in mapping wizard — show real DB templates
 2. P1: Merge attachments + convert into single step
 3. P1: Show calling count on validate page + confirmation prompt
 4. P2: Create broker_master table + migration
 5. P2: Import existing master Excel via Admin page
 6. P2: Auto-resolve broker during validation
 7. P2: Broker resolution UI (search/assign/manual)
 8. P3: Vapi setup + create assistant
 9. P3: Start call + webhook handlers
10. P3: Call dashboard UI (two tabs)
11. P4: TIFF ZIP upload + server extract
12. P5: Dashboard metrics for broker resolution
Key Technical Decisions
Decision	Choice	Reason
Vapi call initiation	Server action, not client	Phone numbers stay server-side
Call status tracking	Webhook + polling	Vapi webhooks deliver results asynchronously
Broker matching	Normalized company name + fuzzy fallback	Excel data has inconsistent company names
TIFF speed	ZIP upload + server-side extract	Reduces 200 uploads → 1
Template mapping	Dropdown of DB templates + user maps Excel values	Flexible for changing templates
Broker DB source	broker_master table (not separate file)	Queryable, indexable, auditable
Files That Need Changes
File	Phase	Change
src/app/(app)/batches/[id]/mapping/mapping-wizard.tsx	P1	Add template selector from DB
src/components/batches/wizard-steps.tsx	P1	Merge attachments + convert step
src/app/(app)/batches/[id]/attachments/page.tsx	P1	Merge with convert
src/app/(app)/batches/[id]/convert/page.tsx	P1	Merge into attachments
src/app/(app)/batches/[id]/validate/page.tsx	P1	Add calling count card
src/app/api/batches/[id]/validate/route.ts	P1	Return clearance_type breakdown, broker resolution
src/lib/cases/clearance-type.ts	P2	Add broker lookup logic
supabase/migrations/0032_broker_master.sql	P2	New table
src/app/(app)/admin/broker-master/page.tsx	P2	Import/upload UI
src/lib/vapi/create-assistant.ts	P3	Vapi assistant setup
src/lib/vapi/start-call.ts	P3	Initiate calls
src/app/api/vapi/webhook/route.ts	P3	Call results webhook
src/app/(app)/calls/page.tsx	P3	Add broker_lookup tab
src/app/(app)/holds/actions.ts	P3	Update call_tasks with Vapi ID
src/lib/tiff/pool.ts	P4	Add ZIP packaging after conversion
src/app/api/batches/[id]/attachments/extract-zip/route.ts	P4	Server-side ZIP extraction
src/app/(app)/dashboard/page.tsx	P5	Add automation metrics cards
Which phase would you like to start with? I'd recommend P1 (UX fixes) first since it directly impacts the daily batch creation workflow, followed by P2 (broker master data) since it's a prerequisite for P3 (Vapi calls).