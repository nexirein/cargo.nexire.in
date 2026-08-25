# Outlook AWB Extractor — User Guide

Extract emails matching AWBs from selected Outlook folders.

---

## Setup (one time)

1. Open Excel → `Alt+F11` to open VBA editor
2. `File → Import File` → select `outlook_awb_extractor.bas`
3. Close VBA editor, save the workbook as `.xlsm` (Macro-Enabled)

---

## How to Run

### Step 1 — List Outlook Folders

- Press `Alt+F8`, select `ListOutlookFolders`, click **Run**
- A new sheet **"Select Folders"** appears with all your Outlook folders

### Step 2 — Pick Folders

- In column A, type `Y` next to each folder you want to search
  (e.g. `Y` next to `Inbox`, `Y` next to `Sent Items`)
- Subfolders are included automatically

### Step 3 — Paste AWBs

- In any sheet, put `AWB` in cell **A1**
- Paste your AWB numbers in column A from **A2** downwards

### Step 4 — Extract

- Press `Alt+F8`, select `ExtractOutlookData`, click **Run**
- Results go to a new **"Extracted Data"** sheet + CSV file on your desktop

---

## Folder Path Format

Folders appear as `Mailbox Name\Folder\Subfolder` in the list.
If you have multiple mailboxes, each appears as a top-level entry.

---

## What Gets Extracted

Per matching email (up to 5 per AWB):

| Field | Description |
|-------|-------------|
| MessageID | Unique email ID |
| Subject | Email subject line |
| Sender | Sender email address |
| To / CC | Recipients |
| Received | Date/time received |
| Folder | Which folder it was found in |
| Body | Full email body text |
| Attachments | Count + filenames |

Only emails involving `sikder16bipul@gmail.com` are scanned (change in the code if needed).

---

## Tips

- **Select fewer folders** = faster extraction
- If you skip Step 1-2, `ExtractOutlookData` scans **all** folders (slow)
- CSV is saved to the same folder as the workbook, or your desktop
- Run `ListOutlookFolders` again anytime to refresh the folder list
