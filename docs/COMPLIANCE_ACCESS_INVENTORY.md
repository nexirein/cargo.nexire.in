# Compliance & Access Inventory — Cargo Pre-Alert Operations Platform

**Prepared for:** FedEx IT / InfoSec — access provisioning
**Source of truth:** actual code (package.json, `.env.local`, `src/lib/*`, `supabase/migrations/*`, `scripts/*`), not docs.
**Date of extraction:** 2026-08-14
**Note:** This inventory describes the system **as currently built and configured**. Planned-but-unbuilt components (Power Automate reply flows) are marked as such.

---

## 0. Runtime state at a glance

| Aspect | Current value |
|---|---|
| App framework | Next.js 16 (React 19) — `package.json` |
| Hosting | **Vercel** (personal account; `vercel.json` defines 3 cron endpoints) |
| Primary datastore | **Supabase** Postgres + Storage + Auth (personal free-tier project, ref `mkxqxeoxmpyzbxtytoyn`) |
| Mail outbound driver | `MAIL_DRIVER=smtp` → **Gmail SMTP** (demo mailbox `cargopaf.demo@gmail.com`) |
| Mail inbound | **IMAP** polling (`imap.gmail.com`, same demo mailbox) |
| Send queue driver | `QUEUE_DRIVER=inline` → **Upstash QStash creds present but inactive** |
| AI chat + embeddings | **Google Gemini** (`GEMINI_API_KEY` set) |
| Voice calls | **Bolna.ai** (`BOLNA_API_KEY` set); **Vapi.ai** legacy (creds not set, superseded). Bolna agent uses ElevenLabs TTS + Deepgram STT + OpenAI LLM as sub-providers |
| Microsoft Graph / Azure AD | Credentials **set in `.env.local` but inactive** (`MAIL_DRIVER=smtp`) |
| OpenAI | Documented in `.env.local.example`; used **only** by `scripts/label_with_llm.py` (dev-time) and as the LLM inside the Bolna voice agent; **not** called by app runtime code directly |

---

## 1. Third-party platforms / services / APIs

> **Verified-absent platforms** (searched the whole codebase, no references):
> **Sarvam AI (Bulbul v3)**, Twilio, SendGrid, Resend, Amazon SES, Anthropic,
> Azure OpenAI. The only voice-related sub-providers are ElevenLabs + Deepgram
> behind the Bolna hosted agent (`docs/BOLNA_SETUP.md`), listed below.

| Platform/Service | What it's used for in this system | What data flows through it | Current account type | What FedEx IT would need to provision | Compliance-relevant note |
|---|---|---|---|---|---|
| **Supabase** (Postgres + Auth + Storage + pgvector) — `@supabase/supabase-js`, `@supabase/ssr`, project ref `mkxqxeoxmpyzbxtytoyn` | Primary database, auth (email/password), storage buckets (`template-attachments`, `batches/{id}/original.xlsx`, `file_assets`), vector search via `match_similar_emails` RPC (`src/lib/supabase/*`, `supabase/migrations/*`) | **Everything.** AWB numbers, consignee names/emails/phones, company names, freight & DO charges (INR), currency, GST numbers, UTR/payment refs, full email bodies (in/out, `email_events`), AI drafts & classifications, call transcripts/summaries, audit logs, reply templates + attachments, training emails + embeddings (`emails` table w/ `actual_reply`), auth users | **Personal free-tier dev project** | Org-owned Supabase project (or FedEx Postgres + pgvector) in an approved region; project URL + anon key + service-role key; storage buckets; SQL migrations applied by IT/DB team | Data is customer/shipment PII. Project default region (free tier) is **US-based**, not India — data-residency review required. Service-role key bypasses RLS; used only in server route handlers |
| **Google Gemini** — `@google/generative-ai` (`src/lib/ai/gemini.ts`) | LLM chat: reply classifier verifier (`classify.ts:146`), grounded reply drafts (`draft.ts:71`), call summarizer (`summarizer.ts:33`); embeddings: `gemini-embedding-001` (1536-d) for RAG (`embed.ts`, `rag.ts`) | Customer reply **subject + body + sender**; shipment facts (AWB, consignee, DO#, broker, freight); similar historical replies (style context); raw call notes + AWB + consignee name; all text sent to Google for embedding | **Personal Google account API key** (`GEMINI_API_KEY`) | Google Cloud org project; Gemini API / Vertex AI key scoped to chat + embedding models; egress allowlist to `generativelanguage.googleapis.com` | Full customer email text + shipment financials leave FedEx infrastructure to **Google US** endpoints — DPA + residency/approval required |
| **Upstash Redis** — `@upstash/redis` (`Redis.fromEnv()`, host `glad-lamb-158604.upstash.io`) | Transient: Graph token cache (`graph/token.ts`, 55-min TTL) and distributed locks for send jobs (`redis/locks.ts`) | Access tokens (transient), lock keys. **No customer PII persisted** | **Personal dev account** | Org Upstash account in an approved region (or FedEx-native Redis) + REST URL + token | Data is ephemeral (TTL ≤ 55 min); still third-party transit of access tokens |
| **Upstash QStash** — `@upstash/qstash` (`qstash/client.ts`, `queue/enqueue-send.ts`) | Outbound send queue w/ per-mailbox flow control → `POST /api/send/webhook` (signature-verified) | Message payload is **only `{ batchItemId }`** (no PII in transit); the webhook then reads PII from Supabase | **Personal creds present but `QUEUE_DRIVER=inline`** (inactive at runtime) | Org QStash account + token + signing keys; or replace with FedEx-native queue | If enabled, message bodies are opaque IDs only — low PII exposure, but third-party transit |
| **SMTP outbound (Gmail)** — `nodemailer` (`src/lib/email/smtp.ts`), `MAIL_DRIVER=smtp` | Sends pre-alerts, replies, reminders to consignees from demo mailbox `cargopaf.demo@gmail.com` | Full outbound email content: AWB, consignee names/emails, clearance instructions, DO/bank/freight details, **attachments** (AWB copies, invoices, `.tiff`, authority letters, bank docs) | **Personal Gmail account (App Password)** — demo, not FedEx-owned | FedEx Exchange Online mailbox + SMTP relay creds, or Graph app registration (see below) | Sending from a personal Gmail is not acceptable on official infra; must move to FedEx mailbox |
| **IMAP inbound** — `imapflow` + `mailparser` (`src/lib/email/imap.ts`) | Polls demo mailbox INBOX for unseen customer replies (`/api/inbox/poll` cron, 1-min) | **Full customer reply bodies** (subject, from/to/cc, body text+HTML, `inReplyTo`, references), marks `\Seen` | **Personal Gmail account** | FedEx shared mailbox + IMAP creds (or Graph `Mail.Read`) for the same mailbox that receives replies | Reads complete customer email PII; must point at the FedEx operational mailbox |
| **Microsoft Graph / Azure AD** — `@azure/msal-node` (`src/lib/graph/token.ts`, `send-mail.ts`) | Outbound mail via Exchange Online (draft→attach→send, app-only client-credentials token) | Would carry full email content + attachments from a FedEx mailbox; token cached in Redis | **Creds set in `.env.local` (personal MS dev tenant), path inactive** (`MAIL_DRIVER=smtp`) | Azure AD app registration in FedEx tenant: client ID/secret, tenant ID, app-only `Mail.Send` + `Mail.Read` (or `Mail.ReadWrite`) scoped to the operational mailbox | The documented "official" path to a `prealert@fedex.com` mailbox; requires FedEx Azure AD admin approval |
| **Bolna.ai** — `https://api.bolna.ai` (`src/lib/bolna/start-call.ts`, `src/app/api/bolna/webhook/route.ts`) | AI voice calls to consignees to capture missing clearance info (clearance type, broker, email); webhook ingests transcripts | **AWB, consignee name, customer phone number**, `BOLNA_PHONE_NUMBER` (from-number), full shipment row (freight, currency, origin, pieces, weight, shipper, agent, date, destination); call transcripts back via webhook (IP whitelist `13.203.39.153`) | **Personal/development Bolna account** | FedEx-approved voice platform (Bolna org workspace: agent + API key + phone number) with transcript webhook + allowlist | Phone numbers + spoken shipment data transit to Bolna (API egress is AWS **Mumbai/ap-south-1**); DPA for India telephony PII. **Sub-processors behind the hosted agent** (per `docs/BOLNA_SETUP.md`): ElevenLabs TTS, Deepgram STT (nova-3), OpenAI LLM (gpt-4.1-mini) |
| **ElevenLabs** (TTS, **indirect sub-processor of Bolna** — not called by app code) | Text-to-speech voice on Bolna-hosted calls (voice "Nila", Hindi-supporting) per `docs/BOLNA_SETUP.md` Audio tab | The **spoken audio** of consignee calls (which contains shipment info read aloud: AWB, consignee, charges) is generated by/through ElevenLabs | **No direct account — mediated by Bolna** | If the Bolna agent stays on ElevenLabs, IT must approve ElevenLabs as a sub-processor (or switch TTS) | Audio of customer calls (incl. spoken financials) processed by a third party; needs sub-processor approval |
| **Deepgram** (STT, **indirect sub-processor of Bolna** — not called by app code) | Speech-to-text on Bolna-hosted calls (model nova-3, en/Hindi) per `docs/BOLNA_SETUP.md` Audio tab | **Full call audio transcribed to text** (customer names, AWB, clearance answers, Hinglish speech) and returned to the app as transcripts | **No direct account — mediated by Bolna** | Approve Deepgram as a sub-processor (or switch STT) | Transcripts persist in the app (`call_tasks`/`ai` tables) — transcription of India phone calls is PII; DPA required |
| **Sarvam AI (Bulbul v3 TTS/STT)** — *named in this request* | **NOT PRESENT.** Zero references in code, `package.json`, or `.env.local` — no TTS/STT/websocket integration. The voice stack is Bolna, which uses ElevenLabs/Deepgram/OpenAI (above), not Sarvam | — | N/A | If IT/ops wants Sarvam Bulbul for Hindi TTS/STT, it would be a **new integration** (Sarvam org account + API key + model config) — nothing to provision today | India-based TTS/STT provider would actually improve data residency vs ElevenLabs/Deepgram, but it is **not wired in** |
| **Vapi.ai** — `https://api.vapi.ai` (`src/lib/vapi/*`, `src/app/api/vapi/webhook/route.ts`) | **Legacy** voice provider (superseded by Bolna). Sends same call data; assistant uses hosted OpenAI GPT-4 + ElevenLabs voice (`create-assistant.ts`) | AWB, consignee name, phone, shipment data; call transcripts via HMAC-signed webhook (`VAPI_WEBHOOK_SECRET`) | **Not configured** (`VAPI_*` not in `.env.local`) | None — retire/deprovision | If ever enabled it adds OpenAI + ElevenLabs as sub-processors |
| **OpenAI** — `scripts/label_with_llm.py` only | Dev-time LLM labeling of training emails (GPT-4o-mini) to enrich `cleaned_emails.csv` | Cleaned customer reply subject+body sent to OpenAI during offline labeling | **Not configured in `.env.local`; not used at runtime** | If labeling is kept: org OpenAI key with data-retention controls | Training-time only; full email text to OpenAI (US) — review if FedEx data is labeled |
| **Vercel** — hosting + crons (`vercel.json`: `/api/cron/requeue-stalled` 10-min, `/api/inbox/poll` 1-min, `/api/cron/process-reminders` 15-min) | Runs the Next.js app + serverless functions + scheduled jobs | All app PII transits serverless functions in memory; Vercel build/function **logs** may capture `console.warn`/`console.error` output | **Personal Vercel account** | FedEx-approved hosting (Vercel org or AWS India) + secrets injection + cron registration | Function logs can retain PII in error paths; default Vercel region is **us-east-1** — residency review needed |
| **Power Automate (planned, NOT built)** — see `docs/POWER_AUTOMATE_BLUEPRINT.md` | Planned: `PA_ReplyIntake` pushes shared-mailbox replies to `POST /api/pa/inbox/ingest`; `PA_ReplySend` sends via Outlook. **No `/api/pa/*` code exists yet** | Would flow full reply bodies + send job payloads between Outlook and the app | N/A (design only) | Power Automate environment + shared mailbox connection + `PA_API_KEY` + env vars | Ensure app-to-PA calls use a stored secret, not personal creds |

---

## 2. Environment variables / secrets required (grouped by service)

All values live in `.env.local` (gitignored). `.env.local.example` documents the canonical set.

### Supabase
| Variable | Set in `.env.local`? |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes |
| `SUPABASE_SERVICE_ROLE_KEY` (server-only, bypasses RLS) | yes |
| `SUPABASE_PROJECT_REF` (CLI only) | yes |
| `SUPABASE_ACCESS_TOKEN` (CLI only) | yes |

### Upstash Redis
| Variable | Set? |
|---|---|
| `UPSTASH_REDIS_REST_URL` | yes |
| `UPSTASH_REDIS_REST_TOKEN` | yes |

### Upstash QStash (creds present, `QUEUE_DRIVER=inline` = inactive)
| Variable | Set? |
|---|---|
| `QSTASH_TOKEN` | yes |
| `QSTASH_CURRENT_SIGNING_KEY` | yes |
| `QSTASH_NEXT_SIGNING_KEY` | yes |
| `QSTASH_URL` | yes (extra, not referenced by code) |

### Google Gemini
| Variable | Set? |
|---|---|
| `GEMINI_API_KEY` | yes |
| `GEMINI_MODEL` (defaults to `gemini-2.5-flash` in code) | no |

### SMTP outbound (Gmail)
| Variable | Set? |
|---|---|
| `MAIL_DRIVER` (`smtp`) | yes |
| `SMTP_HOST` | yes |
| `SMTP_PORT` | yes |
| `SMTP_USER` | yes |
| `SMTP_PASS` (App Password) | yes |
| `SMTP_FROM` | yes |

### IMAP inbound (Gmail)
| Variable | Set? |
|---|---|
| `IMAP_HOST` | yes |
| `IMAP_PORT` | yes |
| `IMAP_USER` | yes |
| `IMAP_PASS` | yes |

### Microsoft Graph / Azure AD (set but inactive)
| Variable | Set? |
|---|---|
| `AZURE_AD_TENANT_ID` | yes |
| `AZURE_AD_CLIENT_ID` | yes |
| `AZURE_AD_CLIENT_SECRET` | yes |

### Bolna
| Variable | Set? |
|---|---|
| `BOLNA_API_KEY` | yes |
| `BOLNA_AGENT_ID` | yes |
| `BOLNA_PHONE_NUMBER` | yes |

### Vapi (legacy — not set, not active)
| Variable | Set? |
|---|---|
| `VAPI_API_KEY` | no |
| `VAPI_ASSISTANT_ID` | no |
| `VAPI_WEBHOOK_SECRET` | no |

### App / ops
| Variable | Set? |
|---|---|
| `APP_BASE_URL` (public URL for QStash/webhooks) | yes |
| `CRON_SECRET` (Bearer guard on cron + reminder endpoints) | yes |
| `QUEUE_DRIVER` (`inline` / `qstash`) | yes (`inline`) |

### OpenAI (dev scripts only — not in app runtime)
| Variable | Set? |
|---|---|
| `OPENAI_API_KEY` (used by `scripts/label_with_llm.py`) | no |

---

## 3. Where customer / shipment data is persisted today

| Store | What's stored | Where it lives (physically/logically) |
|---|---|---|
| **Supabase Postgres** (ref `mkxqxeoxmpyzbxtytoyn`) | `awb_cases`, `batch_items` (AWB, consignee name/email, contact/customer phone, `shipment_data` JSON: freight, currency, origin, pieces, weight, shipper), `email_events` (full inbound/outbound email bodies, headers, `inReplyTo`/`references`), `ai_drafts`, `ai_classifications`, `call_tasks` (phone + transcripts), `case_updates`, `case_assignments`, `reminder_jobs`, `followup_schedules`, `audit_logs`, `templates` + template content/embeddings, `company_clearance_master` (company name, email, phone, clearance type, broker), `broker_master`, `emails` (training emails: `body_clean`, `actual_reply`, `embedding`), `app_config`, `inference_log`, `correction_log`, `retraining_jobs`, Supabase Auth users | Hosted Supabase (US-region default free tier) — **outside India** |
| **Supabase Storage buckets** | `template-attachments` (template files), `batches/{batchRunId}/original.xlsx` (uploaded pre-alert sheets), `file_assets` (attachment content; also duplicated into `file_assets.content` column — `supabase/migrations/0039_file_content.sql`) | Same hosted Supabase project |
| **pgvector embeddings** | `emails.embedding` (1536-d), `templates.embedding` — vectors of customer reply text | In Supabase Postgres (same project) |
| **Upstash Redis** (`glad-lamb-158604.upstash.io`) | Transient Graph access token (55-min TTL), send-job lock keys | Upstash managed Redis (default region US) — **no customer PII** |
| **Vercel** | Serverless function execution + build/runtime logs (may capture `console.*` output); `.next` build cache | Vercel (default region US) |
| **Local dev / workstations** | `.env.local` (all secrets), `.next/`, `tsconfig.tsbuildinfo`, `scripts/` outputs (`email_extract.csv` written to desktop per `outlook_awb_extractor.bas`), `test-fixtures/` (generated) | Developer machines / repo working dir |
| **Repo itself** | Real FedEx operational data — see section 4 | Git repo (see `.gitignore`: `.env*` excluded, `Template/` NOT excluded) |

---

## 4. Data seeded from FedEx's own historical exports (flag — operational data, not synthetic)

These are **real FedEx operational artifacts** committed to the repository and/or produced by repo tooling:

1. **`Template/FEBRK/**`** — real `.eml` email exports with real AWBs and consignees:
   - `870101768551` (AMANDEEP KAUR GILL — PERSONAL BELONGING)
   - `872875613442` (SHUBH MANGAL MINERALS, freight 311.98 CNY)
   - `873919857814` (MARUTI SUZUKI INDIA LTD.)
   - FEBRK-DDP / FEBRK-DDU pre-alert templates (Sunimpex + Jeena variants)
2. **`Template/POST/**`** — real pre-alert/reminder/IGM mail templates, plus:
   - `873061695337.tif` (real shipment attachment)
   - `TP hold.md` — real TP-hold list containing **40+ real AWBs** with origin/destination, piece counts, arrival dates, hold reasons
   - FedEx internal reference docs: `csnt26-2017.pdf`, `gatt & import declaration (1).pdf`, `know-your-customer.pdf`, `AUTHORITY LETTER FOR AIR CLRNS JFS CCU.doc`, `Celebi Tariff Sheet`, `1323932251_Circular-No-08-2021.pdf`, `BANK DETAILS.docx`, `DO FORMAT.docx`
3. **`Template/NFBRK/**`** — NFBRK pre-alert body + `BANK DETAILS.docx`, `DO FORMAT.docx`, tariff/circular PDFs.
4. **`scripts/awb_email_finder.bas`** and **`scripts/outlook_awb_extractor.bas`** — extract **real emails from the team's Outlook mailboxes** by AWB (Inbox + Sent Items) into `email_extract.csv` with full bodies.
5. **`docs/training-data/TRAINING_DATA_COLLECTION.md`** — instructs the team to export 2 weeks of **real replies from the shared mailbox** ("Ravi's Reply Export") for labeling.
6. **`emails` table** (via `scripts/embed_and_store.py` + `scripts/label_with_llm.py`) — seeded from the above real exports; stores `body_clean` + `actual_reply` + embeddings of **real customer emails**.
7. **Demo/test data in the DB** — demo cases use test mailboxes (`cargopaf.demo@gmail.com`, `cargopaf.monitor@gmail.com`) and test consignee senders (`test1alstom@gmail.com`, `bs9932338847@gmail.com`, `cutq2024@gmail.com`, `sikder32bipul@gmail.com`, `nexire.in@gmail.com`, `ceo@company.com`) — these are synthetic/demo, not real FedEx exports.

> **Compliance flag:** items 1–6 are FedEx-owned operational data (AWBs, consignee PII, internal documents, mailbox exports) committed to the source repo and/or processed into the Supabase `emails` training table. IT/InfoSec should review repo access control and the `emails` vector store before anything is exposed to third-party AI endpoints.

---

## 5. Summary — minimal provisioning list for a fully FedEx-owned run

If FedEx approved this today, the minimum set of accounts/credentials/servers IT would need to create so nothing points at a personal account:

1. **Datastore** — one **Supabase project (org-owned)** in an approved region (ideally India/ap-south-1): project URL, anon key, service-role key, storage buckets (`template-attachments`, `batches`, `file_assets`), and the 46 SQL migrations applied. *(Alternative: FedEx-managed Postgres + pgvector + S3-compatible storage, with the two Supabase client keys replaced by managed credentials.)*
2. **LLM** — one **Google Cloud org project** enabling Gemini: API key for `gemini-2.5-flash` (chat) and `gemini-embedding-001` (1536-d embeddings), plus egress allowlist and DPA for customer text.
3. **Email** — the **FedEx operational shared mailbox** (where replies land): either (a) **Azure AD app registration** (app-only `Mail.Send` + `Mail.Read`) with tenant/client ID/secret, or (b) **SMTP/IMAP credentials for that mailbox** — replacing the personal Gmail `cargopaf.demo@gmail.com` in `SMTP_*`/`IMAP_*`; set `MAIL_DRIVER=graph` if using option (a). If the planned Power Automate path is used instead: a **Power Automate environment + mailbox connection + `PA_API_KEY`**.
4. **Voice** — one **Bolna org workspace**: agent ID, API key, phone number, and webhook allowlist for the transcript endpoint. Approve/swap the **ElevenLabs (TTS), Deepgram (STT), and OpenAI (LLM)** sub-processors behind the Bolna agent (or switch to an India-hosted stack such as Sarvam Bulbul, which is **not yet integrated**).
5. **Queue + cache (optional, only if `QUEUE_DRIVER=qstash`)** — **Upstash Redis + QStash org accounts** in an approved region (token + signing keys) — or replace with FedEx-native equivalents.
6. **Hosting** — replace personal **Vercel** with an org Vercel project or AWS India deployment, and re-register the 3 cron endpoints.
7. **Secrets** — store every variable from §2 in the FedEx secrets manager (AWS Secrets Manager / Azure Key Vault) and inject at deploy; rotate all currently-committed-adjacent personal keys.
8. **People/approvals** — Supabase/Postgres DB admin, Azure AD admin (Graph app), Google Cloud IAM, Power Platform admin, and sign-off that customer email text, phone numbers, and shipment financials may transit Gemini (US) and Bolna (Mumbai).
