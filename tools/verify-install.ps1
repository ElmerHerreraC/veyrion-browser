param([switch]$AllowUpgrade)
$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$setup = Join-Path $project 'dist\Veyrion-Setup-x64.exe'
$installedDir = Join-Path $env:USERPROFILE 'AppData\Local\Programs\Veyrion'
$installedExe = Join-Path $installedDir 'veyrion.exe'
if (!(Test-Path -LiteralPath $setup)) { throw 'Todavía no existe el instalador.' }
if ((Test-Path -LiteralPath $installedExe) -and !$AllowUpgrade) { throw 'Ya hay un Veyrion instalado. Revisar la actualización antes de reemplazarlo.' }
if ($AllowUpgrade -and (Test-Path -LiteralPath $installedExe)) {
  $installedProduct = (Get-Item -LiteralPath $installedExe).VersionInfo.ProductName
  if ($installedProduct -ne 'Veyrion') { throw 'La instalación existente no tiene la identidad esperada.' }
  $running = Get-CimInstance Win32_Process -Filter "Name='veyrion.exe'" | Where-Object { $_.ExecutablePath -ieq $installedExe }
  if ($running) { throw 'El instalador está preparado. Cierra Veyrion antes de ejecutar la prueba de actualización; no se cerrarán tus ventanas automáticamente.' }
}
$log = Join-Path $project 'artifacts\installer-test.log'
$arguments = '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /TASKS="desktopicon" /DIR="' + $installedDir + '" /LOG="' + $log + '"'
$process = Start-Process -FilePath $setup -ArgumentList $arguments -PassThru -WindowStyle Hidden
$process.WaitForExit()
if ($process.ExitCode -ne 0) { throw "El instalador falló: $($process.ExitCode). Revisa $log" }
$info = (Get-Item -LiteralPath $installedExe).VersionInfo
if ($info.ProductName -notmatch 'Veyrion') { throw 'El producto instalado no tiene la identidad esperada.' }
if (!(Test-Path -LiteralPath (Join-Path $installedDir 'unins000.exe'))) { throw 'No se creó el desinstalador.' }
if (!(Test-Path -LiteralPath (Join-Path $installedDir 'Veyrion.ico'))) { throw 'No se instaló el icono propio.' }
$shortcutShell = New-Object -ComObject WScript.Shell
$shortcutPath = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Veyrion.lnk'
if (!(Test-Path -LiteralPath $shortcutPath)) { throw 'No se creó el acceso de escritorio.' }
$shortcut = $shortcutShell.CreateShortcut($shortcutPath)
if ($shortcut.TargetPath -ine $installedExe -or $shortcut.Arguments) { throw 'El acceso no abre directamente el ejecutable de Veyrion.' }
if ($shortcut.IconLocation -notlike '*\Veyrion.ico*') { throw 'El acceso no tiene el icono propio.' }
$env:NEBULA_BROWSER_EXE = $installedExe
$env:VEYRION_NATIVE_VERIFY = '1'
& node (Join-Path $PSScriptRoot 'verify.mjs')
if ($LASTEXITCODE -ne 0) { throw 'Falló la prueba del navegador instalado.' }
@{ passed=$true; installedExecutable=$installedExe; productName=$info.ProductName; version=$info.ProductVersion; uninstallerPresent=$true } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $project 'artifacts\installation-verification.json')
Write-Output 'Instalación verificada. Veyrion queda instalado y disponible en el escritorio.'
