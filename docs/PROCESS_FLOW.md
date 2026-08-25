# Clearance Fill — Process Flow

## Before (Manual — How Teammates Do It Now)

```
Pre-alert Excel arrives (50-100+ rows)
         │
         ▼
  Teammate opens Excel
         │
         ├── Knows company from memory? ──Yes──► Type NFBRK/FEBRK directly
         │
         └── No ──► Opens Outlook
                      │
                      ├── Searches email history manually
                      │   (types company name in search bar,
                      │    scrolls through results)
                      │
                      └── Can't find? ──► Calls or emails consignee
                                           │
                                           ├── "Clearance apne CHA se
                                           │    karwaoge ya FedEx wale se?"
                                           │
                                           ├── Own CHA ──► NFBRK
                                           │
                                           └── FedEx CHA ──► "Jeena ya Sunimpex?"
                                                              ├── Jeena ──► FEBRK-Jeena
                                                              └── Sunimpex ──► FEBRK-Sunimpex
                                           │
                                           └── Types result into Excel
         │
         ▼
  Takes 2-4 hours for a full sheet
  Repetitive, error-prone, depends on memory
```

**Problems with old process:**
- Manual Outlook search takes ~1-2 min per company × 100 rows = 2-3 hours
- Calling every unknown company eats another hour
- New joinees have no history/memory → call almost everyone
- Fatigued teammates make typos (FEBRK-Jeena vs FEBRK-Sunimpex mix-ups)
- No audit trail — who decided what and why?
- Sheet doesn't finish same day → shipment delays

---

## After (Automated — Clearance Fill Platform)

```
Pre-alert Excel arrives (50-100+ rows)
         │
         ├──► STEP 1: VBA OUTLOOK SCANNER (10 sec)
         │     Runs DetectClearanceTypes macro
         │     Scans ALL folders with weighted confidence scoring
         │     Fills confirmed FEBRK-Jeena / FEBRK-Sunimpex / NFBRK
         │     Leaves blanks for uncertain ones
         │     └── Output: Excel with ~30-50% pre-filled
         │
         ├──► STEP 2: MASTER DB MATCH (auto, instant)
         │     Web platform matches each company against 36K master DB
         │     Fuzzy matching handles spelling variations
         │     Fills clearance type + broker from historical data
         │     └── Output: ~50-70% filled total
         │
         ├──► STEP 3: 3-CHAIN AUTO-FILL (auto, instant)
         │     Checks multiple chains (AWB tracking, previous bookings, etc.)
         │     Any chain that confirms clearance type fills the gap
         │     └── Output: ~70-85% filled total
         │
         ├──► STEP 4: AI VOICE CALLING (Bolna.ai, ~1 min per call)
         │     Remaining ~15-30% → initiated as call tasks
         │     AI calls consignee in Hinglish:
         │       "Namaste, FedEx India se bol rahe hain..."
         │       "Yeh clearance apne CHA se karwaoge ya FedEx ke CHA se?"
         │       (If FedEx CHA) "Jeena ya Sunimpex?"
         │     Webhook captures transcript + extractions
         │     Updates batch_items + master DB in real-time
         │     └── Output: ~95-100% filled
         │
         └──► STEP 5: EXCEPTION REVIEW (5 min)
               Remaining 0-5% reviewed by teammate
               Edge cases: bounced numbers, wrong numbers, ambiguous answers
               └── Output: 100% complete
```

**Time comparison:**

| Step | Before (Manual) | After (Automated) |
|---|---|---|
| Outlook search | 2-3 hours | 10 seconds (VBA) |
| Memory/DB lookup | N/A (no DB) | Instant (36K master) |
| Cross-referencing | N/A | Instant (3-chain) |
| Calling unknowns | 1 hour (manual calls) | ~1 min/call (AI auto) |
| Exception review | N/A | ~5 min |
| **Total** | **3-4 hours** | **~10-30 min** |

---

## File-by-File Flow

```
                    ┌──────────────────────────────┐
                    │  Pre-alert Excel (Portal)     │
                    │  27 columns, 50-100 rows      │
                    └──────────┬───────────────────┘
                               │ Upload to platform
                               ▼
                    ┌──────────────────────────────┐
                    │  Clearance Fill Batch Page    │
                    │  /clearance-fill/[batch-id]   │
                    │  Shows all shipments + status │
                    └──────────┬───────────────────┘
                               │
             ┌─────────────────┼─────────────────┐
             ▼                 ▼                  ▼
  ┌──────────────────┐ ┌──────────────┐ ┌────────────────┐
  │ VBA Macro        │ │ Master DB    │ │ 3-Chain Fill   │
  │ (Outlook scan)   │ │ (36K fuzzy)  │ │ (AWB tracking) │
  │ clearance_type_  │ │ auto-match   │ │ auto-match     │
  │ detector.bas     │ │              │ │                │
  └────────┬─────────┘ └──────┬───────┘ └───────┬────────┘
           │                  │                  │
           └──────────────────┼──────────────────┘
                              │ Still blank? → initiate call
                              ▼
                   ┌─────────────────────┐
                   │ initiate-calls/     │
                   │ route.ts            │
                   │ Creates call_tasks  │
                   │ with shipment_data  │
                   └────────┬────────────┘
                            │
                            ▼
                   ┌─────────────────────┐
                   │ process-calls/      │
                   │ route.ts            │
                   │ Calls Bolna API     │
                   │ start-call.ts       │
                   └────────┬────────────┘
                            │
                            ▼
                   ┌─────────────────────┐
                   │ Bolna.ai            │
                   │ AI voice call       │
                   │ (Hinglish)          │
                   └────────┬────────────┘
                            │ Call complete
                            ▼
                   ┌─────────────────────┐
                   │ Bolna Webhook       │
                   │ /api/bolna/webhook  │
                   │ Parses transcript   │
                   │ Updates DB          │
                   └────────┬────────────┘
                            │
                            ▼
                   ┌─────────────────────┐
                   │ DB Updated          │
                   │ call_tasks.status   │
                   │ batch_items.clearance│
                   │ master.companies    │
                   └─────────────────────┘
```

---

## What Each File Owns

| File | Job |
|---|---|
| `scripts/clearance_type_detector.bas` | Outlook scan → FEBRK/NFBRK detection via weighted confidence |
| `src/app/api/clearance-fill/[id]/initiate-calls/route.ts` | Create call_tasks for remaining blank rows |
| `src/app/api/clearance-fill/[id]/process-calls/route.ts` | Pick pending call → start Bolna call |
| `src/lib/bolna/start-call.ts` | POST to Bolna API with agent_id + phone + user_data |
| `src/app/api/bolna/webhook/route.ts` | Receive execution data → parse → update DB |
| Web platform (portal page) | Upload, batch view, 3-chain fill, manual override |

---

## Rolеs

| Who | Does what |
|---|---|
| **Teammate** | Uploads Excel → runs VBA macro (10 sec) → reviews exceptions (5 min) |
| **VBA Script** | Scans Outlook with weighted scoring → writes confirmed matches |
| **Web Platform** | Master DB fuzzy match + 3-chain auto-fill → remaining → queue calls |
| **Bolna AI** | Calls consignees in Hinglish → asks clearance preference → extracts answer |
| **Webhook** | Captures AI response → updates batch + master DB automatically |
