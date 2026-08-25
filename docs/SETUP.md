# Cargo PAF — Setup Guide

This covers everything needed to get Milestones 1–5 (foundation through KYC
case management) running locally and in production. Each section is
something Claude Code cannot do for you — it requires your own accounts,
your own Microsoft 365 tenant access, or a browser.

***

## 1. Local machine

```bash
nvm install 24 && nvm use 24
node -v   # should print v24.x
```

The repo pins Node 24 via `.nvmrc`; the previous local Node 18 is end-of-life.

Then install dependencies:

```bash
npm install
```

Copy the env template:

```bash
cp .env.local.example .env.local
```

You'll fill in `.env.local` as you go through the sections below.

***

## 2. Supabase

1. Create a project at [supabase.com](https://supabase.com) (pick a region
   close to your users).
2. From **Project Settings → API**, copy:
   - `NEXT_PUBLIC_SUPABASE_URL` — the Project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the `anon` public key
   - `SUPABASE_SERVICE_ROLE_KEY` — the `service_role` key (**never expose
     this to the browser**)
3. From **Project Settings → General**, copy the **Reference ID** into
   `SUPABASE_PROJECT_REF`.
4. Install the Supabase CLI (already a dev dependency) and authenticate:

   ```bash
   npx supabase login
   ```

   This opens a browser to generate a personal access token — save it as
   `SUPABASE_ACCESS_TOKEN` in `.env.local` if you want the CLI usable via
   `dotenv`, or just keep it in the CLI's own local session.

5. Link the CLI to your project and push all migrations:

   ```bash
   npx supabase link --project-ref <your-project-ref>
   npx supabase db push
   ```

   This runs every file in `supabase/migrations/` in order — the full
   schema (spec section 12 plus the `sub_batches` table and RLS policies),
   Storage buckets, and the realtime publication additions.

6. Regenerate TypeScript types whenever the schema changes:

   ```bash
   SUPABASE_PROJECT_REF=<your-project-ref> npm run db:types
   ```

No local Docker/Supabase-emulator setup is used — the CLI talks directly
to your real cloud project for both migrations and day-to-day dev.

***

## 3. Upstash Redis

1. Create a database at [console.upstash.com](https://console.upstash.com)
   (any region; REST API is enabled by default).
2. Copy the REST URL and token into `.env.local`:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

Used for: the Graph access-token cache, the short claim/send locks, and
nothing else — Postgres remains the source of truth for all business
state (spec section 14).

***

## 4. Upstash QStash

1. In the same Upstash console, open **QStash**.
2. Copy:
   - `QSTASH_TOKEN`
   - `QSTASH_CURRENT_SIGNING_KEY`
   - `QSTASH_NEXT_SIGNING_KEY`
3. Leave `QUEUE_DRIVER=inline` for local dev — QStash needs a public URL to
   call back to, which `localhost` isn't. Only set `QUEUE_DRIVER=qstash`
   in Vercel Preview/Production environment variables.

**Note:** the QStash signature-verification wrapper reads its signing keys
at module-load time, so `QSTASH_CURRENT_SIGNING_KEY` /
`QSTASH_NEXT_SIGNING_KEY` must be present even during `next build` (CI or
local), not only at runtime — placeholder values are fine for a build
that won't actually receive webhook traffic.

***

## 5. Mail transport

### 5a. SMTP (default — for Gmail / any SMTP server)

The send engine uses SMTP by default (`MAIL_DRIVER=smtp`). This works with
any SMTP provider — Gmail (via App Passwords), Outlook.com, or any
corporate SMTP relay.

**For Gmail:**

1. Enable 2-Factor Authentication on your Google Account.
2. Go to **Google Account → Security → App Passwords**.
3. Create an app password for "Mail" on "Mac" — you'll get a 16-character
   password.
4. Set in `.env.local`:
   ```
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-16-char-app-password
   SMTP_FROM=your-email@gmail.com
   MAIL_DRIVER=smtp
   ```

For other providers, set `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, and
`SMTP_PASS` accordingly.

### 5b. Microsoft Graph (for Exchange Online / prealert@fedex.com — Phase 2)

When `prealert@fedex.com` is provisioned, switch to Graph API for sending
from the shared mailbox. See **[docs/AZURE_AD_SETUP.md](AZURE_AD_SETUP.md)**
for full setup instructions.

Set `MAIL_DRIVER=graph` once the Azure AD app is configured.

***

## 6. IMAP (inbound reply polling)

The app polls a configured mailbox via IMAP every 5 minutes (via Vercel
Cron) to pick up customer replies.

**For Gmail (testing):**

1. Use the same App Password generated in section 5a above.
2. Set in `.env.local`:
   ```
   IMAP_HOST=imap.gmail.com
   IMAP_PORT=993
   IMAP_USER=your-monitoring-email@gmail.com
   IMAP_PASS=your-16-char-app-password
   ```

The monitoring mailbox should receive BCC copies of every pre-alert sent,
so customer replies to those pre-alerts can be captured.

**For Exchange Online (Phase 2):**
- IMAP is available on Exchange Online but must be enabled per mailbox.
- Alternative: use Graph API subscriptions (webhooks) instead of polling.
- See `docs/AZURE_AD_SETUP.md` for details.

***

## 7. Vercel

1. Create a project at [vercel.com](https://vercel.com), linked to this
   repo (once pushed to a git remote).
2. **Project Settings → General**: confirm the Node.js version is 24.x.
3. **Project Settings → Environment Variables**: add every variable from
   `.env.local.example`, for both Preview and Production. Set
   `QUEUE_DRIVER=qstash` and `APP_BASE_URL` to your real deployed URL
   (QStash needs a real public URL to call back to — Preview deployments
   need their own `APP_BASE_URL` too if you want to test the real queue
   path pre-production).
4. Set `CRON_SECRET` to any random string; it's the same value Vercel Cron
   sends in the `Authorization: Bearer <value>` header per `vercel.json`.

***

## 8. Google Gemini (unused until the next phase)

Create a key at [aistudio.google.com](https://aistudio.google.com) and
save it as `GEMINI_API_KEY` now, so it's ready when the AI classifier/
draft/OCR layer (Milestone 7+) is built in the next phase.

***

## 9. Seed data and first run

```bash
npm run seed
```

Creates five Supabase Auth users (one per role) and one mailbox config
(owned by the operator account), all with the password `Password123!`:

| Role | Email |
|---|---|
| admin | admin@cargopaf.test |
| lead | lead@cargopaf.test |
| operator | operator@cargopaf.test |
| reviewer | reviewer@cargopaf.test |
| viewer | viewer@cargopaf.test |

Then:

```bash
npm run dev
```

Sign in as any seeded user at `http://localhost:3000`. Accounts other than
`operator@cargopaf.test` will be routed through the mandatory mailbox
setup step on first login.

***

## 10. Verifying each milestone

- **Vitest unit tests** (Excel parsing/validation, sub-batch chunking,
  attachment matching — no external services needed):
  ```bash
  npm test
  ```
- **RLS smoke check** (requires a live Supabase project + `npm run seed`
  to have been run):
  ```bash
  npm run verify:rls
  ```
- **TIFF conversion e2e test** (requires `npm run dev` running against a
  live, seeded Supabase project):
  ```bash
  npm run test:e2e
  ```
- **Manual send test (Milestone 4):** create a small batch (5-10 rows)
  using your own email addresses as recipients, launch it, and confirm
  real emails arrive with attachments via SMTP or Graph.
- **Inbox reply test (Milestone 6):** after configuring IMAP, send a reply
  to the polling mailbox and confirm it appears in the Cases dashboard
  within 5 minutes.
- **Case claim race (Milestone 5):** open the same case in two browser
  sessions (different seeded users), claim it in one, then attempt to
  claim it in the other — the second should get a friendly conflict
  dialog, not a silent double-claim.
