Attribute VB_Name = "OutlookAWBExtractor"
Option Explicit

'===========================================================
' Outlook AWB Email Extractor (ML / RAG-training version)
' ==========================================================
' PURPOSE:
'   Scan selected Outlook folders for emails mentioning AWB
'   numbers, export FULL bodies + metadata to Excel AND a
'   flat CSV, for training the RAG / email-classifier model.
'
' ═══════════════════════════════════════════════════════════
' THE FLOW (step by step)
' ═══════════════════════════════════════════════════════════
'  ┌────────────────────────────── SETUP (one time) ──────────────┐
'  │ STEP 1. Open the Excel workbook that will hold the data.     │
'  │ STEP 2. Press Alt+F11 → File → Import File → select this     │
'  │         .bas file → close the editor (Alt+Q).                │
'  │ STEP 3. Edit the constant "CC_OR_TO_MAIL" at the top of this │
'  │         file (see CONFIG). This is the shared mailbox that   │
'  │         the pre-alerts go TO and replies come TO.            │
'  └──────────────────────────────────────────────────────────────┘
'            │
'            ▼
'  ┌────────────────────────────── EACH RUN ──────────────────────┐
'  │ STEP 4. Alt+F8 → run ListOutlookFolders.                     │
'  │         Creates the "Select Folders" sheet with every        │
'  │         Outlook folder. Row 2 "*** ALL FOLDERS ***" is       │
'  │         pre-marked "Y" (scan everything).                    │
'  │ STEP 5. (Optional) Narrow the scan:                          │
'  │         - To scan only some folders: mark Row 2 "N" and put  │
'  │           "Y" on the specific folders you want.              │
'  │         - Set Start/End date in D3 / F3. If blank, the last  │
'  │           LOOKBACK_DAYS (365) are used.                      │
'  │ STEP 6. Paste AWB numbers in Column A of ANY sheet           │
'  │         (row 1 = header "AWB", data from row 2 onwards).     │
'  │         Use AWBs that got customer replies.                  │
'  │ STEP 7. Alt+F8 → run ExtractOutlookData.                     │
'  │         - Refuses to run if CC_OR_TO_MAIL is empty.          │
'  │         - Scans each selected folder ONCE; checks every      │
'  │           email in memory against all AWBs.                  │
'  │         - Keeps ONLY emails where CC_OR_TO_MAIL appears in   │
'  │           the TO or CC of the email.                         │
'  │         - Deduplicates by EntryID (no double rows).          │
'  └──────────────────────────────────────────────────────────────┘
'            │
'            ▼
'  ┌────────────────────────────── OUTPUT ────────────────────────┐
'  │ STEP 8. Two outputs are written:                            │
'  │         (a) "Extracted Data" sheet  — wide view, read-only. │
'  │         (b) "email_extract.csv"     — the file to LABEL.    │
'  │ STEP 9. Open email_extract.csv in Excel and fill the last 4 │
'  │         label columns (clearance_type / intent / urgency /  │
'  │         response_type) for every customer-reply row. Leave  │
'  │         internal / out-of-office / bounce rows blank.       │
'  │ STEP 10. Hand the labeled CSV to the pipeline:              │
'  │          cleaning_pipeline.py → label_with_llm.py →         │
'  │          embed_and_store.py → Supabase RAG store.           │
'  └──────────────────────────────────────────────────────────────┘
'
'   NOTE: If no folders are selected (all "N"), the script asks
'   and defaults to scanning ALL folders.
'
' CSV OUTPUT (email_extract.csv) — READY TO LABEL:
'   The CSV is the RAG / email-classifier training input. The last four
'   columns are EMPTY by design — the team fills them in so the data can be
'   embedded and stored:
'     clearance_type : nfbrk | febrk | febrk-sunimpex | febrk-jeena
'                     | calling | hold
'     intent         : inquiry | update | escalation | confirmation
'                    | docs_request | other
'     urgency        : low | normal | high | critical
'     response_type  : acknowledge | provide_info | request_docs
'                    | escalate | no_action
'   Fill one label per row. Rows that are NOT a customer reply (internal
'   @fedex.com mail, out-of-office, bounces) should be left blank in the
'   intent column — the cleaning pipeline filters them.
'
' CONFIG:
'   - CC_OR_TO_MAIL: a mail address (or domain like "@corp.ds.fedex.com").
'     ONLY emails that have this address in the TO or CC are extracted.
'     Set it before every run. If it is empty the script refuses to run
'     (it will NOT silently extract every email).
'   - MAX_MATCHES: max matches kept per AWB (default 100).
'===========================================================

Private Const MAX_MATCHES As Long = 100
Private Const LOOKBACK_DAYS As Long = 365
Private Const CC_OR_TO_MAIL As String = ""   ' ← SET THIS. Only emails with this
                                             '   address in TO/CC are extracted.
Private Const ALL_FOLDERS_LABEL As String = "*** ALL FOLDERS ***"

Private mRowNum As Long  ' row counter for output

'===========================================================
' LIST ALL OUTLOOK FOLDERS for user selection
' Run this first — creates/updates "Select Folders" sheet
'===========================================================
Public Sub ListOutlookFolders()
    Dim olApp As Object, olNS As Object
    If Not StartOutlook(olApp, olNS) Then Exit Sub

    Dim ws As Worksheet
    Set ws = GetOrCreateSheet("Select Folders")
    ws.Cells.Clear

    ws.Cells(1, 1).Value = "Select (Y)"
    ws.Cells(1, 2).Value = "Folder Path"
    ws.Range("1:1").Font.Bold = True
    ws.Rows(1).Interior.Color = RGB(220, 230, 241)

    ' Optional date range for the scan (blank = last LOOKBACK_DAYS)
    ws.Range("C3").Value = "Start Date:"
    ws.Range("C3").Font.Bold = True
    ws.Range("D3").NumberFormat = "dd-mmm-yyyy"
    ws.Range("D3").Value = Date - 7
    ws.Range("E3").Value = "End Date:"
    ws.Range("E3").Font.Bold = True
    ws.Range("F3").NumberFormat = "dd-mmm-yyyy"
    ws.Range("F3").Value = Date

    ' Row 2 = "ALL FOLDERS" toggle (pre-marked Y). Folders start at row 3.
    ws.Cells(2, 1).Value = "Y"
    ws.Cells(2, 2).Value = ALL_FOLDERS_LABEL
    ws.Rows(2).Interior.Color = RGB(255, 242, 204)
    ws.Rows(2).Font.Bold = True

    Dim r As Long: r = 3
    Dim store As Object
    For Each store In olNS.Folders
        WriteFolderPath ws, r, store, ""
    Next store

    ws.Columns("A:B").AutoFit
    ws.Activate
    MsgBox "Row 2 '*** ALL FOLDERS ***' is marked 'Y' = scan every folder." & vbCrLf & _
           "To limit the scan, change that cell to 'N' and mark 'Y' on the specific folders." & vbCrLf & _
           "Optional: set Start/End date in D3 / F3 (blank = last " & LOOKBACK_DAYS & " days)." & vbCrLf & _
           "Then paste AWBs in column A of any sheet and run ExtractOutlookData.", vbInformation
End Sub

Private Sub WriteFolderPath(ByVal ws As Worksheet, ByRef r As Long, ByVal folder As Object, ByVal parentPath As String)
    Dim path As String
    If parentPath = "" Then
        path = folder.Name
    Else
        path = parentPath & "\" & folder.Name
    End If
    ws.Cells(r, 1).Value = ""
    ws.Cells(r, 2).Value = path
    r = r + 1

    Dim subF As Object
    For Each subF In folder.Folders
        WriteFolderPath ws, r, subF, path
    Next subF
End Sub

'===========================================================
' ENTRY POINT — run from Excel after selecting folders
'===========================================================
Public Sub ExtractOutlookData()
    Dim ws As Worksheet
    Set ws = ActiveSheet

    ' -- Read AWBs from column A (row 2+)
    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, 1).End(xlUp).Row
    If lastRow < 2 Then
        MsgBox "No AWBs found in column A. Put AWBs from row 2 onwards (row 1 = header).", vbExclamation
        Exit Sub
    End If

    Dim awbArr() As String
    Dim awbCount As Long
    awbCount = lastRow - 1
    ReDim awbArr(1 To awbCount)

    Dim i As Long
    Dim raw As String
    For i = 1 To awbCount
        raw = Trim(CStr(ws.Cells(i + 1, 1).Value))
        If Len(raw) > 0 Then awbArr(i) = raw
    Next i

    ' -- Resolve date range (from "Select Folders" sheet D3/F3 if present)
    Dim startDate As Date, endDate As Date
    startDate = DateAdd("d", -LOOKBACK_DAYS, Now)
    endDate = Now
    On Error Resume Next
    Dim sfSheet As Worksheet
    Set sfSheet = GetOrCreateSheet("Select Folders")
    If Not sfSheet Is Nothing Then
        Dim sVal As Variant, eVal As Variant
        sVal = sfSheet.Range("D3").Value
        eVal = sfSheet.Range("F3").Value
        If IsDate(sVal) Then startDate = CDate(sVal)
        If IsDate(eVal) Then endDate = CDate(eVal)
    End If
    On Error GoTo 0

    If startDate > endDate Then
        Dim tmp As Date
        tmp = startDate
        startDate = endDate
        endDate = tmp
    End If

    ' -- Connect to Outlook
    Dim olApp As Object, olNS As Object
    If Not StartOutlook(olApp, olNS) Then Exit Sub

    ' -- Refuse to run without the TO/CC filter set (never extract ALL mail)
    If Len(Trim(CC_OR_TO_MAIL)) = 0 Then
        MsgBox "Set the CC_OR_TO_MAIL constant at the top of this script first." & vbCrLf & _
               vbCrLf & _
               "Only emails that have that address in TO or CC will be extracted." & vbCrLf & _
               "Nothing was extracted.", vbExclamation, "CC_OR_TO_MAIL not set"
        Application.StatusBar = False
        Exit Sub
    End If

    ' -- Pre-compute cleaned AWB strings (no hyphens/spaces)
    Dim cleanAWBs() As String
    ReDim cleanAWBs(1 To awbCount)
    For i = 1 To awbCount
        If Len(awbArr(i)) > 0 Then
            cleanAWBs(i) = LCase(RemoveHyphens(awbArr(i)))
        End If
    Next i

    ' -- Result dict: AWB -> Collection of Dictionary matches
    Dim results As Object
    Set results = CreateObject("Scripting.Dictionary")

    ' -- Also track by MessageID to avoid duplicates across AWBs
    Dim seenIDs As Object
    Set seenIDs = CreateObject("Scripting.Dictionary")

    ' -- Read selected folders; "ALL FOLDERS" toggle overrides individual picks
    Dim selectedFolders As Object
    Set selectedFolders = GetSelectedFolderPaths()

    Dim scanAll As Boolean
    scanAll = False
    If AllFoldersSelected() Then
        scanAll = True
    ElseIf selectedFolders Is Nothing Then
        Dim resp As VbMsgBoxResult
        resp = MsgBox("No folders selected." & vbCrLf & _
                      "Scan ALL folders?", vbYesNo + vbQuestion)
        If resp = vbNo Then
            Application.StatusBar = False
            Exit Sub
        End If
        scanAll = True
    End If

    ' -- SCAN SELECTED FOLDERS (or all)
    Application.DisplayStatusBar = True
    If scanAll Then
        Application.StatusBar = "Scanning ALL folders for " & awbCount & " AWB(s) ..."
    Else
        Application.StatusBar = "Scanning " & selectedFolders.Count & " selected folder(s) for " & awbCount & " AWB(s) ..."
    End If

    Dim itemsScanned As Long
    itemsScanned = 0

    If scanAll Then
        Dim topFolder As Object
        For Each topFolder In olNS.Folders
            ScanFolder topFolder, awbArr, cleanAWBs, results, seenIDs, itemsScanned, startDate, endDate
        Next topFolder
    Else
        Dim fldPath As Variant
        For Each fldPath In selectedFolders
            Dim target As Object
            Set target = ResolveFolderPath(olNS, fldPath)
            If Not target Is Nothing Then
                ScanFolder target, awbArr, cleanAWBs, results, seenIDs, itemsScanned, startDate, endDate
            End If
        Next fldPath
    End If

    Application.StatusBar = "Done scanning " & itemsScanned & " emails. Writing results..."
    DoEvents

    ' -- Write output (Excel + CSV)
    WriteResults ws, results, awbArr
    ExportCsv ws, results, awbArr

    Application.StatusBar = False

    Dim msg As String
    msg = "Complete!" & vbCrLf & _
          "  Emails scanned: " & itemsScanned & vbCrLf & _
          "  AWBs matched:   " & results.Count & vbCrLf & _
          "See sheet 'Extracted Data' + CSV 'email_extract.csv'."

    If scanAll Then
        msg = msg & vbCrLf & "  (ALL folders scanned — row 2 toggle or confirm prompt)"
    Else
        msg = msg & vbCrLf & "  Folders selected: " & selectedFolders.Count
    End If

    MsgBox msg, vbInformation
End Sub

'===========================================================
' Start Outlook application
'===========================================================
Private Function StartOutlook(ByRef olApp As Object, ByRef olNS As Object) As Boolean
    On Error Resume Next
    Set olApp = GetObject(, "Outlook.Application")
    If olApp Is Nothing Then
        Set olApp = CreateObject("Outlook.Application")
    End If
    On Error GoTo 0

    If olApp Is Nothing Then
        MsgBox "Could not start Outlook.", vbExclamation
        StartOutlook = False
        Exit Function
    End If

    Set olNS = olApp.GetNamespace("MAPI")
    StartOutlook = True
End Function

'===========================================================
' Read selected folders from "Select Folders" sheet
' Returns Nothing if sheet doesn't exist or no selections
'===========================================================
Private Function GetSelectedFolderPaths() As Object
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets("Select Folders")
    On Error GoTo 0

    If ws Is Nothing Then Exit Function

    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, 2).End(xlUp).Row
    If lastRow < 2 Then Exit Function

    Dim dict As Object
    Set dict = CreateObject("Scripting.Dictionary")

    Dim r As Long
    Dim sel As String
    For r = 2 To lastRow
        sel = Trim(CStr(ws.Cells(r, 1).Value))
        If UCase(sel) = "Y" Or UCase(sel) = "YES" Or sel = "X" Then
            Dim fldPath As String
            fldPath = Trim(CStr(ws.Cells(r, 2).Value))
            ' Skip the "ALL FOLDERS" toggle row here (handled by AllFoldersSelected)
            If Len(fldPath) > 0 And InStr(fldPath, "ALL FOLDERS") = 0 Then
                If Not dict.exists(fldPath) Then
                    dict.Add fldPath, True
                End If
            End If
        End If
    Next r

    If dict.Count = 0 Then Exit Function
    Set GetSelectedFolderPaths = dict
End Function

'===========================================================
' True when the "*** ALL FOLDERS ***" toggle row is marked Y
'===========================================================
Private Function AllFoldersSelected() As Boolean
    Dim ws As Worksheet
    On Error Resume Next
    Set ws = ThisWorkbook.Sheets("Select Folders")
    On Error GoTo 0

    If ws Is Nothing Then Exit Function

    Dim lastRow As Long
    lastRow = ws.Cells(ws.Rows.Count, 2).End(xlUp).Row

    Dim r As Long
    Dim sel As String
    For r = 1 To lastRow
        If InStr(Trim(CStr(ws.Cells(r, 2).Value)), "ALL FOLDERS") > 0 Then
            sel = Trim(CStr(ws.Cells(r, 1).Value))
            If UCase(sel) = "Y" Or UCase(sel) = "YES" Or sel = "X" Then
                AllFoldersSelected = True
                Exit Function
            End If
        End If
    Next r
End Function

'===========================================================
' Resolve a folder path string (e.g. "Mailbox\Inbox\Sub") to
' an Outlook Folder object.
'===========================================================
Private Function ResolveFolderPath(ByVal olNS As Object, ByVal folderPath As String) As Object
    Dim parts As Variant
    parts = Split(folderPath, "\")
    If UBound(parts) < 0 Then Exit Function

    Dim fld As Object
    On Error Resume Next
    Set fld = olNS.Folders(parts(0))
    If fld Is Nothing Then
        On Error GoTo 0
        Exit Function
    End If

    Dim p As Long
    For p = 1 To UBound(parts)
        Set fld = fld.Folders(parts(p))
        If fld Is Nothing Then
            On Error GoTo 0
            Exit Function
        End If
    Next p
    On Error GoTo 0

    Set ResolveFolderPath = fld
End Function

'===========================================================
' Get or create a worksheet by name
'===========================================================
Private Function GetOrCreateSheet(ByVal name As String) As Worksheet
    On Error Resume Next
    Set GetOrCreateSheet = ThisWorkbook.Sheets(name)
    If GetOrCreateSheet Is Nothing Then
        Set GetOrCreateSheet = ThisWorkbook.Sheets.Add(After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.Count))
        GetOrCreateSheet.Name = name
    End If
    On Error GoTo 0
End Function

'===========================================================
' Walk a folder tree, check each MailItem against all AWBs.
' Each folder's items are scanned ONCE (in the date window).
'===========================================================
Private Sub ScanFolder(ByVal folder As Object, ByRef awbArr() As String, _
                       ByRef cleanAWBs() As String, ByRef results As Object, _
                       ByRef seenIDs As Object, ByRef scanned As Long, _
                       ByVal startDate As Date, ByVal endDate As Date)
    On Error GoTo ScanErr

    Dim item As Object
    For Each item In folder.Items
        If TypeName(item) = "MailItem" Then
            ' Filter by date in code (100% reliable regardless of locale)
            If item.ReceivedTime >= startDate And item.ReceivedTime <= endDate Then
                MatchAgainstAWBs item, folder.Name, awbArr, cleanAWBs, results, seenIDs
            End If
            scanned = scanned + 1
            If scanned Mod 100 = 0 Then
                Application.StatusBar = "Scanning... " & scanned & " emails (" & folder.Name & ")"
                DoEvents
            End If
        End If
    Next item

    Dim subF As Object
    For Each subF In folder.Folders
        ScanFolder subF, awbArr, cleanAWBs, results, seenIDs, scanned, startDate, endDate
    Next subF

    Exit Sub

ScanErr:
    ' Swallow per-folder errors so one bad folder doesn't kill the run
End Sub

'===========================================================
' Check one email against all AWBs.
' Reads subject/body ONCE and checks all AWBs in memory.
'===========================================================
Private Sub MatchAgainstAWBs(ByVal mail As Object, ByVal folderName As String, _
                             ByRef awbArr() As String, ByRef cleanAWBs() As String, _
                             ByRef results As Object, ByRef seenIDs As Object)
    On Error GoTo Done

    If Not EmailInvolvesTarget(mail) Then Exit Sub

    ' -- Dedup by EntryID (same email won't match multiple AWBs twice)
    Dim entryId As String
    entryId = mail.EntryID & ""
    If Len(entryId) > 0 Then
        If seenIDs.exists(entryId) Then Exit Sub
        seenIDs.Add entryId, True
    End If

    ' -- Read the message content ONCE, then check all AWBs in memory
    Dim subjectText As String
    Dim bodyText As String
    subjectText = mail.Subject & ""
    bodyText = mail.Body & ""
    Dim compactText As String
    compactText = RemoveHyphens(subjectText & " " & bodyText)
    compactText = LCase(compactText)

    ' -- Build match dict once (metadata, not the heavy text)
    Dim match As Object
    Set match = CreateObject("Scripting.Dictionary")
    PopulateFields mail, folderName, subjectText, bodyText, match

    ' -- Check each AWB
    Dim i As Long
    For i = LBound(cleanAWBs) To UBound(cleanAWBs)
        If Len(cleanAWBs(i)) >= 6 Then
            If InStr(compactText, cleanAWBs(i)) > 0 Then
                AppendResult results, awbArr(i), match
            End If
        End If
    Next i

Done:
End Sub

'===========================================================
' Check if CC_OR_TO_MAIL appears in the email's TO or CC.
' The sender is NOT matched — we only want emails where the
' shared mailbox was a recipient (i.e. customer replies).
'===========================================================
Private Function EmailInvolvesTarget(ByVal mail As Object) As Boolean
    Dim target As String
    target = LCase(Trim(CC_OR_TO_MAIL))
    If Len(target) = 0 Then
        EmailInvolvesTarget = True
        Exit Function
    End If

    Dim toAddr As String
    toAddr = LCase(mail.To & "")
    If InStr(toAddr, target) > 0 Then
        EmailInvolvesTarget = True
        Exit Function
    End If

    Dim ccAddr As String
    ccAddr = LCase(mail.CC & "")
    If InStr(ccAddr, target) > 0 Then
        EmailInvolvesTarget = True
        Exit Function
    End If

    EmailInvolvesTarget = False
End Function

'===========================================================
' Remove hyphens, spaces, line breaks, tabs from text.
' Normalizes "8010-0001 2345" -> "801000012345"
'===========================================================
Private Function RemoveHyphens(ByVal txt As String) As String
    Dim t As String
    t = Replace(txt, "-", "")
    t = Replace(t, " ", "")
    t = Replace(t, vbCrLf, "")
    t = Replace(t, vbCr, "")
    t = Replace(t, vbLf, "")
    t = Replace(t, vbTab, "")
    RemoveHyphens = t
End Function

'===========================================================
' Extract all email fields into Dictionary
'===========================================================
Private Sub PopulateFields(ByVal mail As Object, ByVal folderName As String, _
                           ByVal subjectText As String, ByVal bodyText As String, ByRef match As Object)
    On Error Resume Next
    match("MessageID") = GetMessageId(mail)
    match("ConversationID") = mail.ConversationID & ""
    match("Subject") = subjectText
    match("Sender") = ResolveSender(mail)
    match("SenderName") = mail.SenderName & ""
    match("To") = mail.To & ""
    match("CC") = mail.CC & ""
    match("Received") = Format(mail.ReceivedTime, "yyyy-mm-dd hh:mm:ss")
    match("Folder") = folderName
    match("Body") = bodyText
    match("Attachments") = GetAttachmentInfo(mail)
    match("HasAttachments") = IIf(mail.Attachments.Count > 0, "1", "0")
    match("Mailbox") = GetMailboxName(mail)
    On Error GoTo 0
End Sub

'===========================================================
' Get reliable Message ID (EntryID or PR_INTERNET_MESSAGE_ID)
'===========================================================
Private Function GetMessageId(ByVal mail As Object) As String
    On Error Resume Next
    Dim pa As Object
    Set pa = mail.PropertyAccessor
    If Not pa Is Nothing Then
        GetMessageId = pa.GetProperty("http://schemas.microsoft.com/mapi/proptag/0x1035001E") & ""
    End If
    If Len(GetMessageId) = 0 Then
        GetMessageId = mail.EntryID & ""
    End If
    On Error GoTo 0
End Function

'===========================================================
' Get the mailbox/store name this item lives in
'===========================================================
Private Function GetMailboxName(ByVal mail As Object) As String
    On Error Resume Next
    Dim parent As Object
    Set parent = mail.Parent
    If Not parent Is Nothing Then
        Dim store As Object
        Set store = parent.Store
        If Not store Is Nothing Then
            GetMailboxName = store.DisplayName & ""
        End If
    End If
    If Len(GetMailboxName) = 0 Then GetMailboxName = mail.SenderEmailAddress & ""
    On Error GoTo 0
End Function

'===========================================================
' Attachment info: count + semicolon-separated filenames
'===========================================================
Private Function GetAttachmentInfo(ByVal mail As Object) As String
    On Error Resume Next
    Dim cnt As Long
    cnt = mail.Attachments.Count
    If cnt = 0 Then
        GetAttachmentInfo = "0"
        Exit Function
    End If

    Dim names As String
    names = CStr(cnt)
    Dim j As Long
    For j = 1 To cnt
        names = names & ";" & mail.Attachments(j).FileName
    Next j
    GetAttachmentInfo = names
    On Error GoTo 0
End Function

'===========================================================
' Resolve sender email/name
'===========================================================
Private Function ResolveSender(ByVal mail As Object) As String
    On Error Resume Next
    Dim snd As Object
    Set snd = mail.Sender
    If Not snd Is Nothing Then
        If snd.Type = "EX" Then
            Dim eu As Object
            Set eu = snd.GetExchangeUser
            If Not eu Is Nothing Then
                ResolveSender = eu.PrimarySmtpAddress
                If Len(ResolveSender) = 0 Then ResolveSender = eu.Name
                Exit Function
            End If
        End If
        ResolveSender = snd.Address
        If Len(ResolveSender) = 0 Then ResolveSender = snd.Name
    Else
        ResolveSender = mail.SenderName & ""
        If Len(ResolveSender) = 0 Then ResolveSender = mail.SenderEmailAddress & ""
    End If
    On Error GoTo 0
End Function

'===========================================================
' Store match under AWB key (cap at MAX_MATCHES)
'===========================================================
Private Sub AppendResult(ByRef dict As Object, ByVal awb As String, ByRef match As Object)
    Dim col As Collection
    If dict.exists(awb) Then
        Set col = dict(awb)
    Else
        Set col = New Collection
        dict.Add awb, col
    End If
    If col.Count < MAX_MATCHES Then
        col.Add match
    End If
End Sub

'===========================================================
' Write to "Extracted Data" sheet
'===========================================================
Private Sub WriteResults(ByVal srcWs As Worksheet, ByRef dict As Object, ByRef awbArr() As String)
    Dim wb As Workbook
    Set wb = srcWs.Parent

    Dim dest As Worksheet
    On Error Resume Next
    Set dest = wb.Sheets("Extracted Data")
    If dest Is Nothing Then
        Set dest = wb.Sheets.Add(After:=srcWs)
        dest.Name = "Extracted Data"
    Else
        dest.Cells.Clear
    End If
    On Error GoTo 0

    Dim hdr As Variant
    hdr = BuildHeaders()
    Dim c As Long
    For c = 0 To UBound(hdr)
        dest.Cells(1, c + 1).Value = hdr(c)
    Next c
    dest.Range("1:1").Font.Bold = True
    dest.Rows(1).Interior.Color = RGB(220, 230, 241)

    mRowNum = 2
    Dim i As Long
    Dim awbKey As String
    Dim colData As Collection
    Dim fld As Variant
    Dim matchIdx As Long

    For i = LBound(awbArr) To UBound(awbArr)
        awbKey = awbArr(i)
        If Len(awbKey) > 0 Then
            dest.Cells(mRowNum, 1).Value = awbKey
            If dict.exists(awbKey) Then
                Set colData = dict(awbKey)
                dest.Cells(mRowNum, 2).Value = colData.Count
                matchIdx = 0
                For Each fld In colData
                    WriteMatchRow dest, mRowNum, fld, matchIdx
                    matchIdx = matchIdx + 1
                Next fld
            Else
                dest.Cells(mRowNum, 2).Value = 0
            End If
            mRowNum = mRowNum + 1
        End If
    Next i

    ' -- Format
    Dim usedCols As Long
    usedCols = 2 + MAX_MATCHES * 10
    Dim rng As Range
    Set rng = dest.Range(dest.Columns(1), dest.Columns(usedCols))
    rng.AutoFit

    Dim j As Long
    For j = 10 To usedCols Step 10
        If dest.Columns(j).ColumnWidth < 40 Then dest.Columns(j).ColumnWidth = 40
        dest.Columns(j).WrapText = True
    Next j

    dest.Activate
    dest.Range("A2").Select
    ActiveWindow.FreezePanes = True
End Sub

'===========================================================
' Write one match row to the Excel sheet
'===========================================================
Private Sub WriteMatchRow(ByVal dest As Worksheet, ByVal rowNum As Long, _
                          ByRef fld As Variant, ByVal matchIdx As Long)
    Dim baseCol As Long
    baseCol = 3 + matchIdx * 10
    On Error Resume Next
    dest.Cells(rowNum, baseCol).Value = fld("MessageID")
    dest.Cells(rowNum, baseCol + 1).Value = fld("Subject")
    dest.Cells(rowNum, baseCol + 2).Value = fld("Sender")
    dest.Cells(rowNum, baseCol + 3).Value = fld("To")
    dest.Cells(rowNum, baseCol + 4).Value = fld("CC")
    dest.Cells(rowNum, baseCol + 5).Value = fld("Received")
    dest.Cells(rowNum, baseCol + 6).Value = fld("Folder")
    dest.Cells(rowNum, baseCol + 7).Value = fld("ConversationID")
    dest.Cells(rowNum, baseCol + 8).Value = fld("Attachments")
    dest.Cells(rowNum, baseCol + 9).Value = fld("Body")
    On Error GoTo 0
End Sub

'===========================================================
' Also export a flat CSV for ML pipeline (long format)
'===========================================================
Private Sub ExportCsv(ByVal srcWs As Worksheet, ByRef dict As Object, ByRef awbArr() As String)
    Dim filePath As String
    filePath = srcWs.Parent.Path & "\email_extract.csv"
    If Len(srcWs.Parent.Path) = 0 Then
        filePath = Environ("USERPROFILE") & "\Desktop\email_extract.csv"
    End If

    Dim fileNum As Integer
    fileNum = FreeFile
    Open filePath For Output As #fileNum

    ' -- CSV header (label columns at the end are filled in by the team)
    Print #fileNum, "awb,message_id,subject,sender,to_addr,cc_addr,received_at,folder,conversation_id,attachments,has_attachments,body_text,clearance_type,intent,urgency,response_type"

    Dim i As Long
    Dim awbKey As String
    Dim colData As Collection
    Dim fld As Variant

    For i = LBound(awbArr) To UBound(awbArr)
        awbKey = awbArr(i)
        If Len(awbKey) > 0 And dict.exists(awbKey) Then
            Set colData = dict(awbKey)
            For Each fld In colData
                Print #fileNum, CsvEscape(awbKey) & "," & _
                               CsvEscape(fld("MessageID")) & "," & _
                               CsvEscape(fld("Subject")) & "," & _
                               CsvEscape(fld("Sender")) & "," & _
                               CsvEscape(fld("To")) & "," & _
                               CsvEscape(fld("CC")) & "," & _
                               CsvEscape(fld("Received")) & "," & _
                               CsvEscape(fld("Folder")) & "," & _
                               CsvEscape(fld("ConversationID")) & "," & _
                               CsvEscape(fld("Attachments")) & "," & _
                               CsvEscape(fld("HasAttachments")) & "," & _
                               CsvEscape(fld("Body")) & "," & _
                               CsvEscape("") & "," & CsvEscape("") & "," & _
                               CsvEscape("") & "," & CsvEscape("")
            Next fld
        End If
    Next i

    Close #fileNum
End Sub

'===========================================================
' Escape a value for CSV (handle quotes, newlines, commas)
'===========================================================
Private Function CsvEscape(ByVal val As Variant) As String
    Dim s As String
    s = val & ""
    ' Double any existing quotes, then wrap in quotes
    CsvEscape = """" & Replace(s, """", """""") & """"
End Function

'===========================================================
' Headers (10 fields per match)
'===========================================================
Private Function BuildHeaders() As Variant
    Dim totalCols As Long
    totalCols = 2 + MAX_MATCHES * 10
    Dim arr() As Variant
    ReDim arr(0 To totalCols - 1)
    arr(0) = "AWB"
    arr(1) = "Match Count"

    Dim fieldNames As Variant
    fieldNames = Array("MessageID", "Subject", "Sender", "To", "CC", "Received", "Folder", "ConversationID", "Attachments", "Body")
    Dim m As Long, idx As Long
    For m = 1 To MAX_MATCHES
        For idx = 0 To 9
            arr(2 + (m - 1) * 10 + idx) = fieldNames(idx) & "_" & m
        Next idx
    Next m

    BuildHeaders = arr
End Function
