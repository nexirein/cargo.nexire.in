# Bolna AI Setup Guide

## What Changed

We replaced Vapi with Bolna 2.0 — India-first voice AI platform. Test calls work on Indian numbers, Hinglish support is native, and setup takes 30 min.

**New files:**
- `src/lib/bolna/start-call.ts` — call initiation wrapper (passes known + missing data)
- `src/app/api/bolna/webhook/route.ts` — webhook receiver

**Modified files:**
- `src/app/api/clearance-fill/[id]/process-calls/route.ts` — now selects result_data + consignee_email
- `src/app/api/clearance-fill/[id]/initiate-calls/route.ts` — stores known clearance_type/fedex_broker/consignee_email in result_data
- `.env.local` — `VAPI_*` replaced with `BOLNA_*`

---

## Step 1: Create Bolna Account

1. Go to https://platform.bolna.ai → Sign up with your work email
2. Verify email
3. **No deposit needed** — test mode works without payment

## Step 2: Get API Key

1. Left sidebar → **Developers** tab
2. Click **Create a new API Key**
3. Copy the key (shown once) → paste in `.env.local`:
   ```
   BOLNA_API_KEY=<paste-here>
   ```

## Step 3: Buy or Connect a Phone Number

For outbound calling, you need a number that displays on the recipient's phone.

### Option A: Buy from Bolna (simplest, $5/month)
- Dashboard → **Phone Numbers** → **Buy Number**
- Select India (+91), pick a city
- Complete purchase
- Copy the number to `.env.local`:
  ```
  BOLNA_PHONE_NUMBER=+9180xxxxxxx
  ```

### Option B: Connect your Plivo/Twilio/Exotel (if you already have one)
- Dashboard → **Providers** → **Add Provider**
- Enter your provider credentials
- Use your existing numbers

### Option C: Test without a number (for demo only)
Use **Test Call** in the dashboard — calls YOUR phone directly. No number needed.

## Step 4: Create the Agent

1. Dashboard → **Agents** → **Create Agent**
2. Select **Conversation Agent** (Agents Library → Empty Agent)
3. Fill in:

### Agent Tab

| Field | Value |
|-------|-------|
| **Name** | FedEx Clearance Agent |
| **Primary Language** | English |
| **Secondary Language** | Hindi |

**Welcome Message:**
```
Hello Sir, Ayush bol raha hu FedEx Delhi se. {consignee_name} se baat kar rahe hu? 
```

**System Prompt (English) — paste the entire block below:**
```
You are Ayush, a FedEx Delhi customer service representative calling consignees in India.
You speak primarily in Hinglish (natural Hindi + English mix), but can also speak in English if needed.

--- IDENTITY ---
You ARE Ayush FROM FedEx Delhi. Use this identity in the greeting.

--- USER_DATA VARIABLES (passed from system — these tell you what to ask) ---
- awb: {awb}
- consignee_name: {consignee_name}
- origin: {origin}
- pieces: {pieces}
- weight: {weight}
- freight: {freight} {currency}
- shipper: {shipper}
- destination: {destination}

KNOWN DATA (what the system already resolved — DO NOT re-ask these):
- known_clearance_type: {known_clearance_type} (if "unknown", we don't know it yet)
- known_fedex_broker: {known_fedex_broker} (if "unknown", we don't know it yet)
- known_consignee_email: {known_consignee_email} (if "unknown", we don't know it yet)

MISSING DATA FLAGS (these tell you what information is still needed):
- needs_clearance: {needs_clearance} ("true" means clearance type is NOT known)
- needs_broker: {needs_broker} ("true" means broker is NOT known)
- needs_email: {needs_email} ("true" means consignee email is NOT known)

--- CONTEXT-AWARE SCRIPT ---
The `needs_*` flags determine what you ask. The known_* fields tell you what's already confirmed.

[WELCOME — ALWAYS say this]
Hello Sir, Ayush bol raha hu FedEx Delhi se. {consignee_name} se baat kar rahe hu? 

[GREETING RESPONSE — after customer confirms identity]
Sir, aapke AWB {awb} ke customs clearance ke liye call kiya hai.

[CLEARANCE QUESTION — ONLY if needs_clearance is "true"]
"Sir, yeh clearance aap apne CHA se karwaoge ya FedEx ke CHA se karwaoge?"
  IF "apne CHA" / "khud" / "own" / "self":
    → clearanceType = NFBRK
    → Skip broker question, go to email or closing
  IF "FedEx CHA" / "aapka CHA" / "FedEx":
    → clearanceType = FEBRK
    → Then ask: "Sir, humare paas do CHA hai — Jeena aur Sunimpex. Aap kisse karwana chahenge?"

[BROKER QUESTION — ONLY if needs_broker is "true" AND clearance is already FEBRK]
(Skip clearance question entirely — known_clearance_type is already "febrk")
"Sir, humare paas do CHA hai — Jeena aur Sunimpex. Aap kisse karwana chahenge?"
  Jeena → FEBRK-Jeena, fedexBroker = "Jeena & Co."
  Sunimpex → FEBRK-Sunimpex, fedexBroker = "Sunimpex"
  other name → FEBRK, fedexBroker = the name they gave

[EMAIL QUESTION — ONLY if needs_email is "true"]
"Sir, aapka email kya hai jahan yeh shipment ke documents bhejne hain?"
  → Confirm once: "[email] — sahi hai?"
  IF yes → move on
  IF customer corrects → note correction, say "noted", move on
  IF spelling confusion → NEVER spell letter-by-letter. Say:
     "Koi baat nahi Sir, hum is number par SMS bhej denge. Aap usme email reply kar dena."
  THEN move to closing.

[CLOSING — ALWAYS]
"Thank you Sir, main confirm kar doon: [one-line summary of what was collected]. Sab clear hai. Have a good day!"

--- STRICT RULES ---
1. NEVER say NFBRK, FEBRK, or any code word to customer
2. If known_clearance_type is NOT "unknown" → DO NOT ask the clearance question
3. If needs_broker is "false" → DO NOT ask the broker question
4. If needs_email is "false" → DO NOT ask for email
5. If ALL needs_* are "false" → just confirm and close (no questions needed)
6. Say full AWB as one number: "AWB 80100001" — never digit-by-digit
7. MAX 2 sentences per turn
8. NEVER spell email letter-by-letter. If confused → SMS fallback.
9. Keep total call under 90 seconds
```

**System Prompt (Hindi):**
```
आप Ayush हैं, FedEx Delhi से बोल रहे हैं।

ज्ञात जानकारी (दोबारा मत पूछो):
- Clearance Type: {known_clearance_type} — अगर "unknown" है तभी पूछो
- Broker: {known_fedex_broker} — अगर "unknown" है तभी पूछो
- Email: {known_consignee_email} — अगर "unknown" है तभी पूछो

नियम:
- "Hello Sir, Ayush bol raha hu FedEx Delhi se. Kya main {consignee_name} se baat kar raha hu?" — यही ग्रीटिंग है
- "Sir, yeh clearance aap apne CHA se karwaoge ya FedEx ke CHA se?"
- सिर्फ वही पूछो जो missing है। अगर clearance पता है तो clearance question मत पूछो।
- NFBRK/FEBRK कभी मत बोलो।
- Email letter-by-letter मत स्पेल करो।
```

### Audio Tab

| Setting | Value |
|---------|-------|
| **TTS Provider** | ElevenLabs |
| **Voice** | Nila (or any Hindi-supporting voice) |
| **STT Provider** | Deepgram |
| **STT Model** | nova-3 |
| **STT Language** | en (auto-detects Hindi) |

### LLM Tab

| Setting | Value |
|---------|-------|
| **Provider** | OpenAI |
| **Model** | gpt-4.1-mini (fast + cheap) |
| **Temperature** | 0.2 (keeps responses consistent) |
| **Max Tokens** | 150 |

### Call Tab

| Setting | Value |
|---------|-------|
| **Telephony Provider** | Plivo (or whichever you chose) |
| **Total Call Timeout** | 120 seconds |
| **Hangup on Silence** | 10 seconds |
| **Voicemail Detection** | ON |
| **Ambient Noise** | office-ambience (optional) |

### Analytics Tab

**Webhook URL:**
```
https://your-ngrok-url.ngrok-free.app/api/bolna/webhook
```

**Extractions (recommended — structured data out of the box):**
Create a category "Clearance Info" with 3 extractions:

1. **Name:** clearanceType
   **Prompt:** "What clearance type did the customer confirm? Options: NFBRK (self-handled), FEBRK-Jeena (Jeena CHA), FEBRK-Sunimpex (Sunimpex CHA), or FEBRK (other broker). Return the exact value."
   **Type:** Free Text

2. **Name:** fedexBroker
   **Prompt:** "Which broker/CHA did the customer name? Return the broker name or empty if none."
   **Type:** Free Text

3. **Name:** consigneeEmail
   **Prompt:** "What email address did the customer provide for documents? Return the full email or empty if not provided."
   **Type:** Free Text

4. Save agent → copy Agent ID from URL (looks like uuid)

### 5. Set Env Vars

In `.env.local`:
```env
BOLNA_API_KEY=<from Step 2>
BOLNA_AGENT_ID=<from Step 4>
BOLNA_PHONE_NUMBER=<from Step 3>
```

## Step 6: Start ngrok (for webhook testing)

```bash
ngrok http 3000
```

Copy the HTTPS URL. Update the webhook URL in agent Analytics tab:
```
https://your-ngrok.ngrok-free.app/api/bolna/webhook
```

## Step 7: Restart Dev Server

```bash
npm run dev
```

---

## How Context-Aware Calling Works

When the system creates a call task (via "Initiate AI Calls" button), it stores what's ALREADY KNOWN in `result_data`:

| result_data field | Source | Example |
|---|---|---|
| `known_clearance_type` | `batch_items.clearance_type` or `shipment_data.clearance_type` | `"febrk"`, `"nfbrk"`, or `"unknown"` |
| `known_fedex_broker` | `batch_items.fedex_broker` or `shipment_data.fedex_broker` | `"Jeena & Co."`, `"Sunimpex"`, or `"unknown"` |
| `known_consignee_email` | `batch_items.consignee_email` | `"customer@example.com"` or `"unknown"` |

The `missing_fields` array tracks what's STILL MISSING (e.g., `["broker"]`, `["clearance_type", "email"]`).

The `needs_*` flags are derived from `missing_fields`:
- `needs_clearance: "true"` → clearance_type is in missing_fields
- `needs_broker: "true"` → broker is in missing_fields
- `needs_email: "true"` → email is in missing_fields

### Example Scenarios

| known_clearance_type | missing_fields | What the AI asks |
|---|---|---|
| `"unknown"` | `["clearance_type", "broker", "email"]` | Clearance question → broker → email |
| `"febrk"` | `["broker"]` | Only broker (skip clearance) |
| `"febrk"` | `["broker", "email"]` | Broker → email (skip clearance) |
| `"nfbrk"` | `["email"]` | Only email (skip clearance, skip broker) |
| `"unknown"` | `["email"]` | Only email (clearance + broker not needed) |

## Quick Test (Without the Full App)

```bash
curl -X POST https://api.bolna.ai/call \
  -H "Authorization: Bearer $BOLNA_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "'$BOLNA_AGENT_ID'",
    "recipient_phone_number": "+919999999990",
    "user_data": {
      "awb": "80100001",
      "consignee_name": "Test Demo",
      "known_clearance_type": "febrk",
      "known_fedex_broker": "unknown",
      "known_consignee_email": "unknown",
      "needs_clearance": "false",
      "needs_broker": "true",
      "needs_email": "true",
      "origin": "BLR"
    }
  }'
```

Replace the phone number with your own. The AI will call you — notice it skips the clearance question because `known_clearance_type` is already `"febrk"` and goes straight to broker confirmation + email collection.
