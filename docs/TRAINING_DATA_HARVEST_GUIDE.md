# Training-Data Harvest Guide — for the Operations Team

This is the only manual step in the whole system. You pull **real pre-alert
replies out of Outlook**, label them, and that data becomes the AI's memory.
The better the labels, the better every auto-reply and every draft the AI
writes.

Expected effort: ~1–2 hours per batch. Target **100–300 labeled rows** per
batch — that is enough to make the classifier and RAG noticeably better.

---

## 1. Which tool to use

Use **`scripts/outlook_awb_extractor.bas`** — it is the only one that writes
the CSV the model trains on.

(`scripts/awb_email_finder.bas` is a quick-glance tool only — it shows results
in a sheet but writes no CSV. Ignore it for training.)

---

## 2. What to collect

**The goal: customer replies to our pre-alerts** — the emails that landed in
the shared/pre-alert mailbox after we sent a pre-alert.

- **Paste AWBs** from shipments you **know got replies** — pick AWBs from the
  last 30–90 days where the customer wrote back (invoice requests,
  confirmations, "documents attached", escalations, questions).
- **Mix in a few clearances where the customer DIDN'T reply** — those show the
  model what silence looks like before a reminder.
- One AWB per row in column A (row 1 is the header `AWB`).

### Folders

- **Inbox** — customer replies (the main training signal).
- **Sent Items** — our own replies. These teach the RAG model what a
  **good reply** looks like, so include them.

### Date range

- **Start/End date** on the "Select Folders" sheet (D3 / F3). Use the last
  30–90 days — recent mail matches the current template wording.

---

## 3. How to run (one time, then repeat)

1. Open Excel, `Alt+F11` → import `outlook_awb_extractor.bas` → close editor.
2. **Set the mail filter** — at the very top of the script there is a
   constant `CC_OR_TO_MAIL`. Put the shared/pre-alert mailbox address there
   (e.g. `prealert.delhi@fedex.com`, or a domain like `@corp.ds.fedex.com`).
   Only emails that have that address in **TO or CC** are extracted — nothing
   else. The script refuses to run if it is left empty.
3. `Alt+F8` → run **`ListOutlookFolders`** — lists all Outlook folders.
4. Leave the `*** ALL FOLDERS ***` row marked **Y** (scans everything), or mark
   Y on specific folders only.
5. Paste the AWBs in column A.
6. `Alt+F8` → run **`ExtractOutlookData`**.
7. Output lands in the same folder as the workbook:
   - `email_extract.csv` — **this is the file to label** (open it in Excel).
   - "Extracted Data" sheet — a read-only view.

---

## 4. Labeling — fill these 4 columns

Open `email_extract.csv`. The last four columns are empty — **fill them in**.
Every row = one email. The four labels per row:

### `clearance_type` (which clearance flow the email belongs to)

| value | meaning |
|---|---|
| `nfbrk` | consignee's own CHA/broker clears it (our default flow) |
| `febrk` / `febrk-sunimpex` / `febrk-jeena` | FedEx nominated broker clears it |
| `calling` | callback / calling flow |
| `hold` | shipment on hold |

### `intent` (what the email wants)

| value | example |
|---|---|
| `docs_request` | "Please send invoice and packing list" |
| `inquiry` | "Where is my shipment? What are the charges?" |
| `confirmation` | "Documents attached, proceeding with clearance" |
| `update` | "We will use our own CHA" / "DO collected" |
| `escalation` | complaint, delay, penalty / charges dispute |
| `other` | anything that does not fit the above |

### `urgency` (how fast it needs a reply)

| value | meaning |
|---|---|
| `low` | can wait a day |
| `normal` | reply same day |
| `high` | reply within a few hours (arrival-day DO/BOE pressure) |
| `critical` | penalty / legal / release at risk right now |

### `response_type` (what a good reply looks like)

| value | meaning |
|---|---|
| `acknowledge` | just confirm receipt |
| `provide_info` | send the requested info (invoice, charges, IGM/MAWB, DO details) |
| `request_docs` | we need to ask them for documents |
| `escalate` | route to lead/reviewer |
| `no_action` | nothing needed |

---

## 5. Rules of thumb (what makes it GOOD)

- **Label customer replies only.** Our own sent pre-alerts are not training
  targets.
- **Internal `@fedex.com` mail and out-of-office / bounced mail → leave the
  `intent` column BLANK.** The cleaning pipeline filters those automatically.
- **Prefer real replies over template text** — the model learns most from the
  messy, real ones ("please send invoice and packing list of awb
  874284953656").
- **Balance the classes**: make sure you have a healthy mix of
  `docs_request`, `inquiry`, `confirmation`, and `update` — not just one type.
- **When in doubt on `urgency`, pick `normal`.** Only mark `high`/`critical`
  for arrival-day / penalty situations.
- Do not spend time perfecting wording — the labels are what matter.

---

## 6. What happens next (no action needed from you)

1. `scripts/cleaning_pipeline.py` — strips signatures/quotes, drops
   auto-replies → `cleaned_emails.csv`.
2. `scripts/label_with_llm.py` — fills any labels the LLM can predict
   confidently (your labels are treated as gold and never overwritten).
3. `scripts/embed_and_store.py` — creates embeddings → Supabase `emails` store
   → ready for RAG retrieval in the reply classifier.

The next batch can then reuse this run's data — the model only improves.
