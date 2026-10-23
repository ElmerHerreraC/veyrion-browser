$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$project = Split-Path -Parent $PSScriptRoot
$icons = Join-Path $project 'extension\icons'
[System.IO.Directory]::CreateDirectory($icons) | Out-Null
foreach ($size in @(16,32,48,128,256)) {
  $bitmap = New-Object System.Drawing.Bitmap($size,$size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.Color]::FromArgb(255,16,12,27))
  $scale = $size / 256.0
  $graphics.ScaleTransform($scale,$scale)
  $violet = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(180,145,255),22)
  $violet.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $violet.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $cyan = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(105,233,224),14)
  $cyan.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $cyan.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $graphics.DrawLines($violet,[System.Drawing.PointF[]]@([System.Drawing.PointF]::new(51,63),[System.Drawing.PointF]::new(126,201),[System.Drawing.PointF]::new(205,58)))
  $graphics.DrawLine($cyan,127,139,166,68)
  $brush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(105,233,224))
  $graphics.FillEllipse($brush,184,180,15,15)
  $bitmap.Save((Join-Path $icons "icon$size.png"),[System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose(); $bitmap.Dispose(); $violet.Dispose(); $cyan.Dispose(); $brush.Dispose()
}
$png = [System.IO.File]::ReadAllBytes((Join-Path $icons 'icon256.png'))
$stream = New-Object System.IO.MemoryStream
$writer = New-Object System.IO.BinaryWriter($stream)
$writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]1)
$writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0)
$writer.Write([uint16]1); $writer.Write([uint16]32); $writer.Write([uint32]$png.Length); $writer.Write([uint32]22); $writer.Write($png)
[System.IO.File]::WriteAllBytes((Join-Path $project 'Veyrion.ico'),$stream.ToArray())
$writer.Dispose(); $stream.Dispose()
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut((Join-Path $project 'Veyrion.lnk'))
$shortcut.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
$shortcut.Arguments = '"' + (Join-Path $project 'tools\open.vbs') + '"'
$shortcut.WorkingDirectory = $project
$shortcut.IconLocation = (Join-Path $project 'Veyrion.ico') + ',0'
$shortcut.Description = 'Abrir Veyrion con su perfil independiente'
$shortcut.Save()
