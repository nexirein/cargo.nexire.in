# Vapi AI Calling — Setup Guide

## What We're Setting Up

Vapi is the AI voice agent that calls consignees to ask about missing clearance info. The flow:

```
Clearance Fill upload → 3-chain auto-fill → items still missing fields 
→ Vapi AI calls consignee → asks "self vs CHA?" + "which broker?" + "email?"
→ structured data returned → master DB updated → item resolved
```

## Prerequisites

- A Vapi account (free to create, $0 needed for test mode)
- Your local `.env.local` with `VAPI_API_KEY` and `VAPI_ASSISTANT_ID` (already have partial values — we'll verify/replace)
- ngrok (for local webhook testing) — install via `brew install ngrok`

## Current Env State

Your `.env.local` already has these lines — we'll verify if they work:

```env
VAPI_API_KEY=56bf9e4c-a1cc-41b8-b161-af70a1821ff5
VAPI_ASSISTANT_ID=dbe318ca-2682-47d9-ae8d-37cd84ce4c8d
```

If the assistant ID is from a previous test or invalid, we'll create a new one.

---

## Step 1: Create a Vapi Account

1. Go to https://dashboard.vapi.ai
2. Sign up with your email (use your work email)
3. Verify your email
4. No deposit needed yet — test mode is free

## Step 2: Get Your API Key

1. In Vapi dashboard, go to **Settings → API Keys**
2. Click **Create API Key**
3. Copy the key (looks like `56bf9e4c-...`)
4. Paste it into `.env.local`:
   ```
   VAPI_API_KEY=<paste-your-real-key-here>
   ```

### Verify existing key
Run this to check if the current key/assistant ID are valid:

```bash
curl -H "Authorization: Bearer 56bf9e4c-a1cc-41b8-b161-af70a1821ff5" https://api.vapi.ai/assistant/dbe318ca-2682-47d9-ae8d-37cd84ce4c8d
```

If you get `404` or `401`, the ID/key are stale — proceed to create a new assistant.

## Step 3: Create the Assistant

### Option A: Via Dashboard (recommended for first time — visual)

1. Go to **Assistants** → **Create Assistant**
2. Choose **Custom** template
3. Fill in:

| Field | Value |
|-------|-------|
| **Name** | FedEx Clearance Agent |
| **Model** | OpenAI → GPT-4 |
| **Temperature** | 0.7 |
| **Voice** | 11labs → Rachel (`21m00Tcm4TlvDq8ikWAM`) |
| **First Message** | `Hello, this is calling from FedEx India. Am I speaking with {consignee_name}?` |

4. **System Prompt** — copy-paste from `src/lib/vapi/create-assistant.ts` lines 3-46 (the `SYSTEM_PROMPT` constant). Key behavior:
   - Never says "NFBRK" or "FEBRK" to customers
   - Asks: "Do you handle customs clearance yourself, or does a CHA handle it?"
   - Self → NFBRK, CHA → FEBRK, then asks which broker
   - Collects email if missing
   - Outputs structuredData with clearanceType, fedexBroker, consigneeEmail

5. **Variables** — add ALL of these exactly:

| Variable | Required |
|----------|----------|
| `awb` | Yes |
| `consignee_name` | Yes |
| `clearance_type` | Yes |
| `needs_clearance` | No |
| `needs_broker` | No |
| `needs_email` | No |
| `origin` | No |
| `pieces` | No |
| `weight` | No |
| `freight` | No |
| `currency` | No |
| `shipper` | No |

6. Click **Save**
7. Copy the **Assistant ID** from the URL (looks like `dbe318ca-2682-47d9-ae8d-37cd84ce4c8d`) or from the page header
8. Paste it into `.env.local`:
   ```
   VAPI_ASSISTANT_ID=<copied-id>
   ```

### Option B: Via Code (faster if API key works)

Just run this from the project root:

```bash
npx tsx -e "
import { createFedExAssistant } from './src/lib/vapi/create-assistant';
createFedExAssistant().then(a => {
  console.log('Assistant ID:', a.id);
  process.exit(0);
}).catch(e => {
  console.error('Failed:', e.message);
  process.exit(1);
});
"
```

Copy the returned ID into `.env.local` as `VAPI_ASSISTANT_ID`.

## Step 4: Set Up Webhook (For Processing Call Results)

The webhook is how Vapi tells our system what the customer said. Without it, calls complete but data doesn't save.

### 4a. Create a webhook secret

Pick any random string (e.g. `my-webhook-secret-2024`) and add to `.env.local`:

```env
VAPI_WEBHOOK_SECRET=my-webhook-secret-2024
```

### 4b. Start ngrok (expose localhost to internet)

```bash
ngrok http 3000
```

Copy the HTTPS URL (looks like `https://abc123.ngrok-free.app`).

### 4c. Set webhook in Vapi dashboard

1. Go to **Assistants → FedEx Clearance Agent → Settings**
2. Find **Server** section
3. Set:
   - **Server URL:** `https://your-ngrok-url.ngrok-free.app/api/vapi/webhook`
   - **Server Secret:** `my-webhook-secret-2024` (same as above)
4. Click **Save**

OR use the API:

```bash
curl -X PATCH https://api.vapi.ai/assistant/$VAPI_ASSISTANT_ID \
  -H "Authorization: Bearer $VAPI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "server": {
      "url": "https://your-ngrok-url.ngrok-free.app/api/vapi/webhook",
      "secret": "my-webhook-secret-2024"
    }
  }'
```

## Step 5: Restart Your Dev Server

```bash
# Kill existing, restart to pick up new env vars
npm run dev
```

Verify env vars are loaded by checking the health endpoint or just proceed to test.

---

## Step 6: Test the Complete Flow (Without Buying a Phone)

You don't need to buy a phone number for test calls. Vapi's **Test Call** feature dials YOUR phone.

### 6a. Quick Test via Dashboard

1. Go to **Assistants → FedEx Clearance Agent → Test**
2. Click **Test Call**
3. Enter your own phone number (with country code, e.g. `+919999999901`)
4. Click **Call**
5. Your phone rings — answer and play the consignee role
6. Say something like: "I handle clearance myself, my email is test@test.com"
7. After call ends, check **Call Logs** → click the call → see transcript + structuredData

### 6b. Test via the Clearance Fill UI (Full End-to-End)

1. Go to `/clearance-fill` in your browser
2. Upload the sample Excel (create one with 1-2 rows where End Result is empty)
3. Wait for auto-fill to finish
4. See the item appear in "Need AI Call" section
5. Click **Initiate AI Calls** → **Process Calls**
6. This creates a `call_tasks` record with status `pending`
7. In Vapi dashboard → **Test Call** button → use the same variables as the call task
8. After call completes → Vapi sends webhook → your ngrok receives it → `call_tasks` updates to `done` → `batch_items` gets resolved fields

### 6c. Test Variables to Send

When testing from Vapi dashboard, use these variable values:

```json
{
  "awb": "80100001",
  "consignee_name": "Test Corp",
  "clearance_type": "clearance_enrichment",
  "needs_clearance": "true",
  "needs_broker": "true",
  "needs_email": "true",
  "origin": "BLR",
  "pieces": "5",
  "weight": "100",
  "freight": "500",
  "currency": "USD",
  "shipper": "FedEx"
}
```

---

## Step 7: Verify Webhook Works

After a test call completes:

1. Check your ngrok terminal — should show `POST /api/vapi/webhook` with status `200`
2. Check Supabase → `call_tasks` table — the row should have:
   - `status = "done"`
   - `vapi_call_id` populated
   - `vapi_transcript` populated with conversation text
   - `result_data` JSON with clearanceType, fedexBroker, consigneeEmail
3. Check `batch_items` — the corresponding item should now have `clearance_type`, `fedex_broker`, `consignee_email` filled
4. Check `company_clearance_master` — new entry added

If webhook fails (ngrok shows non-200):
- Check `.env.local` has `VAPI_WEBHOOK_SECRET` set
- Check the secret matches what's in Vapi dashboard Server config
- Check `APP_BASE_URL` in `.env.local` is set to your ngrok URL

---

## What Each Env Var Does

| Env Var | Where to Get It | Purpose |
|---------|----------------|---------|
| `VAPI_API_KEY` | Vapi Dashboard → Settings → API Keys | Authenticates all Vapi API calls |
| `VAPI_ASSISTANT_ID` | Created in Step 3 | Identifies which AI assistant to use |
| `VAPI_WEBHOOK_SECRET` | You choose any string | Verifies webhook calls are really from Vapi |

---

## Files That Use Vapi

| File | What It Does |
|------|-------------|
| `src/lib/vapi/create-assistant.ts` | Assistant definition + prompt (updated to use CHA language) |
| `src/lib/vapi/start-call.ts` | Sends call request to Vapi with variables per item |
| `src/app/api/clearance-fill/[id]/initiate-calls/route.ts` | Creates `call_tasks` for items needing calls |
| `src/app/api/clearance-fill/[id]/process-calls/route.ts` | Triggers Vapi calls for pending tasks |
| `src/app/api/vapi/webhook/route.ts` | Receives results → updates batch_items + master DB |

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Vapi returns `401` | API key is wrong/invalid — generate a new one |
| Vapi returns `404` for assistant ID | Assistant was deleted — create a new one |
| Call connects but agent says nothing | Check firstMessage uses correct variable syntax `{var_name}` |
| Variables not being passed | Assistant config must have ALL variables defined (even optional ones) |
| Webhook returns `403` | Server secret mismatch or missing `VAPI_WEBHOOK_SECRET` |
| Webhook returns `500` | Check server logs — likely missing `callTaskId` in metadata |
| Call completes but no structuredData | Update assistant config to enable `analysis.structuredData` |
| ngrok not working | Run `ngrok http 3000` (make sure port 3000 is your Next.js server) |
| "You don't have enough credits" | Add $20 minimum deposit in Vapi Billing |
