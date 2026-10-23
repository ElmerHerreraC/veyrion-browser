Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
root = files.GetParentFolderName(files.GetParentFolderName(WScript.ScriptFullName))
shell.CurrentDirectory = root
result = shell.Run("node """ & root & "\tools\launch.mjs""", 0, True)
If result <> 0 Then MsgBox "Veyrion no está disponible todavía. Instala Veyrion-Setup-x64.exe cuando termine la compilación. Este acceso no abre Brave.", 48, "Veyrion"
