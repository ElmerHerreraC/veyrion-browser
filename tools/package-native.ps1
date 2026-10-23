param([Parameter(Mandatory=$true)][string]$PayloadDir)
$ErrorActionPreference = 'Stop'
$payload = (Resolve-Path -LiteralPath $PayloadDir).Path
$exe = Join-Path $payload 'veyrion.exe'
if (!(Test-Path -LiteralPath $exe)) { throw 'Falta el ejecutable nativo veyrion.exe.' }
$info = (Get-Item -LiteralPath $exe).VersionInfo
if ($info.ProductName -notmatch 'Veyrion') { throw 'El producto no es Veyrion. No se empaquetará un Brave renombrado.' }
foreach ($file in @('resources.pak','icudtl.dat','locales')) {
  if (!(Test-Path -LiteralPath (Join-Path $payload $file))) { throw "Distribución incompleta: $file" }
}
$compiler = @("${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe", "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe", "$env:USERPROFILE\AppData\Local\Programs\Inno Setup 6\ISCC.exe") | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (!$compiler) { throw 'Instala Inno Setup 6 desde https://jrsoftware.org/isdl.php para generar el instalador.' }
$spec = Join-Path (Split-Path -Parent $PSScriptRoot) 'installer\veyrion.iss'
& $compiler "/DPayloadDir=$payload" $spec
if ($LASTEXITCODE -ne 0) { throw 'Falló la generación del instalador.' }
$project = Split-Path -Parent $PSScriptRoot
$setup = Join-Path $project 'dist\Veyrion-Setup-x64.exe'
$version = (Get-Content -LiteralPath (Join-Path $project 'package.json') -Raw | ConvertFrom-Json).version
$builtVersion = (Get-Item -LiteralPath $setup).VersionInfo.ProductVersion.Trim()
if ($builtVersion -ne $version) { throw 'La versión del instalador no coincide con la versión del proyecto.' }
@{ version=$version; sha256=(Get-FileHash -LiteralPath $setup -Algorithm SHA256).Hash.ToLowerInvariant() } | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $project 'dist\release-build.json')
