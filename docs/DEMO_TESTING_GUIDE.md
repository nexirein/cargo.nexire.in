# End-to-End Demo Testing Guide

## 0. Prerequisites: Fix Your .env.local

**Your current `.env.local` is missing SMTP and IMAP settings.**

### Get two Gmail addresses ready

| Address | Purpose | Example |
|---------|---------|---------|
| **Operational** | "From" address for sending pre-alerts; replies land here | `cargopaf.demo@gmail.com` |
| **Monitoring** | BCC'd on every sent email; IMAP polls this inbox | `cargopaf.monitor@gmail.com` |

### Step 1: Create App Passwords

For both Gmail addresses:
1. Enable 2FA on each account
2. Go to **Google Account → Security → App Passwords**
3. Create app password for "Mail" on "Mac" (16-character code)
4. Save both passwords

### Step 2: Set up Gmail forwarding (REPLY CAPTURE)

On the **Operational** account (`cargopaf.demo@gmail.com`):
1. Settings → See all settings → Forwarding and POP/IMAP
2. Click "Add a forwarding address" → enter monitoring address
3. Confirm the verification code sent to monitoring inbox
4. Select "Forward a copy of mail to" → monitoring address
5. **Choose:** "Keep Gmail's copy in the Inbox" (so replies stay in operational too)
6. Scroll down → IMAP Access → Enable IMAP → Save

On the **Monitoring** account (`cargopaf.monitor@gmail.com`):
1. Settings → See all settings → Forwarding and POP/IMAP
2. IMAP Access → Enable IMAP → Save

### Step 3: Fill .env.local

Add these lines to `.env.local`:

```env
# --- SMTP (outbound) ---
MAIL_DRIVER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=cargopaf.demo@gmail.com
SMTP_PASS=your-operational-16-char-app-password
SMTP_FROM=cargopaf.demo@gmail.com

# --- IMAP (inbound reply polling) ---
IMAP_HOST=imap.gmail.com
IMAP_PORT=993
IMAP_USER=cargopaf.monitor@gmail.com
IMAP_PASS=your-monitoring-16-char-app-password

# --- Vercel Cron (for local IMAP polling trigger) ---
CRON_SECRET=demo-test-secret-2024
```

### Step 4: Run the seed script (creates users + mailbox config)

Your Supabase is already connected (NEXT_PUBLIC_SUPABASE_URL is set). Run:

```bash
npm run seed
```

This creates 5 test users and 1 mailbox config:

| Email | Password | Role | Team |
|-------|----------|------|------|
| `admin@cargopaf.test` | Password123! | admin | Ops HQ |
| `lead@cargopaf.test` | Password123! | lead | Mumbai Cargo |
| **`operator@cargopaf.test`** | **Password123!** | **operator** | **Mumbai Cargo** |
| `reviewer@cargopaf.test` | Password123! | reviewer | Mumbai Cargo |
| `viewer@cargopaf.test` | Password123! | viewer | Mumbai Cargo |

Your existing mailbox config has different values — check yours below and adjust accordingly.

### Step 5: Point the mailbox config at your test Gmail accounts

First, see what you already have:

```sql
SELECT id, display_name, operational_mailbox, tagged_mailbox 
FROM mailbox_configs;
```

You'll see your existing row (not "Mumbai Cargo Ops"):
| Column | Your Value |
|--------|-----------|
| `display_name` | `Bipul Mailbox` |
| `operational_mailbox` | `bipul.sikder@fedex.com` |
| `tagged_mailbox` | `bipul-tagged@fedex.com` |

For testing with Gmail SMTP, update it to your demo Gmail accounts:

```sql
UPDATE mailbox_configs
SET
  operational_mailbox = 'cargopaf.demo@gmail.com',
  tagged_mailbox = 'cargopaf.monitor@gmail.com'
WHERE display_name = 'Bipul Mailbox';
```

**What these fields mean:**
- `operational_mailbox` → The "From" address on every pre-alert email. Consignees reply to this address.
- `tagged_mailbox` → BCC'd on every sent pre-alert. IMAP polls this inbox to capture replies.

**To switch back to your FedEx email later**, just UPDATE with `bipul.sikder@fedex.com` / `bipul-tagged@fedex.com` and set `MAIL_DRIVER=graph` in `.env.local` once Graph API is configured.

### Step 6: Verify everything is connected

```bash
npm run dev
```

Open `http://localhost:3000` and log in as `operator@cargopaf.test` / `Password123!`. Then:

1. Click **Templates** → verify page loads (Supabase read access works)
2. Click **Create Batch** → verify the mailbox dropdown shows "Bipul Mailbox"
3. Click **Dashboard** → verify all 8 metric cards render without errors

If the mailbox dropdown is **empty**, the UPDATE SQL didn't stick — re-run the SQL in Step 5.

---

## 1. Excel Format

The system accepts **any `.xlsx` file**. Only 2-3 columns must be mapped:

| Column | Required | Notes |
|--------|----------|-------|
| **AWB** | Yes | 12–15 digit numeric airway bill number |
| **Consignee Email** | Yes | Where the pre-alert will be sent |
| **Consignee Name** | No | Displayed in email greeting |

### Sample Excel (save as `test-prealert.xlsx`)

Create a file with these 10 rows in Excel:

| AWB | Consignee Email | Consignee Name | Origin | Destination | Commodity | Pieces | Weight |
|-----|----------------|----------------|--------|-------------|-----------|--------|--------|
| 123456789012 | cargopaf.demo+test1@gmail.com | Test One | HKG | ORD | Electronics | 5 | 250 |
| 123456789013 | cargopaf.demo+test2@gmail.com | Test Two | NRT | LAX | Machine Parts | 3 | 180 |
| 123456789014 | cargopaf.demo+test3@gmail.com | Test Three | FRA | JFK | Pharma | 10 | 400 |
| 123456789015 | cargopaf.demo+test4@gmail.com | Test Four | SIN | SFO | Computers | 8 | 320 |
| 123456789016 | cargopaf.demo+test5@gmail.com | Test Five | PVG | ORD | Textiles | 15 | 600 |
| 123456789017 | cargopaf.demo+test6@gmail.com | Test Six | ICN | LAX | Auto Parts | 7 | 900 |
| 123456789018 | cargopaf.demo+test7@gmail.com | Test Seven | DXB | JFK | Perishables | 4 | 120 |
| 123456789019 | cargopaf.demo+test8@gmail.com | Test Eight | AMS | ATL | Machinery | 2 | 1500 |
| 123456789020 | cargopaf.demo+test9@gmail.com | Test Nine | LHR | MIA | Documents | 1 | 5 |
| 123456789021 | cargopaf.demo+test0@gmail.com | Test Ten | TPE | LAX | Semiconductors | 20 | 50 |

**Mapping hint in the wizard:**
- AWB column → "AWB" → the system will detect this automatically
- Consignee Email → "Consignee Email" → auto-detected
- Consignee Name → "Consignee Name" → auto-detected
- All other columns (Origin, Destination, Commodity, Pieces, Weight) → automatically stored in `shipment_data` JSON, available as `{{Origin}}`, `{{Destination}}`, etc. in email templates

---

## 2. Full Demo Flow

### Phase A: Create a Template (if none exists)

1. Login as `operator@cargopaf.test` / `Password123!`
2. Navigate to **Templates** from sidebar
3. Click **Create Template**
4. Name: `Demo Pre-Alert Template`
5. Subject: `Pre-Alert: AWB {AWB} — {Origin} → {Destination}`
6. Body (HTML):
```html
<p>Dear {CONSIGNEE_NAME},</p>
<p>Please find below the pre-alert details for your upcoming shipment:</p>
<table>
  <tr><td>AWB:</td><td><strong>{AWB}</strong></td></tr>
  <tr><td>Origin:</td><td>{Origin}</td></tr>
  <tr><td>Destination:</td><td>{Destination}</td></tr>
  <tr><td>Commodity:</td><td>{Commodity}</td></tr>
  <tr><td>Pieces:</td><td>{Pieces}</td></tr>
  <tr><td>Weight:</td><td>{Weight} kg</td></tr>
</table>
<p>Invoice is attached for your reference.</p>
<p>Kindly confirm receipt at your earliest convenience.</p>
<p>Best regards,<br>Mumbai Cargo Operations</p>
```

**Important:** Use `{SINGLE}` curly braces — NOT `{{double}}`. The render engine only recognizes single braces. Built-in variables are uppercase (`{AWB}`, `{CONSIGNEE_NAME}`, `{CONSIGNEE_EMAIL}`). Extra Excel columns (Origin, Destination, etc.) use the **exact column header** from your spreadsheet — case-sensitive.
7. Click **Save**

### Phase B: Create a Batch

1. Navigate to **Create Batch** from sidebar
2. Fill in:
   - **Run name:** `Demo Batch 1 — HKG/ORD`
   - **Send-from mailbox:** Select the seeded mailbox config
   - **Email template:** Select the template you just created
   - **Sub-batch size:** 25
3. Click **Create** → you're redirected to mapping page

### Phase C: Upload and Map

1. In the **Mapping Wizard**, click to upload your `test-prealert.xlsx`
2. Verify the column mapping is auto-detected correctly:
   - AWB → AWB ✓
   - Consignee Email → Consignee Email ✓
   - Consignee Name → Consignee Name ✓
3. Click **Validate Rows**

### Phase D: Review Validation

- You should see 10 valid rows, 0 errors
- Note: AWB is **not** checked against existing batches in fresh DB (warning only)
- Click **Next** to proceed to Attachments

### Phase E: Attachments (Skip for Demo)

- Click **Mark all as "No attachment"** to bypass for now
- Or upload one-two PDFs named by AWB to test attachment flow
- Click **Next**

### Phase F: TIFF Conversion

- If no TIFF files uploaded, click **Skip** / **Continue**

### Phase G: Preview

- Review all 10 rows with rendered email previews
- Launch button should be enabled
- Click **Launch Batch**

### Phase H: Sending

The page shows live progress:
- "Sending 10 pre-alerts..."
- Each row transitions: `pending → queued → processing → sent`
- This takes ~30 seconds (SMTP to Gmail for 10 emails)
- **Verify:** Check the monitoring inbox — all 10 emails should arrive within 1-2 minutes

---

## 3. Reply Testing (Critical Demo Feature)

This is what makes the platform powerful: **replies are automatically captured and linked to cases.**

### How Reply Capture Works

```
Customer sends reply → lands in operational inbox (cargopaf.demo@gmail.com)
                              ↓
                    Gmail forwarding rule
                              ↓
              monitoring inbox (cargopaf.monitor@gmail.com)
                              ↓
                    IMAP poller (every 5 min)
                              ↓
                     /api/inbox/poll route
                              ↓
                     /api/inbox/ingest route
                              ↓
                   AWB extracted from reply text
                              ↓
                   Case created or linked
```

### Step-by-Step Reply Test

1. **Send the batch** (as above) — make sure it completes
2. Open the monitoring account inbox or the operational account inbox
3. Use a **separate Gmail account** (or Gmail's "+" addressing on your own account) — e.g., if you sent to `cargopaf.demo+test1@gmail.com`
4. Log into that account and **reply to the pre-alert email**
5. In your reply, **include the AWB number** somewhere in the body, e.g.:
   > "Thanks for the pre-alert for AWB 123456789012. We confirm receipt."
6. Send the reply
7. **Back in the app**, navigate to **Cases** from the sidebar
8. You should see a new case for `123456789012` with status `reply_received`
9. Click into the case — you should see the reply text in the timeline

### IMPORTANT: Two Things for Reply Capture to Work

| Requirement | Why |
|-------------|-----|
| **Reply text must contain the AWB** | The AWB extractor searches reply body for 12-15 digit numbers. No AWB = no case link. |
| **Gmail forwarding must be active** | Reply goes to operational inbox → is forwarded to monitoring inbox → IMAP picks it up from monitoring. If forwarding breaks, no reply gets ingested. |

**Alternative without forwarding:** You can point `IMAP_USER`/`IMAP_PASS` directly to the operational inbox instead of the monitoring inbox. This skips the forwarding step. Choose whichever is simpler for the demo.

### Trigger IMAP Poll Manually

Instead of waiting 5 minutes for the cron job, hit this URL in your browser:

```
http://localhost:3000/api/inbox/poll?cron_key=demo-test-secret-2024
```

This triggers immediate polling. You should see "Reply ingested successfully" in the response.

---

## 4. Dashboard Walkthrough

After the batch sends and replies come in:

1. **Dashboard** shows:
   - Total sent: 10 (or however many you sent)
   - Total replies: 1+ (once you reply)
   - Open cases count
   - Reply rate %
   - Awaiting reply count
   - Slipped cases alert (if any are overdue)

2. **Cases** page shows all cases linked to AWBs from your batch:
   - Status: `awaiting_reply` (grey badge) / `reply_received` (green badge)
   - Click to view case timeline
   - Claim a case (assign to yourself)
   - Update case status

3. **Reminders** page shows auto-scheduled follow-ups:
   - Each sent email schedules a reminder 48 hours later
   - You can see pending, sent, and cancelled reminders

---

## 5. Demo Script for Management

### What to Say (5-Minute Script)

| Time | What to Show | What to Say |
|------|-------------|-------------|
| 0:00 | Dashboard | "This is the live dashboard. We sent 10 pre-alerts 10 minutes ago and already have 3 replies — they were captured automatically." |
| 0:30 | Cases page | "Every AWB becomes a trackable case. When a consignee replies, the system detects it, extracts the AWB from the reply, and links it to the case — no manual forwarding." |
| 1:00 | Open a case | "Click any case. Here's the full timeline: pre-alert sent, reply received at 10:32 AM, the consignee text is right here. We can claim, escalate, or update status." |
| 1:30 | Create a new batch | "Let me show you how fast a new batch goes out. I have an ACCS export ready — 10 rows. Upload → map → validate = 30 seconds." |
| 2:00 | Launch the batch | "Launched. The system sends all 10 simultaneously with their invoices attached. Takes under 2 minutes for 150 emails in production." |
| 2:30 | Templates page | "Email templates are fully customizable with AWB, origin, destination variables — any field from the ACCS sheet." |
| 3:00 | Training Guide | "We've built a complete operations guide accessible from the sidebar — so new team members can be onboarded in 30 minutes instead of 2 weeks." |
| 3:30 | Reminders | "Auto-follow-ups are scheduled for every case without a reply within 48 hours. No more spreadsheet review meetings." |
| 4:00 | Q&A | "We're currently running on Gmail SMTP as the backend. The day IT provisions prealert@fedex.com with Exchange Online, we swap the config — zero code changes." |

### Key Selling Points

| Feature | Problem It Solves |
|---------|-------------------|
| **Batch upload + send** | 3 hours of individual Outlook forwarding → 2 minutes |
| **Reply capture** | Checking 150 inboxes manually → auto-ingested in 5 min |
| **Case management** | Excel trackers → structured cases with timeline |
| **Reminders** | "Did you follow up?" → auto-scheduled and tracked |
| **Dashboard** | No visibility → real-time metrics |
| **Templates** | Copy-paste errors → consistent branded emails |

---

## 6. Attachment Flow & Optimization

### Current Architecture

```
TIFF/PDF files → Conversion Runner (browser)
  → Upload to Supabase Storage (invoices bucket)
  → Store path in file_assets table
    → Send Engine downloads from Storage
      → Attaches to email via SMTP
```

**Why upload then download?** — The storage layer is the single source of truth. For production (QStash queue), the send webhook could hit any server instance, so the file must be in cloud storage. For local dev (inline), this is redundant but architecturally consistent.

### Scalability Analysis

| Approach | Local Dev Speed | Production Ready | Complexity |
|----------|----------------|-----------------|------------|
| **Current** (upload → download) | 3/10 — redundant transfer | 10/10 — works on any server | 1/10 |
| **Local-only cache** (skip storage) | 10/10 — instant | 0/10 — breaks in cloud | 7/10 |
| **Tiered** (local if inline, storage if qstash) | 8/10 | 10/10 | 5/10 |

**Recommendation:** Keep the current flow. The bottleneck is not the attachment transfer — it's SMTP round-trips (3-5 sec per email). Even for 150 emails, attachment overhead adds < 1 sec per email. The SMTP send dominates at ~3-5 min total. Optimizing attachments gains < 20% improvement at the cost of architectural complexity.

### When to optimize

If SMTP speed becomes the bottleneck (e.g., 500+ emails/day), the right fix is:
1. **Increase parallelism** — raise `pLimit` from 4 to 8-12 (watch Gmail rate limits: 150/day free, 2000/day Workspace)
2. **Switch to Graph API** — Exchange Online has higher send limits
3. **Use SendGrid/AWS SES** — dedicated email API, 10,000+ emails/sec
4. **Connection pooling** — reuse SMTP connections across sends instead of creating a new connection per email

The storage upload/download is never the bottleneck.

---

## 7. Troubleshooting Checklist

| Symptom | Fix |
|---------|-----|
| Emails not sending | Check SMTP_USER/SMTP_PASS in .env.local; verify App Password is valid |
| Emails sending but not arriving | Check spam folder; Gmail rate limits (150/day for free, 2000/day for Workspace) |
| Reply not showing in Cases | Check Gmail forwarding rule; trigger `/api/inbox/poll?cron_key=...` manually; check reply text contains AWB |
| IMAP poll returning 500 | Check IMAP_USER/IMAP_PASS; verify IMAP is enabled in Gmail settings |
| Login failing | Run `npm run seed` again to recreate seed accounts |
| Cannot see mailbox in dropdown | Run `npm run seed` then the UPDATE SQL in Prerequisites Step 5 |
| Template not rendering | Check that template variable names match Excel column names exactly |
