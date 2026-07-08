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

## 5. Outbound mail transport

**Default: Power Automate.** FedEx's Entra tenant does not grant admin
consent for a custom Graph app registration (`Mail.Send` Application
permission gets rejected — "not granted for myfedex"), so the send engine
sends through a shared Power Automate flow instead of Graph directly. See
**[docs/POWER_AUTOMATE.md](POWER_AUTOMATE.md)** for the full end-to-end
setup — the service account, Exchange Send As grants, and building the
flow itself. Set `MAIL_DRIVER=power_automate` (already the default).

**Fallback: direct Microsoft Graph.** Kept fully working via
`MAIL_DRIVER=graph`, for local testing or in case tenant policy ever
changes to allow it:

1. In [Entra ID](https://entra.microsoft.com) (Azure AD), go to **App
   registrations → New registration**. Any name/redirect URI is fine (no
   redirect URI is needed for this app-only flow).
2. Copy from the app's **Overview** page:
   - `AZURE_AD_TENANT_ID` — Directory (tenant) ID
   - `AZURE_AD_CLIENT_ID` — Application (client) ID
3. Go to **Certificates & secrets → New client secret**, create one, and
   copy its value immediately into `AZURE_AD_CLIENT_SECRET` (it's not
   shown again).
4. Go to **API permissions → Add a permission → Microsoft Graph →
   Application permissions**, and add **`Mail.Send`**. Click **Grant admin
   consent** (requires a Global/Privileged Role Admin — this is the exact
   step FedEx's tenant currently blocks).
5. **Strongly recommended:** restrict the app to only the specific shared
   mailbox(es) it needs, so a leaked client secret can't send as *any*
   mailbox in the tenant. Ask your Exchange admin to run, in Exchange
   Online PowerShell:

   ```powershell
   New-ApplicationAccessPolicy `
     -AppId <AZURE_AD_CLIENT_ID> `
     -PolicyScopeGroupId <shared-mailbox-or-group-email> `
     -AccessRight RestrictAccess `
     -Description "Cargo PAF send engine"
   ```

6. In the app, add a mailbox config (via **Set up your mailbox** after
   first login) whose **operational mailbox** matches a real shared
   mailbox this app registration is scoped to send from.

***

## 6. Vercel

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

## 7. Google Gemini (unused until the next phase)

Create a key at [aistudio.google.com](https://aistudio.google.com) and
save it as `GEMINI_API_KEY` now, so it's ready when the AI classifier/
draft/OCR layer (Milestone 7+) is built in the next phase.

***

## 8. Seed data and first run

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

## 9. Verifying each milestone

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
  real emails arrive with attachments. Do this once against a real Vercel
  Preview deployment with `QUEUE_DRIVER=qstash` and `MAIL_DRIVER=
  power_automate` before considering the send engine done — the local
  `inline` driver never exercises the real QStash → webhook → Power
  Automate → callback path (see `docs/POWER_AUTOMATE.md`).
- **Case claim race (Milestone 5):** open the same case in two browser
  sessions (different seeded users), claim it in one, then attempt to
  claim it in the other — the second should get a friendly conflict
  dialog, not a silent double-claim.
