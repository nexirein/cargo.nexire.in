# Power Automate — outbound mail flow

Cargo PAF sends pre-alert emails through a single, shared Power Automate
flow instead of calling Microsoft Graph directly. This is not a
stylistic choice — FedEx's Entra tenant ("myfedex") does not grant admin
consent for a custom Azure AD app registration with `Mail.Send`
Application permission ("not granted for myfedex"). Power Automate is
allowed because it runs under Microsoft's own Power Platform governance
(licensed connectors + admin-managed policies), not a new app needing its
own tenant-wide consent grant.

**This flow is built once, centrally — not per team.** Every team's
"which mailbox do I send from" setting already lives in our app
(`/setup/mailbox`, the `mailbox_configs` table). The flow just needs
permission to send *as* whichever mailbox our app tells it to, for every
team that ever onboards. Onboarding a new team later never means building
a new flow — only granting one more Exchange permission (step 3 below).

## How the pieces fit together

```
Our app queues one job per shipment (QStash)
   │
   ▼
processSendJob() builds the email (recipient, subject, HTML body,
PDF attachments as base64) and POSTs it to the flow's HTTP trigger URL
   │
   ▼
Flow responds 202 immediately  ──────────────────────────►  job "done"
   │                                                          from our
   ▼                                                          app's POV
Flow sends via "Send an email (V2)"
(Office 365 Outlook connector, From = the mailbox we passed in)
   │
   ▼
Flow POSTs the real result to
POST /api/power-automate/callback ──────────────► our app finalizes
{batchItemId, status: "sent"|"failed", error?}     batch_items / email_events /
                                                     awb_cases / counters
```

The `202` and the final callback are two separate, asynchronous steps —
this matters because a sub-batch of sequential Graph sends inside the
flow can take longer than we want our own request to block on.

***

## 1. One-time setup: the service account

Don't authorize the flow's Outlook connection with an individual's
personal work account — if that person leaves or their password/MFA
changes, the flow silently breaks. Use a dedicated automation identity.

1. Ask FedEx IT to provision (or point you to an existing) service
   account, e.g. `svc-cargopaf-automation@fedex.com`. It needs a
   Microsoft 365 license that includes Power Automate — the free "Power
   Automate for Office 365" plan bundled with most standard M365 licenses
   is enough; no premium/per-flow plan is required for this use case.
2. **Faster-but-fragile shortcut for prototyping:** if you want to test
   this before formal service-account provisioning comes through, you can
   sign in with your own account when building the flow instead. Swap the
   connection to the real service account before this goes to production.

## 2. One-time setup: mailbox send-as permission

For each shared/operational mailbox that will ever be used as a "From"
address (i.e. each value teams enter as `operational_mailbox` in
`/setup/mailbox`), your Exchange admin grants the service account **Send
As** permission:

```powershell
Add-RecipientPermission `
  -Identity "cargo-ops@fedex.com" `
  -Trustee "svc-cargopaf-automation@fedex.com" `
  -AccessRights SendAs
```

Run this once per mailbox. When a new team onboards with a new shared
mailbox, this is the only new step — the flow itself never changes.

## 3. Build the flow

In [make.powerautomate.com](https://make.powerautomate.com), signed in as
the service account:

1. **Create → Instant cloud flow → "When an HTTP request is received."**
2. Set the request body **JSON schema** to:
   ```json
   {
     "type": "object",
     "properties": {
       "batchItemId": { "type": "string" },
       "fromMailbox": { "type": "string" },
       "to": { "type": "array", "items": { "type": "string" } },
       "cc": { "type": "array", "items": { "type": "string" } },
       "subject": { "type": "string" },
       "htmlBody": { "type": "string" },
       "attachments": {
         "type": "array",
         "items": {
           "type": "object",
           "properties": {
             "name": { "type": "string" },
             "contentType": { "type": "string" },
             "contentBytes": { "type": "string" }
           }
         }
       },
       "callbackUrl": { "type": "string" },
       "callbackSecret": { "type": "string" }
     }
   }
   ```
3. **Immediately add a "Response" action, before anything else**, status
   `202`, so the trigger returns fast:
   ```json
   { "received": true }
   ```
   This is what makes the hand-off async — everything after this point
   runs in the background from the caller's perspective.
4. Add **"Send an email (V2)"** (Office 365 Outlook connector):
   - **From**: `fromMailbox` (dynamic content from the trigger)
   - **To**: `to` (join the array with `;` using a `join()` expression, or
     use "Send an email (V2)"'s native array support if your connector
     version has it)
   - **Cc**: `cc`, same handling
   - **Subject**: `subject`
   - **Body**: `htmlBody` (toggle "Is HTML" on)
   - **Attachments Name / Content**: use an "Apply to each" over
     `attachments`, mapping `name` → Attachment Name and `contentBytes` →
     Attachment Content for each item
5. Right-click the "Send an email (V2)" step → **"Configure run after"**
   on the next two actions so you get separate success/failure branches:
   - **Success branch** — an "HTTP" action, `POST` to `callbackUrl`, header
     `X-PA-Callback-Secret: callbackSecret` (dynamic), body:
     ```json
     { "batchItemId": "@{triggerBody()?['batchItemId']}", "status": "sent", "runId": "@{workflow()?['run']?['name']}" }
     ```
   - **Failure branch** ("Configure run after" → *has failed*) — same
     HTTP action shape, `status: "failed"`, plus an `error` field pulled
     from the failed action's error output.
6. Save. Copy the generated HTTP POST URL from the trigger — this is your
   `POWER_AUTOMATE_FLOW_URL`.

## 4. Configure our app

In `.env.local` (and in Vercel's Preview/Production environment
variables):

```
MAIL_DRIVER=power_automate
POWER_AUTOMATE_FLOW_URL=<the trigger URL from step 3.6>
POWER_AUTOMATE_CALLBACK_SECRET=<any random string you generate — put the same value in the flow's callbackSecret field, or better, have our app pass it in the payload and have the flow just echo it back, which is what the trigger schema above already does>
APP_BASE_URL=<your real deployed URL — the flow needs to reach this>
```

`APP_BASE_URL` must be a real public URL — a local `next dev` server
isn't reachable from Power Automate. Test this against a Vercel Preview
deployment, not localhost.

## 5. Known gotcha: DLP policy

Some Power Platform environments have a Data Loss Prevention (DLP) policy
that buckets "HTTP" as a non-business connector, blocked from being used
in the same flow as a "business" connector like Office 365 Outlook. If
saving the flow fails with a DLP policy violation, this is why — ask your
Power Platform admin to either move the HTTP connector into the same data
group as Office 365 Outlook, or grant an exception for this flow.

## 6. Verification

1. Send one real test batch (5-10 rows, your own inbox) from a Preview
   deployment.
2. Confirm: the flow trigger responds `202` immediately; `batch_items`
   passes `pending → processing → sent`; `email_events` gets a row;
   `awb_cases` upserts; the email actually arrives with its attachment.
3. Temporarily disable the flow after it's triggered once, to confirm an
   orphaned `processing` item gets picked back up by the stalled-item cron
   (`api/cron/requeue-stalled`, runs every 10+ minutes) rather than
   hanging forever.
4. Confirm `MAIL_DRIVER=graph` still works unchanged for local dev/
   regression testing (see `docs/SETUP.md` section 5 for the Graph-path
   Azure AD setup, kept as a fallback).
