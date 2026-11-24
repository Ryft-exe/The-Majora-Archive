Option Explicit

Dim fso, shell, here, bun, logDir, logFile, cmd, code, log
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")

here = fso.GetParentFolderName(WScript.ScriptFullName)
bun = shell.ExpandEnvironmentStrings("%USERPROFILE%") & "\bin\bun.exe"
logDir = fso.BuildPath(here, "logs")
If Not fso.FolderExists(logDir) Then fso.CreateFolder(logDir)
logFile = fso.BuildPath(logDir, "helper.log")

If Not fso.FileExists(bun) Then
  Set log = fso.OpenTextFile(logFile, 8, True)
  log.WriteLine "[" & Now & "] bun.exe not found at " & bun
  log.Close
  WScript.Quit 1
End If

shell.CurrentDirectory = here
cmd = "cmd /c " & Chr(34) & Chr(34) & bun & Chr(34) & " run start >> " & Chr(34) & logFile & Chr(34) & " 2>&1" & Chr(34)

Set log = fso.OpenTextFile(logFile, 8, True)
log.WriteLine "[" & Now & "] starting Happy Mask Salesman"
log.Close

Do
  code = shell.Run(cmd, 0, True)
  If code = 0 Then Exit Do
  WScript.Sleep 10000
Loop
