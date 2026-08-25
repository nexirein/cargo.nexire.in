# Bolna AI Demo Guide — Tomorrow's Presentation

## Setup Checklist (Do Before Demo)

- [ ] Bolna account created (platform.bolna.ai)
- [ ] BOLNA_API_KEY set in .env.local
- [ ] BOLNA_AGENT_ID set (from dashboard agent)
- [ ] BOLNA_PHONE_NUMBER set (or skip for test call)
- [ ] ngrok running: `ngrok http 3000`
- [ ] Webhook URL updated in agent Analytics tab
- [ ] `npm run dev` running

---

## Test Data

Create sample Excel with 4 rows:

| AWB | Consignee | ConsigneeEmail | Contact | End Result |
|---|---|---|---|---|
| 80100001 | Test Corp | known@test.com | 9999999901 | (empty) |
| 80100002 | Demo Industries | known@demo.com | 9999999902 | CALLING |
| 80100003 | Sample Co | (empty) | 9999999903 | FEBRK-Jeena |
| 80100004 | New Company | (empty) | 9999999904 | CALLING |

---

## Demo Script (15 min total)

### Part 1: Upload → Auto-Fill (2 min)
1. Go to `/clearance-fill`
2. Upload Excel → 3 sections appear
3. Point out which got resolved from Excel/master DB, which need AI call

### Part 2: See What Needs Call (1 min)
1. Click "Need AI Call" section
2. Show **Missing Fields** column:
   - AWB-01: needs_clearance
   - AWB-02: needs_clearance + needs_broker
   - AWB-03: needs_email
   - AWB-04: needs_clearance + needs_broker + needs_email (all 3)
3. "The AI asks ONLY what's missing. Smarter than a human."

### Part 3: Initiate + Process (1 min)
1. Click **Initiate AI Calls** → shows 4 initiated
2. Click **Process Calls** → sends to Bolna
3. "Calls are queued. Let me show you one live."

### Part 4: AI Call — The Demo (5 min — WOW moment)

**Run the call via API (or Bolna dashboard Test Call):**

The AI speaks in **Hinglish** — exactly like your team would. Exact script the AI follows:

**Scenario A — Customer uses their own CHA (AWB-80100001):**

| Speaker | Dialogue |
|---------|----------|
| AI | *"Hello Sir, main FedEx India se bol raha hoon. Kya main Test Corp se baat kar raha hoon?"* |
| You | "Haan, main hoon." |
| AI | *"Aapke AWB 80100001 ke customs clearance ke liye call kiya hai. Sir, yeh clearance aap apne CHA se karwaoge ya FedEx ke CHA se karwaoge?"* |
| You | "Apne CHA se karwaoge." |
| AI | *"Thank you Sir. Aapka email kya hai jahan yeh shipment ke documents bhejne hain?"* |
| You | "info@test.com" |
| AI | *"info@test.com. Thank you Sir, main confirm kar doon: apne CHA se clearance, email info@test.com. Sab clear hai. Have a good day!"* |

**Expected result:** clearanceType = NFBRK, consigneeEmail = "info@test.com"

**Scenario B — Customer uses FedEx CHA Jeena (AWB-80100002):**

| Speaker | Dialogue |
|---------|----------|
| AI | *"...Yeh clearance aap apne CHA se karwaoge ya FedEx ke CHA se karwaoge?"* |
| You | "FedEx ke CHA se." |
| AI | *"Humare paas do CHA hai - Jeena aur Sunimpex. Aap kisse karwana chahenge?"* |
| You | "Jeena." |
| AI | *"Jeena & Co. Aapka email kya hai jahan documents bhejne hain?"* |
| You | "info@demo.com" |
| AI | *"Thank you Sir, main confirm kar doon: Jeena se clearance, email info@demo.com. Sab clear hai. Have a good day!"* |

**Expected result:** clearanceType = FEBRK-Jeena, fedexBroker = "Jeena & Co."

**Scenario C — Only email missing (AWB-80100003):**

| Speaker | Dialogue |
|---------|----------|
| AI | *"...Sir, aapka email kya hai jahan yeh shipment ke documents bhejne hain?"* |
| You | "accounts@sample.co" |
| AI | *"accounts@sample.co - sahi hai?"* |
| You | "Haan." |
| AI | *"Thank you Sir, main confirm kar doon: clearance apne CHA se, email accounts@sample.co. Sab clear hai!"* |

**Expected result:** consigneeEmail = "accounts@sample.co"

**Scenario D — Email spelling confusion (AWB-80100003 with hard name):**

| Speaker | Dialogue |
|---------|----------|
| AI | *"...Aapka email kya hai?"* |
| You | "asikder@gmail.com" |
| AI | *"asikder@gmail.com - sahi hai?"* |
| You | "Nahi, spelling: A-S-I-K-D-E-R" |
| AI | *"Noted Sir, asikder@gmail.com. Thank you!"* (does NOT spell back letter-by-letter, accepts correction and moves on) |

**If still confused — AI says:**
*"Koi baat nahi Sir, hum is number par SMS bhej denge. Aap usme email reply kar dena."*

**Scenario E — All 3 missing (AWB-80100004 — FULL TEST):**

| Speaker | Dialogue |
|---------|----------|
| AI | *"...Yeh clearance aap apne CHA se karwaoge ya FedEx ke CHA se karwaoge?"* |
| You | "FedEx ke CHA se karwao." |
| AI | *"Humare paas do CHA hai - Jeena aur Sunimpex. Aap kisse karwana chahenge?"* |
| You | "Sunimpex." |
| AI | *"Sunimpex. Aapka email kya hai jahan documents bhejne hain?"* |
| You | "info@newcompany.xyz" |
| AI | *"Thank you Sir, main confirm kar doon: Sunimpex se clearance, email info@newcompany.xyz. Sab clear hai. Have a good day!"* |

**Expected result:** clearanceType = FEBRK-Sunimpex, fedexBroker = "Sunimpex", consigneeEmail = "info@newcompany.xyz"

**One call. Three fields. 30 seconds. Hinglish. No jargon.**

### Part 5: Show Webhook Result (2 min)
1. Switch to ngrok terminal → show the POST to `/api/bolna/webhook` with status 200
2. Open Supabase → `call_tasks` table → show `status = done`, `vapi_transcript` populated
3. Open `batch_items` → show clearance_type, fedex_broker, consignee_email now filled

### Part 6: Download Enriched Excel (1 min)
1. Back in Clearance Fill page
2. Click **Download Enriched Excel**
3. "9 columns. Everything filled. Ready for pre-alert send."

---

## Key Talking Points

| Point | Say This |
|-------|----------|
| **Why Hinglish** | "Our consignees speak Hinglish. The AI speaks Hinglish. No awkward English." |
| **No jargon** | "The AI never says NFBRK or FEBRK. It asks: 'khud karte ho ya CHA?' — plain language." |
| **One call, all fields** | "Each call asks ONLY what's missing. No wasted questions." |
| **Self-learning** | "Every call updates the master DB. Next time this company appears — already known." |
| **India-first** | "Bolna is built for India. Calls work on Indian numbers. No US-only limitation." |
| **Cost** | "₹0.02/min platform fee + ₹0.02/min telephony. About ₹3-5 per call. No minimum deposit." |
| **30 days → 1 week** | "Vapi took weeks. Bolna + one guy = working in hours." |

---

## Backup Plan

| Issue | Backup |
|-------|--------|
| API key not set | Show the auto-fill + master DB demo only. Explain AI calling is the last piece. |
| Phone number not purchased | Use Bolna dashboard **Test Call** — calls YOUR phone for free |
| ngrok not working | Webhook data won't save, but call still happens. Show transcript in Bolna dashboard instead. |
| Bolna down | The auto-fill pipeline works independently. Upload → resolve → download still works without AI calling. |
