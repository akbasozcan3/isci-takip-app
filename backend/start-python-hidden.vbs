Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "python """ & WScript.Arguments(0) & """", 0, False
Set WshShell = Nothing

