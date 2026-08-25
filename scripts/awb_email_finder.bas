Attribute VB_Name = "AWBEmailFinder"
Option Explicit

'===========================================================
' AWB Email Finder — Outlook Email Search by AWB Number
' ==========================================================
' PURPOSE:
'   Search selected Outlook folders for emails mentioning
'   specific AWB numbers within a date range. Exports FULL
'   email body + Subject/To/CC/From/Date/Folder so the data
'   can be used to train the RAG / email-classifier model.
'
' ─── SETUP (one time) ───
'   Step 1: Open the Excel workbook you want to use
'   Step 2: Press Alt+F11 to open the VBA editor
'   Step 3: Go to File → Import File → select this .bas file
'   Step 4: Close the VBA editor (Alt+Q)
'   Step 5: If you see a security warning, enable macros
'
' ─── DAILY USE (after setup) ───
'   Step 1: Press Alt+F8, select "ShowAWBEmailFinder", click Run
'           → A new sheet "AWB Email Finder" is created
'   Step 2: Enter START DATE in cell B3 (e.g., 01-Jul-2026)
'   Step 3: Enter END DATE in cell E3 (e.g., 28-Jul-2026)
'   Step 4: Paste AWB numbers in column A starting from row 6
'           (one AWB per row, no header needed)
'   Step 5: Click the "Refresh Folders" button (Step 1)
'           → All Outlook folders appear in columns G-H
'   Step 6: In column H, type "Y" next to the folders you want
'           to search and "N" (or leave blank) to skip them.
'           Inbox and Sent Items are pre-marked "Y".
'   Step 7: Click the "Run Search" button (Step 2)
'           → Progress appears in the status bar
'           → Results (FULL body) appear in "Search Results"
'
' ─── OUTPUT ("Search Results" sheet) ───
'   Column A: AWB number that was found
'   Column B: Email Subject line
'   Column C: To (all recipients)
'   Column D: CC (all CC'd recipients)
'   Column E: Body (FULL text — for RAG training data)
'   Column F: From (sender email address)
'   Column G: Received date and time
'   Column H: Full folder path (e.g., Inbox\Customer\ABC Corp)
'
' ─── TIPS ───
'   - Run with Outlook already open for fastest results
'   - Select only the folders you need (customer/archive/sent)
'     with Y/N in column H — fewer folders = faster scan
'   - Each selected folder is scanned ONCE; all AWBs are
'     checked in one pass (fast even for large folders)
'   - Body is written in full. Excel caps a single cell at
'     ~32,000 characters (very large emails are cut at that).
'===========================================================

' ─── CONFIGURATION ───
Private Const INPUT_SHEET As String = "AWB Email Finder"
Private Const RESULTS_SHEET As String = "Search Results"
Private Const BODY_MAX_CHARS As Long = 30000
Private Const MAX_MATCHES As Long = 10000
Private Const FOLDER_START_ROW As Long = 6
Private Const AWB_START_ROW As Long = 6
' ─────────────────────

'===========================================================
' MAIN ENTRY POINT — Run from Alt+F8
'===========================================================
Public Sub ShowAWBEmailFinder()
  Dim ws As Worksheet
  Set ws = GetSheet(INPUT_SHEET)
  
  If ws Is Nothing Then
    Set ws = ThisWorkbook.Sheets.Add(After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.Count))
    ws.Name = INPUT_SHEET
    SetupSheet ws
  Else
    ' Remove any old buttons (they may have stale macro references
    ' from a previously saved workbook name) and recreate them.
    On Error Resume Next
    Dim i As Long
    For i = ws.Buttons.Count To 1 Step -1
      ws.Buttons(i).Delete
    Next i
    On Error GoTo 0
    
    AddButton ws, "K3", "RefreshFolderList", "Refresh Folders"
    AddButton ws, "K5", "RunSearch", "Run Search"
    
    ws.Activate
  End If
End Sub

'===========================================================
' Setup the input sheet on first run
'===========================================================
Private Sub SetupSheet(ByVal ws As Worksheet)
  With ws
    .Cells.Clear
    
    ' Title
    .Range("A1").Value = "AWB EMAIL FINDER"
    .Range("A1").Font.Bold = True
    .Range("A1").Font.Size = 16
    
    ' Date inputs
    .Range("A3").Value = "Start Date:"
    .Range("A3").Font.Bold = True
    .Range("B3").NumberFormat = "dd-mmm-yyyy"
    .Range("B3").Value = Date - 7
    .Range("D3").Value = "End Date:"
    .Range("D3").Font.Bold = True
    .Range("E3").NumberFormat = "dd-mmm-yyyy"
    .Range("E3").Value = Date
    
    ' AWB list header
    .Range("A5").Value = "AWB Numbers (paste below, one per row):"
    .Range("A5").Font.Bold = True
    
    ' Folder selection header
    .Range("G4").Value = "Select Folders to Search"
    .Range("G4").Font.Bold = True
    .Range("G4").Font.Size = 12
    .Range("G5").Value = "Folder Name (click Refresh Folders to list)"
    .Range("G5").Font.Bold = True
    .Range("H5").Value = "Search? (Y/N)"
    .Range("H5").Font.Bold = True
    .Range("I5").Value = "Type Y to search, N/blank to skip"
    .Range("I5").Font.Italic = True
    .Range("I5").Font.Color = RGB(100, 100, 100)
    
    ' Buttons
    .Range("J3").Value = "Step 1:"
    .Range("J3").Font.Bold = True
    .Range("K3").Value = "Refresh Folders"
    .Range("K3").Font.Color = RGB(255, 255, 255)
    .Range("K3").Interior.Color = RGB(30, 41, 59)
    .Range("K3").HorizontalAlignment = xlCenter
    
    .Range("J5").Value = "Step 2:"
    .Range("J5").Font.Bold = True
    .Range("K5").Value = "Run Search"
    .Range("K5").Font.Color = RGB(255, 255, 255)
    .Range("K5").Interior.Color = RGB(5, 150, 105)
    .Range("K5").HorizontalAlignment = xlCenter
    
    ' Add buttons as Form Controls
    AddButton ws, "K3", "RefreshFolderList", "Refresh Folders"
    AddButton ws, "K5", "RunSearch", "Run Search"
    
    .Columns("A").ColumnWidth = 20
    .Columns("B:E").ColumnWidth = 15
    .Columns("G").ColumnWidth = 50
    .Columns("H").ColumnWidth = 15
    .Columns("I").ColumnWidth = 35
    .Columns("J:K").ColumnWidth = 16
    
    ' Highlight important cells
    .Range("B3:E3").Interior.Color = RGB(255, 255, 200)
    .Range("A6:A200").Interior.Color = RGB(240, 240, 240)
    .Range("H6:H500").Interior.Color = RGB(230, 255, 230)
    
    .Activate
  End With
  
  MsgBox "Sheet setup complete!" & vbCrLf & vbCrLf & _
         "1. Enter Start Date in B3" & vbCrLf & _
         "2. Enter End Date in E3" & vbCrLf & _
         "3. Paste AWB numbers in column A (from row 6)" & vbCrLf & _
         "4. Click 'Refresh Folders' to list Outlook folders" & vbCrLf & _
         "5. Mark Y next to folders to search" & vbCrLf & _
         "6. Click 'Run Search'", vbInformation, "AWB Email Finder"
End Sub

'===========================================================
' Add a Form Control button to the sheet
'===========================================================
Private Sub AddButton(ByVal ws As Worksheet, ByVal cellRef As String, _
                      ByVal macroName As String, ByVal btnText As String)
  On Error Resume Next
  Dim rng As Range
  Set rng = ws.Range(cellRef)
  If rng Is Nothing Then Exit Sub
  
  Dim btn As Button
  Set btn = ws.Buttons.Add(rng.Left, rng.Top, rng.Width, rng.Height)
  If btn Is Nothing Then Exit Sub
  
  With btn
    .Caption = btnText
    .OnAction = macroName
    .Font.Bold = True
    .Font.Size = 11
    .Font.Color = RGB(255, 255, 255)
    .Interior.Color = IIf(macroName = "RefreshFolderList", RGB(30, 41, 59), RGB(5, 150, 105))
    .Placement = xlMove
    .PrintObject = False
  End With
  On Error GoTo 0
End Sub

'===========================================================
' BUTTON: Refresh Folder List
' Scans Outlook and populates folder names in column G
'===========================================================
Public Sub RefreshFolderList()
  Dim ws As Worksheet
  Set ws = GetSheet(INPUT_SHEET)
  If ws Is Nothing Then
    MsgBox "Run 'ShowAWBEmailFinder' first to set up the sheet.", vbExclamation
    Exit Sub
  End If
  
  ' Clear existing folder list (row 6 onwards)
  Dim lastRow As Long
  lastRow = ws.Cells(ws.Rows.Count, "G").End(xlUp).Row
  If lastRow >= FOLDER_START_ROW Then
    ws.Range("G" & FOLDER_START_ROW & ":I" & lastRow).ClearContents
  End If
  
  ' Connect to Outlook
  Dim olApp As Object, olNS As Object
  If Not StartOutlook(olApp, olNS) Then Exit Sub
  
  Application.DisplayStatusBar = True
  Application.StatusBar = "Scanning Outlook folders..."
  DoEvents
  
  ' Collect all folders
  Dim allFolders As Collection
  Set allFolders = New Collection
  
  Dim store As Object
  For Each store In olNS.Folders
    CollectAllFolders store, allFolders, ""
  Next store
  
  ' Write folder names to sheet
  Dim i As Long
  i = FOLDER_START_ROW
  
  Dim fld As Variant
  Dim folderPath As String
  
  For Each fld In allFolders
    folderPath = GetFolderPath(fld)
    ws.Cells(i, "G").Value = folderPath
    ws.Cells(i, "H").Value = ""
    ' Default: mark Inbox and Sent Items as Y
    If InStr(LCase(folderPath), "inbox") > 0 Or _
       InStr(LCase(folderPath), "sent items") > 0 Then
      ws.Cells(i, "H").Value = "Y"
    End If
    i = i + 1
    If i > 500 Then Exit For
  Next fld
  
  Application.StatusBar = False
  
  MsgBox "Found " & (i - FOLDER_START_ROW) & " folders." & vbCrLf & _
         "Mark Y next to folders you want to search." & vbCrLf & _
         "Inbox and Sent Items are selected by default.", _
         vbInformation, "Folder List Updated"
End Sub

'===========================================================
' BUTTON: Run Search
' Main search logic — reads inputs, scans selected folders
' ONCE each, checks ALL AWBs in one pass, writes results.
'===========================================================
Public Sub RunSearch()
  Dim ws As Worksheet
  Set ws = GetSheet(INPUT_SHEET)
  If ws Is Nothing Then
    MsgBox "Run 'ShowAWBEmailFinder' first to set up the sheet.", vbExclamation
    Exit Sub
  End If
  
  ' ─── Read inputs ───
  Dim startDate As Date, endDate As Date
  On Error Resume Next
  startDate = CDate(ws.Range("B3").Value)
  endDate = CDate(ws.Range("E3").Value)
  On Error GoTo 0
  
  If startDate = 0 Or endDate = 0 Then
    MsgBox "Please enter valid Start Date and End Date.", vbExclamation
    Exit Sub
  End If
  
  ' Read AWB list
  Dim awbs() As String
  Dim awbCount As Long
  awbCount = 0
  ReDim awbs(1 To 500)
  
  Dim r As Long
  For r = AWB_START_ROW To AWB_START_ROW + 500
    Dim cellVal As String
    ' If Excel stores the AWB as a number, format it as plain digits
    ' (prevents scientific notation like "8.01E+11")
    If IsNumeric(ws.Cells(r, "A").Value) Then
      cellVal = Format(ws.Cells(r, "A").Value, "0")
    Else
      cellVal = CStr(ws.Cells(r, "A").Value)
    End If
    cellVal = Trim(cellVal)
    If Len(cellVal) > 0 Then
      awbCount = awbCount + 1
      awbs(awbCount) = cellVal
    ElseIf r > AWB_START_ROW And awbCount > 0 Then
      Exit For
    End If
  Next r
  
  If awbCount = 0 Then
    MsgBox "Please paste AWB numbers in column A (from row " & AWB_START_ROW & ").", vbExclamation
    Exit Sub
  End If
  
  ReDim Preserve awbs(1 To awbCount)
  
  ' Read selected folders (Y in column H)
  Dim selectedFolders As Collection
  Set selectedFolders = New Collection
  
  Dim lastFolderRow As Long
  lastFolderRow = ws.Cells(ws.Rows.Count, "G").End(xlUp).Row
  
  For r = FOLDER_START_ROW To lastFolderRow
    Dim folderName As String
    Dim include As String
    folderName = Trim(CStr(ws.Cells(r, "G").Value))
    include = Trim(UCase(CStr(ws.Cells(r, "H").Value)))
    
    If Len(folderName) > 0 And (include = "Y" Or include = "YES") Then
      selectedFolders.Add folderName
    End If
  Next r
  
  If selectedFolders.Count = 0 Then
    MsgBox "No folders selected. Mark Y in column H for the folders to search, then run again.", vbExclamation
    Exit Sub
  End If
  
  ' ─── Prepare results sheet ───
  Dim wsResults As Worksheet
  Set wsResults = GetSheet(RESULTS_SHEET)
  If wsResults Is Nothing Then
    Set wsResults = ThisWorkbook.Sheets.Add(After:=ThisWorkbook.Sheets(ThisWorkbook.Sheets.Count))
    wsResults.Name = RESULTS_SHEET
  Else
    wsResults.Cells.Clear
  End If
  
  ' Headers
  wsResults.Cells(1, 1).Value = "AWB"
  wsResults.Cells(1, 2).Value = "Subject"
  wsResults.Cells(1, 3).Value = "To"
  wsResults.Cells(1, 4).Value = "CC"
  wsResults.Cells(1, 5).Value = "Body (full)"
  wsResults.Cells(1, 6).Value = "From"
  wsResults.Cells(1, 7).Value = "Received"
  wsResults.Cells(1, 8).Value = "Folder"
  wsResults.Range("1:1").Font.Bold = True
  wsResults.Rows(1).Interior.Color = RGB(220, 230, 241)
  
  ' ─── Connect to Outlook ───
  Dim olApp As Object, olNS As Object
  If Not StartOutlook(olApp, olNS) Then Exit Sub
  
  ' Build full folder collection
  Dim allFolders As Collection
  Set allFolders = New Collection
  
  Dim store As Object
  For Each store In olNS.Folders
    CollectAllFolders store, allFolders, ""
  Next store
  
  ' Build a dictionary of folder path → folder object
  Dim folderDict As Object
  Set folderDict = CreateObject("Scripting.Dictionary")
  
  Dim fldVar As Variant
  Dim fldObj As Object
  For Each fldVar In allFolders
    Set fldObj = fldVar
    folderDict(LCase(GetFolderPath(fldObj))) = fldObj
  Next fldVar
  
  ' ─── Search ───
  Application.ScreenUpdating = False
  Application.DisplayStatusBar = True
  Application.EnableEvents = False
  
  Dim outputRow As Long
  outputRow = 2
  Dim totalMatches As Long
  totalMatches = 0
  Dim searchedFolders As Long
  searchedFolders = 0
  Dim notFoundList As String
  notFoundList = ""
  
  ' Each selected folder is resolved once and scanned ONCE.
  ' All AWBs are checked in memory against each email — no
  ' re-reading of Outlook items per AWB.
  Dim selFolder As Variant
  For Each selFolder In selectedFolders
    Set fldObj = ResolveFolder(folderDict, CStr(selFolder))
    If fldObj Is Nothing Then
      If Len(notFoundList) > 0 Then notFoundList = notFoundList & vbCrLf
      notFoundList = notFoundList & CStr(selFolder)
    Else
      Application.StatusBar = "Searching: " & GetFolderPath(fldObj)
      DoEvents
      SearchFolderForAllAWBs fldObj, awbs, awbCount, startDate, endDate, _
        wsResults, outputRow, totalMatches
      searchedFolders = searchedFolders + 1
      If totalMatches >= MAX_MATCHES Then Exit For
    End If
  Next selFolder
  
  Application.ScreenUpdating = True
  Application.EnableEvents = True
  Application.StatusBar = False
  
  ' Format results
  If totalMatches > 0 Then
    wsResults.Columns("A:H").AutoFit
    ' Cap column widths for readability
    If wsResults.Columns("B").ColumnWidth > 60 Then wsResults.Columns("B").ColumnWidth = 60
    If wsResults.Columns("C").ColumnWidth > 40 Then wsResults.Columns("C").ColumnWidth = 40
    If wsResults.Columns("D").ColumnWidth > 40 Then wsResults.Columns("D").ColumnWidth = 40
    If wsResults.Columns("E").ColumnWidth > 90 Then wsResults.Columns("E").ColumnWidth = 90
    wsResults.Activate
    
    MsgBox "Search complete!" & vbCrLf & vbCrLf & _
           "AWB numbers searched: " & awbCount & vbCrLf & _
           "Folders searched:     " & searchedFolders & vbCrLf & _
           "Emails found:         " & totalMatches & vbCrLf & vbCrLf & _
           "Full bodies in sheet: " & RESULTS_SHEET, _
           vbInformation, "AWB Email Finder"
  Else
    Dim extraMsg As String
    extraMsg = ""
    If Len(notFoundList) > 0 Then
      extraMsg = vbCrLf & vbCrLf & "Folders NOT found in Outlook:" & vbCrLf & notFoundList
    End If
    MsgBox "Search complete. No matching emails found for the given AWB numbers and date range." & extraMsg, _
           vbInformation, "AWB Email Finder"
  End If
  
  ' Always warn if some selected folders could not be resolved
  If Len(notFoundList) > 0 And totalMatches > 0 Then
    MsgBox "Note: these selected folders could not be found in Outlook and were skipped:" & vbCrLf & notFoundList, _
           vbExclamation, "AWB Email Finder"
  End If
End Sub

'===========================================================
' Resolve a folder path (from column G) to an Outlook folder
' Exact match first, then partial path match.
'===========================================================
Private Function ResolveFolder(ByRef dict As Object, ByVal path As String) As Object
  Dim key As String
  key = LCase(Trim(path))
  If Len(key) = 0 Then Exit Function
  
  On Error Resume Next
  If dict.Exists(key) Then
    Set ResolveFolder = dict(key)
    On Error GoTo 0
    Exit Function
  End If
  
  ' Partial path match (in case path format differs slightly)
  Dim fKey As Variant
  For Each fKey In dict.Keys
    If InStr(fKey, key) > 0 Or InStr(key, fKey) > 0 Then
      Set ResolveFolder = dict(fKey)
      On Error GoTo 0
      Exit Function
    End If
  Next fKey
  On Error GoTo 0
End Function

'===========================================================
' Scan a single folder ONCE for ALL AWBs.
' Reads each mail's subject/body once, checks every AWB
' in memory, writes a result row per match.
'===========================================================
Private Sub SearchFolderForAllAWBs(ByVal folder As Object, _
                                   ByRef awbs() As String, _
                                   ByVal awbCount As Long, _
                                   ByVal startDate As Date, _
                                   ByVal endDate As Date, _
                                   ByVal wsResults As Worksheet, _
                                   ByRef outputRow As Long, _
                                   ByRef totalMatches As Long)
  On Error GoTo SearchErr
  
  Dim items As Object
  Set items = folder.Items
  
  Dim folderPath As String
  folderPath = GetFolderPath(folder)
  
  Dim item As Object
  For Each item In items
    If TypeName(item) = "MailItem" Then
      ' Filter by date in code (100% reliable regardless of locale)
      If item.ReceivedTime >= startDate And item.ReceivedTime < (endDate + 1) Then
        ' Read the message content ONCE, then check all AWBs in memory
        Dim subjectText As String
        Dim bodyText As String
        subjectText = item.Subject
        bodyText = item.Body
        
        Dim i As Long
        For i = 1 To awbCount
          If ContainsAWBInText(subjectText, bodyText, awbs(i)) Then
            WriteResult wsResults, outputRow, item, awbs(i), folderPath, bodyText
            outputRow = outputRow + 1
            totalMatches = totalMatches + 1
            If totalMatches >= MAX_MATCHES Then Exit Sub
          End If
        Next i
      End If
    End If
  Next item
  
  Exit Sub

SearchErr:
  ' Swallow per-folder errors so one bad folder doesn't kill the run
End Sub

'===========================================================
' Pure string check: does the email text contain this AWB?
' Fast — operates on already-read strings, no Outlook calls.
'===========================================================
Private Function ContainsAWBInText(ByVal subject As String, _
                                   ByVal body As String, _
                                   ByVal awb As String) As Boolean
  ' Remove spaces so "8010 0001 2345" and "801000012345" match the same way
  Dim awbClean As String
  awbClean = Trim(Replace(awb, " ", ""))
  
  If Len(awbClean) < 4 Then
    ContainsAWBInText = False
    Exit Function
  End If
  
  ' Normal haystack: text as-is (lowercase)
  Dim combined As String
  combined = subject & " " & body
  
  ' Compact haystack: all spaces removed (catches "8010 0001" style)
  Dim haystack As String
  haystack = LCase(combined)
  Dim compact As String
  compact = LCase(Replace(combined, " ", ""))
  
  Dim awbLCase As String
  awbLCase = LCase(awbClean)
  
  ' Try exact match against normal and compact text
  If InStr(haystack, awbLCase) > 0 Or InStr(compact, awbLCase) > 0 Then
    ContainsAWBInText = True
    Exit Function
  End If
  
  ' Also try removing leading zeros (string-based — safe for any length)
  Dim awbTrimmed As String
  awbTrimmed = awbLCase
  Do While Len(awbTrimmed) > 1 And Left(awbTrimmed, 1) = "0"
    awbTrimmed = Mid(awbTrimmed, 2)
  Loop
  If awbTrimmed <> awbLCase And Len(awbTrimmed) >= 4 Then
    If InStr(haystack, awbTrimmed) > 0 Or InStr(compact, awbTrimmed) > 0 Then
      ContainsAWBInText = True
      Exit Function
    End If
  End If
  
  ContainsAWBInText = False
End Function

'===========================================================
' Write a matching email to the results sheet (FULL body)
'===========================================================
Private Sub WriteResult(ByVal ws As Worksheet, _
                        ByVal rowNum As Long, _
                        ByVal mail As Object, _
                        ByVal awb As String, _
                        ByVal folderPath As String, _
                        ByVal bodyText As String)
  On Error Resume Next
  
  ws.Cells(rowNum, 1).Value = awb
  ws.Cells(rowNum, 2).Value = mail.Subject
  ws.Cells(rowNum, 3).Value = mail.To
  ws.Cells(rowNum, 4).Value = mail.CC
  
  ' Write the FULL body (cap at Excel's ~32k cell limit)
  If Len(bodyText) > BODY_MAX_CHARS Then
    ws.Cells(rowNum, 5).Value = Left(bodyText, BODY_MAX_CHARS)
  Else
    ws.Cells(rowNum, 5).Value = bodyText
  End If
  
  ' From — try different sender properties
  Dim sender As String
  sender = mail.SenderEmailAddress
  If Len(sender) = 0 Then sender = mail.SentOnBehalfOfName
  If Len(sender) = 0 Then sender = mail.SenderName
  ws.Cells(rowNum, 6).Value = sender
  
  ws.Cells(rowNum, 7).Value = Format(mail.ReceivedTime, "dd-mmm-yyyy hh:mm")
  ws.Cells(rowNum, 8).Value = folderPath
  
  ' Set row text wrapping for body column
  ws.Cells(rowNum, 5).WrapText = True
  
  On Error GoTo 0
End Sub

'===========================================================
' Get full folder path (e.g. "Inbox\Customer\ABC Corp")
'===========================================================
Private Function GetFolderPath(ByVal folder As Object) As String
  Dim storeName As String
  On Error Resume Next
  storeName = folder.Store.DisplayName
  On Error GoTo 0
  
  Dim path As String
  path = folder.Name
  
  Dim parent As Object
  Set parent = folder.Parent
  
  On Error Resume Next
  Dim depth As Long
  depth = 0
  Do While depth < 20
    If parent Is Nothing Then Exit Do
    Dim t As String
    t = TypeName(parent)
    If t = "NameSpace" Or t = "Store" Then Exit Do
    path = parent.Name & "\" & path
    Set parent = parent.Parent
    depth = depth + 1
  Loop
  On Error GoTo 0
  
  If Len(storeName) > 0 Then
    GetFolderPath = storeName & "\" & path
  Else
    GetFolderPath = path
  End If
End Function

'===========================================================
' Collect ALL folders recursively into a flat collection
'===========================================================
Private Sub CollectAllFolders(ByVal parentFolder As Object, _
                              ByRef folderList As Collection, _
                              ByVal indent As String)
  On Error Resume Next
  Dim fld As Object
  For Each fld In parentFolder.Folders
    ' Skip system folders
    If Left(fld.Name, 1) <> "%" And fld.Name <> "Suggested Contacts" Then
      folderList.Add fld
      CollectAllFolders fld, folderList, indent & "  "
    End If
  Next fld
  On Error GoTo 0
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
