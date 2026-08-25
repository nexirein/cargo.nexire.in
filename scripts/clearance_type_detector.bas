Attribute VB_Name = "ClearanceTypeDetector"
Option Explicit

'===========================================================
' Clearance Type Detector — Outlook History Scanner
' ==========================================================
' PURPOSE:
'   Scans ALL Outlook folders (Inbox, Sent, subfolders) using
'   weighted confidence scoring to detect clearance type
'   (FEBRK-Jeena / FEBRK-Sunimpex / NFBRK) for each company
'   in your pre-alert Excel sheet.
'
'   Only writes when confident (score >= 100). Leaves blanks
'   for the web platform (Clearance Fill) to resolve via
'   36K master DB + fuzzy matching + AI voice calling.
'
' ─── SETUP (one time) ───
'   Step 1: Open your pre-alert Excel sheet
'   Step 2: Press Alt+F11 to open the VBA editor
'   Step 3: Go to File → Import File → select this .bas file
'   Step 4: Close the VBA editor (Alt+Q)
'   Step 5: If you see a security warning, enable macros
'
' ─── AFTER SETUP (first run) ───
'   Step 1: Check the CONFIGURATION section below
'           Default columns: AWB=Col D | Company=Col E
'           Output=Col I (End Result) | Broker=Col N
'           → Edit the Private Const values if your sheet
'             uses different columns
'   Step 2: Press Alt+F8, select "DetectClearanceTypes", Run
'   Step 3: Script scans Outlook folders for each company
'           → Progress bar in status bar shows row-by-row
'   Step 4: Script writes results directly into your sheet:
'           COL_OUTPUT (I) = "FEBRK-Jeena" / "FEBRK-Sunimpex"
'             / "NFBRK" / blank (unresolved)
'           COL_BROKER (N) = "Jeena" / "Sunimpex" / blank
'   Step 5: Review the summary popup at the end
'
' ─── UNDERSTANDING RESULTS ───
'   FEBRK-Jeena:    Emails with @jeena.co.in found for this
'                   company (high confidence)
'   FEBRK-Sunimpex: Emails with @sunimpex.com found (high
'                   confidence)
'   NFBRK:          Email explicitly mentions "nfbrk",
'                   "apna cha", or "self clearance"
'   (blank):        Script wasn't confident enough. These
'                   rows will be auto-resolved by the web
'                   platform's Clearance Fill when you
'                   upload the sheet.
'
' ─── TIPS ───
'   - Make sure Outlook is running before you run the macro
'   - One run covers ALL rows in the sheet automatically
'   - Only writes when score >= 100 (avoids false positives)
'   - Ties between Jeena and Sunimpex → blank (deferred)
'   - Does NOT assume NFBRK just because emails exist
'   - Web platform handles what this script leaves blank
'===========================================================

' ─── CONFIGURATION — Edit these to match your sheet ───
Private Const SHEET_NAME As String = "Sheet1"
Private Const COL_COMPANY As Long = 5     ' Column E = Consignee Name
Private Const COL_AWB As Long = 4         ' Column D = AWB Numbers / FEC Numbers
Private Const COL_OUTPUT As Long = 9      ' Column I = End Result (script writes here)
Private Const COL_BROKER As Long = 14     ' Column N = FedEx Broker (script writes here)
Private Const LOOKBACK_DAYS As Long = 365 ' How many days back to search
' ────────────────────────────────────────────────────────

' Broker domain signatures for detection
Private Const DOMAIN_JEENA As String = "@jeena.co.in"
Private Const DOMAIN_SUNIMPEX As String = "@sunimpex.com"

' Counters for summary
Private mRowNumber As Long

'===========================================================
' MAIN ENTRY POINT — Run this from Excel (Alt+F8)
'===========================================================
Public Sub DetectClearanceTypes()
  Dim ws As Worksheet
  Set ws = GetSheet(SHEET_NAME)
  If ws Is Nothing Then
    MsgBox "Sheet '" & SHEET_NAME & "' not found. Edit SHEET_NAME at the top of the macro.", vbExclamation
    Exit Sub
  End If
  
  ' Find last row with data in company column
  Dim lastRow As Long
  lastRow = ws.Cells(ws.Rows.Count, COL_COMPANY).End(xlUp).Row
  If lastRow < 2 Then
    MsgBox "No data found in column " & ColLetter(COL_COMPANY) & " (Consignee Name).", vbExclamation
    Exit Sub
  End If
  
  ' Read data into arrays
  Dim companies() As String
  Dim awbs() As String
  Dim companyCount As Long
  companyCount = lastRow - 1
  ReDim companies(1 To companyCount)
  ReDim awbs(1 To companyCount)
  
  Dim i As Long
  For i = 1 To companyCount
    companies(i) = Trim(CStr(ws.Cells(i + 1, COL_COMPANY).Value))
    awbs(i) = Trim(CStr(ws.Cells(i + 1, COL_AWB).Value))
  Next i
  
  ' Connect to Outlook
  Dim olApp As Object, olNS As Object
  If Not StartOutlook(olApp, olNS) Then Exit Sub
  
  Application.DisplayStatusBar = True
  Application.StatusBar = "Scanning Outlook for " & companyCount & " companies..."
  DoEvents
  
  ' Collect all folders to search
  Dim allFolders As Collection
  Set allFolders = New Collection
  Dim store As Object
  For Each store In olNS.Folders
    CollectAllFolders store, allFolders
  Next store
  
  ' Track results as pipe-delimited strings in Dictionary
  ' Format: "clearanceType|brokerName|source|matchedCount"
  ' This avoids VBA's limitation with UDTs in Dictionaries
  Dim results As Object
  Set results = CreateObject("Scripting.Dictionary")
  
  Dim nfbrkCount As Long, jeenaCount As Long
  Dim sunimpexCount As Long, notFoundCount As Long
  nfbrkCount = 0: jeenaCount = 0: sunimpexCount = 0: notFoundCount = 0
  
  ' Scan each company across all folders
  For i = 1 To companyCount
    Dim companyName As String
    companyName = companies(i)
    
    If Len(companyName) > 0 Then
      mRowNumber = i + 1
      Application.StatusBar = "Scanning: " & companyName & " (" & i & "/" & companyCount & ")"
      DoEvents
      
      Dim clearanceType As String, brokerName As String
      Dim source As String, matchedCount As Long
      
      ScanAllFolders olNS, allFolders, companyName, awbs(i), _
        clearanceType, brokerName, source, matchedCount
      
      ' Store as pipe-delimited string
      results(companyName) = clearanceType & "|" & brokerName & "|" & source & "|" & matchedCount
      
      ' Count for summary
      Select Case clearanceType
        Case "nfbrk": nfbrkCount = nfbrkCount + 1
        Case "febrk-jeena": jeenaCount = jeenaCount + 1
        Case "febrk-sunimpex": sunimpexCount = sunimpexCount + 1
        Case Else: notFoundCount = notFoundCount + 1
      End Select
      
      ' Write result to sheet immediately
      WriteResult ws, i + 1, clearanceType, brokerName
    End If
  Next i
  
  Application.StatusBar = False
  
  ' Show summary
  Dim msg As String
  msg = "Clearance Type Detection Complete!" & vbCrLf & vbCrLf & _
        "  Total companies scanned: " & companyCount & vbCrLf & _
        "  FEBRK-Jeena (confirmed):  " & jeenaCount & vbCrLf & _
        "  FEBRK-Sunimpex (confirmed): " & sunimpexCount & vbCrLf & _
        "  Left blank (→ web platform): " & notFoundCount & vbCrLf & vbCrLf & _
        "Results written to:" & vbCrLf & _
        "  Column " & ColLetter(COL_OUTPUT) & " → End Result (FEBRK-Jeena / FEBRK-Sunimpex)" & vbCrLf & _
        "  Column " & ColLetter(COL_BROKER) & " → FedEx Broker (Jeena / Sunimpex)" & vbCrLf & vbCrLf & _
        "Note: Only confirmed broker matches are written." & vbCrLf & _
        "Blanks will be resolved by the Clearance Fill web platform (master DB + 3-chain auto-fill)."
  
  WriteSummary ws, nfbrkCount, jeenaCount, sunimpexCount, notFoundCount, results
  
  MsgBox msg, vbInformation, "Clearance Type Detection"
End Sub

'===========================================================
' Scan ALL folders for a company
' Uses weighted confidence scoring across multiple signals:
'
'   FEBRK-Jeena signals:
'     CC @jeena.co.in      → +100
'     FROM @jeena.co.in    → +80
'     TO @jeena.co.in      → +60
'     Body: jeena + febrk  → +50
'     AWB in subject + jeena → +40
'
'   FEBRK-Sunimpex signals:
'     CC @sunimpex.com     → +100
'     FROM @sunimpex.com   → +80
'     TO @sunimpex.com     → +60
'     Body: sunimpex+febrk → +50
'     AWB in subj + sunimpex → +40
'
'   NFBRK signals (explicit keywords only):
'     Body: "NFBRK", "apna CHA", "self clearance", etc. → +100
'     Subject: "NFBRK" → +80
'
'   Threshold: 100. Only the highest-scoring match wins.
'   Ties → no result (blank for web platform).
'===========================================================
Private Sub ScanAllFolders(ByVal olNS As Object, _
                           ByVal allFolders As Collection, _
                           ByVal companyName As String, _
                           ByVal awb As String, _
                           ByRef outClearance As String, _
                           ByRef outBroker As String, _
                           ByRef outSource As String, _
                           ByRef outCount As Long)
  outClearance = ""
  outBroker = ""
  outSource = "no_match"
  outCount = 0
  
  Dim searchTerms As Variant
  searchTerms = GetSearchTerms(companyName)
  If UBound(searchTerms) < 0 Then Exit Sub
  
  Dim cutoff As Date
  cutoff = DateAdd("d", -LOOKBACK_DAYS, Now)
  
  Dim jeenaScore As Long, sunimpexScore As Long, nfbrkScore As Long
  Dim matchCount As Long
  Dim signals As String
  jeenaScore = 0: sunimpexScore = 0: nfbrkScore = 0: matchCount = 0
  
  Const THRESHOLD As Long = 100
  
  Dim fld As Variant
  For Each fld In allFolders
    Dim folder As Object: Set folder = fld
    
    On Error Resume Next
    Dim filteredItems As Object
    Dim filter As String
    filter = "[ReceivedTime] >= '" & Format(cutoff, "yyyy-mm-dd") & "'"
    Set filteredItems = folder.Items.Restrict(filter)
    If filteredItems Is Nothing Then Set filteredItems = folder.Items
    On Error GoTo 0
    
    filteredItems.Sort "ReceivedTime", True
    
    Dim item As Object
    For Each item In filteredItems
      If TypeName(item) = "MailItem" Then
        If EmailMatchesCompany(item, searchTerms, awb) Then
          matchCount = matchCount + 1
          
          Dim allText As String
          allText = LCase(item.Subject & " " & item.Body)
          Dim ccText As String:   ccText = LCase(item.CC & "")
          Dim toText As String:   toText = LCase(item.To & "")
          Dim fromText As String: fromText = LCase(item.SenderEmailAddress & "")
          Dim subj As String:     subj = LCase(item.Subject & "")
          
          ' ═══ FEBRK-Jeena signals ═══
          
          If InStr(ccText, DOMAIN_JEENA) > 0 Then
            jeenaScore = jeenaScore + 100
            signals = signals & "cc-jeena "
          End If
          
          If InStr(fromText, DOMAIN_JEENA) > 0 Then
            jeenaScore = jeenaScore + 80
            signals = signals & "from-jeena "
          End If
          
          If InStr(toText, DOMAIN_JEENA) > 0 Then
            jeenaScore = jeenaScore + 60
            signals = signals & "to-jeena "
          End If
          
          If InStr(allText, "jeena") > 0 And InStr(allText, "febrk") > 0 Then
            jeenaScore = jeenaScore + 50
            signals = signals & "body-jeena-febrk "
          End If
          
          If Len(awb) >= 4 Then
            If InStr(subj, LCase(awb)) > 0 And InStr(allText, "jeena") > 0 Then
              jeenaScore = jeenaScore + 40
              signals = signals & "awb-subj-jeena "
            End If
          End If
          
          ' ═══ FEBRK-Sunimpex signals ═══
          
          If InStr(ccText, DOMAIN_SUNIMPEX) > 0 Then
            sunimpexScore = sunimpexScore + 100
            signals = signals & "cc-sunimpex "
          End If
          
          If InStr(fromText, DOMAIN_SUNIMPEX) > 0 Then
            sunimpexScore = sunimpexScore + 80
            signals = signals & "from-sunimpex "
          End If
          
          If InStr(toText, DOMAIN_SUNIMPEX) > 0 Then
            sunimpexScore = sunimpexScore + 60
            signals = signals & "to-sunimpex "
          End If
          
          If InStr(allText, "sunimpex") > 0 And InStr(allText, "febrk") > 0 Then
            sunimpexScore = sunimpexScore + 50
            signals = signals & "body-sunimpex-febrk "
          End If
          
          If Len(awb) >= 4 Then
            If InStr(subj, LCase(awb)) > 0 And InStr(allText, "sunimpex") > 0 Then
              sunimpexScore = sunimpexScore + 40
              signals = signals & "awb-subj-sunimpex "
            End If
          End If
          
          ' ═══ NFBRK signals (explicit keywords only) ═══
          
          Dim nfbrkKeywords As Variant
          nfbrkKeywords = Array("nfbrk", "own cha", "apna cha", _
                                "self clearance", "direct clearance", _
                                "our broker", "customer cha", "my cha")
          Dim kw As Variant
          For Each kw In nfbrkKeywords
            If InStr(allText, kw) > 0 Then
              nfbrkScore = nfbrkScore + 100
              signals = signals & "body-" & Replace(kw, " ", "-") & " "
              Exit For
            End If
          Next kw
          
          If InStr(subj, "nfbrk") > 0 Then
            nfbrkScore = nfbrkScore + 80
            signals = signals & "subj-nfbrk "
          End If
          
          If matchCount >= 500 Then Exit For
        End If
      End If
    Next item
    
    ' Early exit once any score crosses threshold
    If jeenaScore >= THRESHOLD Or sunimpexScore >= THRESHOLD Or nfbrkScore >= THRESHOLD Then
      Exit For
    End If
  Next fld
  
  ' Determine winner: must cross threshold and beat all others
  If jeenaScore >= THRESHOLD And jeenaScore > sunimpexScore And jeenaScore >= nfbrkScore Then
    outClearance = "febrk-jeena"
    outBroker = "Jeena"
    outSource = signals
  ElseIf sunimpexScore >= THRESHOLD And sunimpexScore > jeenaScore And sunimpexScore >= nfbrkScore Then
    outClearance = "febrk-sunimpex"
    outBroker = "Sunimpex"
    outSource = signals
  ElseIf nfbrkScore >= THRESHOLD And nfbrkScore > jeenaScore And nfbrkScore > sunimpexScore Then
    outClearance = "nfbrk"
    outBroker = ""
    outSource = signals
  End If
  
  outCount = matchCount
End Sub

'===========================================================
' Collect ALL folders recursively into a flat collection
' Searches: Inbox, Sent Items, Drafts, subfolders, etc.
'===========================================================
Private Sub CollectAllFolders(ByVal parentFolder As Object, _
                              ByRef folderList As Collection)
  On Error Resume Next
  Dim fld As Object
  For Each fld In parentFolder.Folders
    ' Skip special system folders
    If Left(fld.Name, 1) <> "%" And fld.Name <> "Suggested Contacts" Then
      folderList.Add fld
      CollectAllFolders fld, folderList
    End If
  Next fld
  On Error GoTo 0
End Sub

'===========================================================
' Check if an email is related to a company (by name or AWB)
'===========================================================
Private Function EmailMatchesCompany(ByVal mail As Object, _
                                     ByRef searchTerms As Variant, _
                                     ByVal awb As String) As Boolean
  Dim haystack As String
  haystack = LCase(mail.Subject & " " & mail.Body & " " & mail.To & " " & mail.CC)
  
  ' Check AWB number first (strong signal)
  If Len(awb) >= 4 Then
    If InStr(haystack, LCase(awb)) > 0 Then
      EmailMatchesCompany = True
      Exit Function
    End If
  End If
  
  ' Check company name terms
  Dim i As Long
  For i = LBound(searchTerms) To UBound(searchTerms)
    If Len(searchTerms(i)) >= 3 Then
      If InStr(haystack, LCase(searchTerms(i))) > 0 Then
        EmailMatchesCompany = True
        Exit Function
      End If
    End If
  Next i
  
  EmailMatchesCompany = False
End Function

'===========================================================
' Extract meaningful search terms from company name
' Ignores common suffixes (PVT, LTD, LIMITED, etc.)
'===========================================================
Private Function GetSearchTerms(ByVal companyName As String) As Variant
  Dim name As String
  name = Trim(companyName)
  
  ' Remove common legal suffixes
  name = Replace(name, "PVT LTD", "")
  name = Replace(name, "PVT. LTD.", "")
  name = Replace(name, "PRIVATE LIMITED", "")
  name = Replace(name, "LIMITED", "")
  name = Replace(name, "LTD", "")
  name = Replace(name, "PLC", "")
  name = Replace(name, "LLC", "")
  name = Replace(name, "INC", "")
  name = Replace(name, "CORPORATION", "")
  name = Replace(name, "CORP", "")
  name = Replace(name, " CO ", " ")
  name = Replace(name, " CO.", " ")
  name = Replace(name, ", CO", "")
  name = Replace(name, " (INDIA)", "")
  name = Replace(name, "*I/B*", "")
  name = Replace(name, "#N/A", "")
  name = Replace(name, "&", " ")
  
  While InStr(name, "  ") > 0
    name = Replace(name, "  ", " ")
  Wend
  name = Trim(name)
  
  Dim words As Variant
  words = Split(name, " ")
  
  Dim result() As String
  Dim count As Long
  count = 0
  ReDim result(0 To UBound(words))
  
  Dim i As Long
  Dim word As String
  For i = LBound(words) To UBound(words)
    word = Trim(words(i))
    If Len(word) >= 3 And Not IsStopWord(word) Then
      result(count) = word
      count = count + 1
    End If
  Next i
  
  If count = 0 Then
    ReDim result(0 To 0)
    If Len(name) >= 3 Then
      result(0) = Left(name, 3)
      count = 1
    End If
  End If
  
  ReDim Preserve result(0 To count - 1)
  GetSearchTerms = result
End Function

'===========================================================
' Common words to ignore when searching
'===========================================================
Private Function IsStopWord(ByVal word As String) As Boolean
  Dim stopWords As Variant
  stopWords = Array("THE", "AND", "FOR", "THIS", "WITH", "FROM", "THAT", _
                    "ARE", "WAS", "WERE", "HAS", "HAVE", "HAD", "NOT", _
                    "BUT", "ITS", "ALL", "CAN", "WILL", "YOU", "YOUR")
  
  Dim w As String
  w = UCase(word)
  
  Dim i As Long
  For i = LBound(stopWords) To UBound(stopWords)
    If w = stopWords(i) Then
      IsStopWord = True
      Exit Function
    End If
  Next i
  
  IsStopWord = False
End Function

'===========================================================
' Write result to Excel sheet
'===========================================================
Private Sub WriteResult(ByVal ws As Worksheet, _
                        ByVal rowNum As Long, _
                        ByVal clearanceType As String, _
                        ByVal brokerName As String)
  On Error Resume Next
  Select Case clearanceType
    Case "nfbrk": ws.Cells(rowNum, COL_OUTPUT).Value = "NFBRK"
    Case "febrk-jeena": ws.Cells(rowNum, COL_OUTPUT).Value = "FEBRK-Jeena"
    Case "febrk-sunimpex": ws.Cells(rowNum, COL_OUTPUT).Value = "FEBRK-Sunimpex"
    Case Else: ws.Cells(rowNum, COL_OUTPUT).Value = ""
  End Select
  
  If Len(brokerName) > 0 Then
    ws.Cells(rowNum, COL_BROKER).Value = brokerName
  ElseIf Len(clearanceType) = 0 Then
    ws.Cells(rowNum, COL_BROKER).Value = ""
  End If
  On Error GoTo 0
End Sub

'===========================================================
' Write summary to a new sheet
'===========================================================
Private Sub WriteSummary(ByVal srcWs As Worksheet, _
                         ByVal nfbrkCount As Long, _
                         ByVal jeenaCount As Long, _
                         ByVal sunimpexCount As Long, _
                         ByVal notFoundCount As Long, _
                         ByRef results As Object)
  Dim wb As Workbook
  Set wb = srcWs.Parent
  
  Dim ws As Worksheet
  On Error Resume Next
  Set ws = wb.Sheets("Clearance Results")
  If ws Is Nothing Then
    Set ws = wb.Sheets.Add(After:=srcWs)
    ws.Name = "Clearance Results"
  Else
    ws.Cells.Clear
  End If
  On Error GoTo 0
  
  ws.Cells(1, 1).Value = "Clearance Type Detection Results"
  ws.Range("1:1").Font.Bold = True
  ws.Range("1:1").Font.Size = 14
  
  ws.Cells(3, 1).Value = "Metric"
  ws.Cells(3, 2).Value = "Count"
  ws.Range("3:3").Font.Bold = True
  ws.Rows(3).Interior.Color = RGB(220, 230, 241)
  
  ws.Cells(4, 1).Value = "Total Companies"
  ws.Cells(4, 2).Value = nfbrkCount + jeenaCount + sunimpexCount + notFoundCount
  
  ws.Cells(5, 1).Value = "NFBRK (own CHA — from Outlook history)"
  ws.Cells(5, 2).Value = nfbrkCount
  
  ws.Cells(6, 1).Value = "FEBRK-Jeena"
  ws.Cells(6, 2).Value = jeenaCount
  
  ws.Cells(7, 1).Value = "FEBRK-Sunimpex"
  ws.Cells(7, 2).Value = sunimpexCount
  
  ws.Cells(8, 1).Value = "NOT FOUND (needs AI call / web platform)"
  ws.Cells(8, 2).Value = notFoundCount
  If notFoundCount > 0 Then
    ws.Cells(8, 2).Font.Color = RGB(200, 0, 0)
    ws.Cells(8, 2).Font.Bold = True
  End If
  
  ' Detailed breakdown
  If results.Count > 0 Then
    ws.Cells(10, 1).Value = "Company"
    ws.Cells(10, 2).Value = "Clearance Type"
    ws.Cells(10, 3).Value = "Broker"
    ws.Cells(10, 4).Value = "Source"
    ws.Cells(10, 5).Value = "Emails"
    ws.Range("10:10").Font.Bold = True
    ws.Rows(10).Interior.Color = RGB(220, 230, 241)
    
    Dim r As Long
    r = 11
    Dim key As Variant
    Dim parts As Variant
    
    For Each key In results.Keys
      parts = Split(results(key), "|")
      ' parts(0)=clearanceType, parts(1)=brokerName, parts(2)=source, parts(3)=matchedCount
      
      ws.Cells(r, 1).Value = key
      Select Case parts(0)
        Case "nfbrk": ws.Cells(r, 2).Value = "NFBRK"
        Case "febrk-jeena": ws.Cells(r, 2).Value = "FEBRK-Jeena"
        Case "febrk-sunimpex": ws.Cells(r, 2).Value = "FEBRK-Sunimpex"
        Case Else: ws.Cells(r, 2).Value = parts(0)
      End Select
      ws.Cells(r, 3).Value = parts(1)
      ws.Cells(r, 4).Value = parts(2)
      ws.Cells(r, 5).Value = CLng(parts(3))
      r = r + 1
    Next key
    
    ws.Columns("A:E").AutoFit
  End If
  
  ws.Columns("A:E").AutoFit
  ws.Activate
End Sub

'===========================================================
' Outlook helper: start Outlook
'===========================================================
Private Function StartOutlook(ByRef olApp As Object, ByRef olNS As Object) As Boolean
  On Error Resume Next
  Set olApp = GetObject(, "Outlook.Application")
  If olApp Is Nothing Then
    Set olApp = CreateObject("Outlook.Application")
  End If
  On Error GoTo 0
  
  If olApp Is Nothing Then
    MsgBox "Could not start Outlook. Make sure Outlook is running.", vbExclamation
    StartOutlook = False
    Exit Function
  End If
  
  Set olNS = olApp.GetNamespace("MAPI")
  StartOutlook = True
End Function

'===========================================================
' Get sheet by name
'===========================================================
Private Function GetSheet(ByVal name As String) As Worksheet
  On Error Resume Next
  Set GetSheet = ThisWorkbook.Sheets(name)
  On Error GoTo 0
End Function

'===========================================================
' Convert column number to letter (e.g., 4 -> "D")
'===========================================================
Private Function ColLetter(ByVal colNum As Long) As String
  If colNum <= 26 Then
    ColLetter = Chr(64 + colNum)
  Else
    ColLetter = Chr(64 + Int((colNum - 1) / 26)) & Chr(65 + ((colNum - 1) Mod 26))
  End If
End Function
