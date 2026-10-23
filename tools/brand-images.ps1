param([Parameter(Mandatory=$true)][string]$Source)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$project = Split-Path -Parent $PSScriptRoot
$logo = [Drawing.Image]::FromFile((Join-Path $project 'extension/icons/icon256.png'))
try {
  $files = Get-ChildItem -LiteralPath (Join-Path $Source 'app/theme') -Recurse -File -Filter '*.png' | Where-Object {
    $_.Name -match '^product_logo(?:_|\.)' -or $_.Name -match '^avatar_.*_(brave|rewards)\.png$' -or $_.Name -match '^(Small)?Logo\.png$'
  }
  foreach ($file in $files) {
    $original = [Drawing.Image]::FromFile($file.FullName)
    $width = $original.Width; $height = $original.Height
    $original.Dispose()
    $bitmap = [Drawing.Bitmap]::new($width,$height)
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    $graphics.Clear([Drawing.Color]::Transparent)
    $graphics.InterpolationMode = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $side = [Math]::Min($width,$height)
    $graphics.DrawImage($logo,0,0,$side,$side)
    if ($width -gt $height * 2) {
      $font = [Drawing.Font]::new('Segoe UI', [single]($height * 0.48), [Drawing.FontStyle]::Bold, [Drawing.GraphicsUnit]::Pixel)
      $brush = [Drawing.SolidBrush]::new([Drawing.Color]::FromArgb(190,172,255))
      $graphics.DrawString('Veyrion',$font,$brush,[single]($side + 4),[single]($height * 0.15))
      $brush.Dispose(); $font.Dispose()
    }
    $graphics.Dispose()
    $bitmap.Save($file.FullName,[Drawing.Imaging.ImageFormat]::Png)
    $bitmap.Dispose()
  }
  Write-Output "Logotipos y avatares propios: $($files.Count)"
} finally { $logo.Dispose() }

