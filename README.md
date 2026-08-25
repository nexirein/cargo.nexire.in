# Cargo PAF — FedEx Pre-Alert + Follow-up Operations

An operations web app that replaces an Excel + Outlook pre-alert workflow:
batch-upload shipment sheets, convert scanned TIFF invoices to PDF entirely
in the browser, send pre-alerts through a queued pipeline (SMTP or Graph
API), ingest customer replies via IMAP polling, and manage AWB-level
follow-up ownership with KYC-style claim/assign/release semantics.

This build covers Milestones 1–6 of `docs/fedex_prealert_followup_claude_spec.md`
(foundation, batch upload, TIFF conversion, send engine, case management,
inbox ingestion). The AI decision layer and reminders remain a planned
follow-up phase.

## Getting started

See **[docs/SETUP.md](docs/SETUP.md)** for the full setup guide (Supabase,
Upstash, SMTP/IMAP, Vercel, seeding). Short version once everything there
is configured:

```bash
nvm use 24
npm install
cp .env.local.example .env.local   # fill in values per docs/SETUP.md
npx supabase link --project-ref <ref> && npx supabase db push
npm run seed
npm run dev
```

## Stack

Next.js 16 (App Router, Turbopack) · TypeScript · Tailwind CSS + shadcn/ui ·
Supabase (Auth, Postgres, Storage, Realtime) · Upstash Redis + QStash ·
SMTP (nodemailer) with Microsoft Graph API (`@azure/msal-node`) as an
upgrade path · `utif2` + `pdf-lib` for client-side TIFF→PDF ·
TanStack Query · Vitest + Playwright.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm run seed` | Create the 5 seeded role accounts + a sample mailbox |
| `npm test` | Vitest unit tests (pure logic, no external services) |
| `npm run test:e2e` | Playwright e2e test for the TIFF conversion pipeline |
| `npm run verify:rls` | RLS smoke check against a live Supabase project |
| `npm run db:types` | Regenerate `src/lib/db/database.types.ts` from the live schema |
