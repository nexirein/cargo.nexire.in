# Clearance Type Detector — VBA Script Guide

## What It Does

This macro scans your **Outlook Sent Items** to determine the clearance type (NFBRK / FEBRK-Jeena / FEBRK-Sunimpex) for each company in your Excel sheet. It does this by checking whether past emails to that company had **Jeena** or **Sunimpex** in the CC field.

## How It Determines the Result

| CC Contains | Result |
|-------------|--------|
| `@jeena.co.in` in CC | **FEBRK-Jeena** |
| `@sunimpexcsa.com` in CC | **FEBRK-Sunimpex** |
| Company found in past emails, no broker CC | **NFBRK** (likely uses own broker) |
| No matching email found at all | **NOT FOUND** (flag for AI calling) |

---

## Setup Instructions

### Step 1: Open Your Excel Sheet
Open the pre-alert Excel file that contains your AWB and company data.

### Step 2: Open the VBA Editor
Press `Alt + F11` to open the VBA editor.

### Step 3: Import the Script
1. In the VBA editor menu: **File → Import File**
2. Navigate to and select `clearance_type_detector.bas`
3. You should see `ClearanceTypeDetector` appear in the Project Explorer

### Step 4: Configure Column Positions
The script needs to know which columns contain your data. Edit these constants at the top of the script:

```vb
Private Const SHEET_NAME As String = "Sheet1"     ' Name of your data sheet
Private Const COL_COMPANY As Long = 5              ' Column with company names
Private Const COL_AWB As Long = 4                  ' Column with AWB numbers (for logging)
Private Const COL_OUTPUT As Long = 6               ' Column to write clearance type
Private Const COL_BROKER As Long = 9               ' Column to write broker name
Private Const LOOKBACK_DAYS As Long = 365          ' How far back to search
```

**Column layouts for different Excel formats:**

**Format A (27-column daily format):**
```
A=Agent, B=Loc, C=Date, D=AWB Numbers, E=Consignee Name, 
F=BSO, G=Freight, H=Currency, I=End Result, J=Data Type,
K=Mode, L=PIN Code, M=Standard Remarks, N=FedEx Broker, O=Contact
```
- `COL_COMPANY = 5`, `COL_AWB = 4`, `COL_OUTPUT = 9`, `COL_BROKER = 14`

**Format B (10-column seed format):**
```
A=Agent, B=Location, C=DATE, D=FEC Numbers, E=Cgnee Name,
F=End Result, G=PIN Code, H=Standard Remarks, I=FedEx Broker, J=Mail ID
```
- `COL_COMPANY = 5`, `COL_AWB = 4`, `COL_OUTPUT = 6`, `COL_BROKER = 9`

**Count columns from A=1 to find your correct numbers.**

### Step 5: Run the Script
1. Close the VBA editor
2. Press `Alt + F8` to open the macro list
3. Select **DetectClearanceTypes** and click **Run**

### Step 6: Review Results
The script will:
1. Scan your sheet row by row
2. Search Outlook Sent Items for matching emails
3. Update the **End Result** column with: `NFBRK` / `FEBRK-Jeena` / `FEBRK-Sunimpex`
4. Update the **FedEx Broker** column with: `Jeena` or `Sunimpex`
5. Create a **"Clearance Results"** summary sheet with a detailed breakdown

### Step 7: Handle "NOT FOUND" Items
For companies where no email history was found:
- The End Result column will be **empty**
- Upload this sheet to the **Clearance Fill** web tool to initiate AI calls
- AI calls will resolve these automatically

---

## Performance Tips

- **First run** on a sheet with 200+ companies can take 2-5 minutes
- The script searches up to **365 days** of sent emails (configurable)
- It stops searching once it finds **clear evidence** of Jeena/Sunimpex in CC
- Progress is shown in the Excel status bar

## Troubleshooting

| Problem | Solution |
|---------|----------|
| "Sheet not found" | Check `SHEET_NAME` matches your sheet tab name (case-sensitive) |
| "Could not start Outlook" | Make sure Outlook is open and running |
| Many "NOT FOUND" results | Increase `LOOKBACK_DAYS` to 730 to search 2 years back |
| Wrong results | Check the "Clearance Results" sheet to see which emails were matched |

## Sync with Web Tool

After running the macro:
1. Save your Excel sheet
2. Upload it to **Clearance Fill** in the web app
3. The web app will auto-fill from our master database (which already has 90%+ of companies)
4. For companies the macro couldn't find AND our master DB doesn't have → initiate AI calls
5. Export the final CSV and vlookup results back into your original sheet

This two-step flow (VBA script → Web app) gives you the best of both worlds:
- **VBA script**: Checks your personal Outlook history for each company
- **Web master DB**: Has learned from ALL team members' history
- **AI calling**: Resolves new/unknown companies automatically
