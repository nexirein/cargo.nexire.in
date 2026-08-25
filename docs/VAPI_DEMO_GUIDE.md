# Vapi AI Call Demo Guide — Tomorrow's Presentation

## Prerequisites

### Vapi Account Setup (Before Demo)

1. Go to [Vapi Dashboard](https://dashboard.vapi.ai) (already have account — $0 deposit needed for test mode)
2. Create an assistant (or use existing "FedEx Clearance Agent"):
   - Model: OpenAI GPT-4
   - Voice: 11labs Rachel
   - System prompt: already set to ask about clearance in customer-friendly language
3. Get `VAPI_API_KEY` and `VAPI_ASSISTANT_ID` — set them in `.env.local`
4. No phone purchase needed — use Vapi's **Test Call** feature (calls YOUR phone)

### Test Mode

- Vapi lets you place test calls to your own phone number for free
- You answer and play the part of the consignee
- See transcript + structuredData result in Vapi dashboard

### Environment Variables Needed

```env
VAPI_API_KEY=your_key_here
VAPI_ASSISTANT_ID=your_assistant_id_here
VAPI_WEBHOOK_SECRET=any_secret_for_testing
```

***

## What Triggers an AI Call? (The Criteria)

After upload + 3-chain auto-fill, items are flagged for AI call when:

| Call Reason       | Trigger Condition                                                       | What the AI Asks                                 |
| ----------------- | ----------------------------------------------------------------------- | ------------------------------------------------ |
| `needs_clearance` | Company not in master DB, not in Excel's End Result, fuzzy match failed | "Do you handle clearance yourself or use a CHA?" |
| `needs_broker`    | FEBRK type but broker (Jeena/Sunimpex) couldn't be resolved             | "Which CHA/broker do you use?"                   |
| `needs_email`     | No `@` email found in any source (Excel, remarks, master DB)            | "What's your email for documents?"               |

An item appears in **"Need AI Call"** section when `callReasons.length > 0`.

**Cannot call:** Items without phone → show red "No Phone" badge → manual override instead.

***

## Test Data to Prepare

Create a sample Excel with these 5 rows:

| Agent | Loc | Date      | AWB      | Consignee       | ConsigneeEmail        | Contact    | Broker/End Result                  |
| ----- | --- | --------- | -------- | --------------- | --------------------- | ---------- | ---------------------------------- |
| BLR   | BLR | 27-Jul-26 | 80100001 | Test Corp Ltd   | <known@test.com>      | 9999999901 | (empty — needs clearance)          |
| BLR   | BLR | 27-Jul-26 | 80100002 | Demo Industries | <known@demo.com>      | 9999999902 | CALLING (needs clearance + broker) |
| BLR   | BLR | 27-Jul-26 | 80100003 | Sample Co       | (empty — needs email) | 9999999903 | FEBRK-Jeena (only email missing)   |
| BLR   | BLR | 27-Jul-26 | 80100004 | New Company XYZ | (empty)               | 9999999904 | CALLING (needs all 3)              |
| BLR   | BLR | 27-Jul-26 | 80100005 | No Phone Inc    | <known@test.com>      | (empty)    | CALLING (no phone — demo override) |

### Expected Auto-Fill Results BEFORE AI Calls

| AWB      | Clearance Type Resolved? | Broker Resolved?    | Email Resolved? | Call Reasons                                   | Phone?             |
| -------- | ------------------------ | ------------------- | --------------- | ---------------------------------------------- | ------------------ |
| 80100001 | No                       | Yes (already known) | Yes             | `[needs_clearance]`                            | Yes                |
| 80100002 | No (CALLING)             | No                  | Yes             | `[needs_clearance, needs_broker]`              | Yes                |
| 80100003 | Yes (FEBRK-Jeena)        | Yes                 | No              | `[needs_email]`                                | Yes                |
| 80100004 | No (CALLING)             | No                  | No              | `[needs_clearance, needs_broker, needs_email]` | Yes                |
| 80100005 | No (CALLING)             | No                  | Yes             | `[needs_clearance, needs_broker]`              | **No** → red badge |

***

## Step-by-Step Demo Flow

### 1. Upload Excel

1. Go to `/clearance-fill`
2. Upload the sample Excel
3. Show the 3 sections appear:
   - ✅ **Resolved from Excel/Rule** (if any)
   - ✅ **Resolved from Master DB**
   - ⏳ **Need AI Call** (4 items with phone + 1 with "No Phone")

### 2. Show "Need AI Call" Table

- Point out the **Missing Fields** column: shows what's needed per row
- Point out **Call Status**: "pending"
- Point out **"No Phone"** red badge on AWB-005
- Explain: "These 4 items need AI calls. One item has no phone — we'll override manually."

### 3. Initiate Calls

1. Click **"Initiate AI Calls"** button
2. Show response: "4 calls initiated" + "1 item skipped (no phone)"
3. Then click **"Process Calls"** — this sends them to Vapi

### 4. Run Test Call (Vapi Dashboard)

Go to Vapi Dashboard → Calls tab → find the queued call

**Test Call Option A (Recommended):** In Vapi dashboard, click "Test Call" → enter your own phone → Vapi calls you → answer and play the consignee

**Test Call Option B:** Vapi dashboard has a "Simulate" button that shows the AI conversation without calling

***

## Test Scenarios (One by One)

### Scenario 1: Needs Clearance Only (AWB-80100001)

**Item state:** Clearance missing, broker+email known

**AI says:** "Hello, this is calling from FedEx India. Am I speaking with \[consignee]? I'm calling about your shipment AWB 80100001. Do you handle customs clearance yourself, or does a CHA or customs broker handle it for you?"

**You say (as consignee):** "We handle it ourselves."

**AI should respond:** "Okay, noted. So you'll manage the clearance on your own. Let me confirm that's all we needed for this shipment. Thank you!"

**Expected structuredData:**

```json
{
  "clearanceType": "NFBRK",
  "fedexBroker": "",
  "consigneeEmail": "known@test.com"
}
```

**Result in UI:** This item moves from "Need AI Call" to "Resolved" section.

***

### Scenario 2: Needs Clearance + Broker (AWB-80100002)

**Item state:** Clearance missing, broker missing, email known

**AI says:** "...about AWB 80100002. Do you handle customs clearance yourself, or does a CHA or customs broker handle it for you?"

**You say:** "Our CHA handles it."

**AI says:** "Great. Which CHA or broker do you use for FedEx clearance?"

**You say:** "Jeena & Co."

**AI says:** "Perfect. So Jeena & Co. handles the clearance for this shipment. Thank you!"

**Expected structuredData:**

```json
{
  "clearanceType": "FEBRK-Jeena",
  "fedexBroker": "Jeena & Co.",
  "consigneeEmail": "known@demo.com"
}
```

**Result in UI:** Moves to Resolved section with clearance type FEBRK-Jeena + broker Jeena & Co.

***

### Scenario 3: Needs Email Only (AWB-80100003)

**Item state:** Clearance+borker resolved, email missing

**AI says:** "...about AWB 80100003. We already have your clearance details as FEBRK handled by Jeena & Co. Just need to confirm — what email address should we send your shipment documents to?"

**You say:** "Send to <accounts@sample.co>"

**AI says:** "<accounts@sample.co> — is that correct?"

**You say:** "Yes."

**Expected structuredData:**

```json
{
  "clearanceType": "FEBRK-Jeena",
  "fedexBroker": "Jeena & Co.",
  "consigneeEmail": "accounts@sample.co"
}
```

**Result in UI:** Email filled, item resolved.

***

### Scenario 4: Needs All 3 Fields (AWB-80100004)

**Item state:** Everything missing — this is the FULL test

**AI says:** "...about AWB 80100004. Do you handle customs clearance yourself, or does a CHA or customs broker handle it?"

**You say:** "Our broker Sunimpex handles everything."

**AI says:** "Noted. So Sunimpex is your CHA for FedEx clearance. And what email should we send the shipment documents to?"

**You say:** "<info@newcompany.xyz>"

**AI says:** "<info@newcompany.xyz> — confirmed. Thank you. Sunimpex will be handling this."

**Expected structuredData:**

```json
{
  "clearanceType": "FEBRK-Sunimpex",
  "fedexBroker": "Sunimpex",
  "consigneeEmail": "info@newcompany.xyz"
}
```

**Result in UI:** All 3 fields resolved in one call.

***

### Scenario 5: No Phone — Manual Override (AWB-80100005)

**Item state:** No phone number in Excel

**UI shows:** Red "No Phone" badge, cannot initiate call

**Demo:**

1. Click "Override" button → manually type clearance type + broker + email
2. Or go to master DB, add this company's data manually
3. Show that items without phones are handled gracefully — no crash, just clear indication

***

## Common Customer Responses & Mapping

| Customer Says                                   | Maps To                | Clearance Type | Broker              |
| ----------------------------------------------- | ---------------------- | -------------- | ------------------- |
| "We do it ourselves" / "Self clearance" / "Own" | NFBRK                  | NFBRK          | (none)              |
| "Our CHA handles it" + "Jeena"                  | FEBRK-Jeena            | FEBRK-Jeena    | Jeena & Co.         |
| "Our broker handles it" + "Sunimpex"            | FEBRK-Sunimpex         | FEBRK-Sunimpex | Sunimpex            |
| "Agent handles it" + "some other name"          | FEBRK + unknown broker | FEBRK          | whatever name given |
| "I don't understand"                            | UNKNOWN                | UNKNOWN        | (needs manual)      |

***

## What to Show to the Team (Demo Script)

### Part 1: The Setup (30 sec)

1. "First, my VBA script runs on the Excel — searches Outlook, finds clearance from email history, fills End Result column."
2. "Then I upload that script-processed Excel to the Clearance Fill system."

### Part 2: Auto-Fill (1 min)

1. Upload the sample Excel
2. Watch the three sections populate
3. "See — some already resolved from the script/excel, some from the master DB. 4 items still need AI calling."

### Part 3: Initiate + Process (30 sec)

1. Click "Initiate AI Calls"
2. Click "Process Calls"
3. "This sends them to Vapi. Vapi will call the consignees."

### Part 4: The AI Call (3 min — this is the WOW moment)

1. Open Vapi dashboard
2. "Watch — the AI calls the consignee. It knows exactly what's missing for each shipment."
3. Run the test call for AWB-80100004 (needs all 3 — most impressive)
4. After call: show transcript + structuredData result
5. "One call. All three fields collected. No human needed."

### Part 5: Result (30 sec)

1. Go back to the Clearance Fill dashboard
2. Refresh — items moved from "Need AI Call" to resolved
3. "Everything enriched. Ready to download."

### Part 6: Download (15 sec)

1. Click "Download Enriched Excel"
2. "9 columns, ready for pre-alert send."

***

## Backup Plan if Vapi Fails

| Issue                      | Backup                                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Vapi test call not working | Show the Vapi dashboard UI, explain what WOULD happen. Show a recorded demo video or screenshots.               |
| API key not set            | The auto-fill demo works WITHOUT Vapi — still show 80-90% auto-resolved, explain AI calling is the final piece. |
| Webhook not processing     | Show the call\_tasks table in Supabase — explain webhook processes it automatically.                            |
| No internet                | Keep offline screenshots of each screen.                                                                        |

***

## Key Talking Points for the Team

1. **"Customers don't know NFBRK/FEBRK"** — The AI never uses these terms. It asks in plain English: "Do you handle clearance yourself or use a CHA?" Maps their answer automatically.
2. **"One call, all fields"** — The AI knows exactly what's missing per item and asks ONLY those questions. No back-and-forth.
3. **"Self-learning"** — Every call result updates the master DB. Next time this company appears, it's already known. No call needed.
4. **"80-90% auto-resolved before any AI call"** — The VBA script + master DB handle most of the work. AI calling is just for the remaining few.
5. **"Built by one person, in one week"** — The whole platform including AI calling.
6. **"Cost: \~$1.15/month per phone number"** — One Vapi phone number + $20 Vapi deposit is all we need.

***

## Quick Reference: Vapi Dashboard Links

| Feature                 | URL                                    |
| ----------------------- | -------------------------------------- |
| Assistant Config        | <https://dashboard.vapi.ai/assistants> |
| Call Logs (transcripts) | <https://dashboard.vapi.ai/calls>      |
| Test Call               | Click "Test Call" on any assistant     |
| API Keys                | <https://dashboard.vapi.ai/api-keys>   |

