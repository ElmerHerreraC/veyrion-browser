param([string]$BuildRoot = 'D:\VeyrionBuild', [int[]]$WaitForProcess = @(), [switch]$ResumeCompilation, [switch]$ResumeDistribution)
$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$source = Join-Path $BuildRoot 'src\brave'
$artifactDir = Join-Path $project 'artifacts'
[IO.Directory]::CreateDirectory($artifactDir) | Out-Null
$statePath = Join-Path $artifactDir 'native-status.json'
$stage = 'preflight'
function Set-Stage([string]$Name,[string]$Status='running',[string]$Detail='') {
  $script:stage = $Name
  @{ stage=$Name; status=$Status; detail=$Detail; updatedAt=[DateTime]::UtcNow.ToString('o'); buildRoot=$BuildRoot } | ConvertTo-Json | Set-Content -LiteralPath $statePath
  Write-Output "[$Name] $Status $Detail"
}
function Require-Success([string]$Operation) { if ($LASTEXITCODE -ne 0) { throw "$Operation terminó con código $LASTEXITCODE" } }
$transcript = Join-Path $artifactDir ('native-build-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.log')
Start-Transcript -LiteralPath $transcript | Out-Null
try {
  if ($WaitForProcess.Count -gt 0) {
    Set-Stage 'waiting-for-prerequisites' 'running' 'Esperando procesos de dependencias y SDK iniciados en esta sesión.'
    foreach ($processId in $WaitForProcess) { Wait-Process -Id $processId -ErrorAction SilentlyContinue }
  }
  $env:VEYRION_BUILD_ROOT = $BuildRoot
  $env:DEPOT_TOOLS_WIN_TOOLCHAIN = '0'
  $env:PYTHONUNBUFFERED = '1'
  # Preserve the reviewed local CIPD exclusion fix during this build.
  $env:DEPOT_TOOLS_UPDATE = '0'
  $vswhere = Join-Path ${env:ProgramFiles(x86)} 'Microsoft Visual Studio\Installer\vswhere.exe'
  $visualStudio = & $vswhere -latest -products '*' -version '[18.0,19.0)' -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 Microsoft.VisualStudio.Component.VC.ATLMFC -property installationPath
  if (!$visualStudio) { throw 'No se encontró Visual Studio 2026 con C++ y ATL/MFC.' }
  $env:vs2026_install = $visualStudio.Trim()
  # Keep checkout settings scoped to this build and its child Git processes.
  $env:GIT_CONFIG_COUNT = '4'
  $env:GIT_CONFIG_KEY_0 = 'checkout.workers'
  $env:GIT_CONFIG_VALUE_0 = '4'
  $env:GIT_CONFIG_KEY_1 = 'core.longpaths'
  $env:GIT_CONFIG_VALUE_1 = 'true'
  $env:GIT_CONFIG_KEY_2 = 'core.autocrlf'
  $env:GIT_CONFIG_VALUE_2 = 'false'
  $env:GIT_CONFIG_KEY_3 = 'core.filemode'
  $env:GIT_CONFIG_VALUE_3 = 'false'
  # Reuse the downloaded dependency cache; import files onto the build SSD.
  if (Test-Path -LiteralPath 'E:\.pnpm-store') {
    $workspacePath = Join-Path $source 'pnpm-workspace.yaml'
    $workspace = Get-Content -LiteralPath $workspacePath -Raw
    if ($workspace -notmatch '(?m)^storeDir:') {
      Add-Content -LiteralPath $workspacePath -Value "`n# Local Veyrion build cache.`nstoreDir: 'E:/.pnpm-store'`npackageImportMethod: copy"
    }
  }
  Set-Stage 'preflight'
  & node (Join-Path $PSScriptRoot 'build.mjs') check
  Require-Success 'Requisitos'
  Set-Location -LiteralPath $source
  if ($ResumeCompilation -or $ResumeDistribution) {
    $upstream = Get-Content -LiteralPath (Join-Path $project 'config\upstream.json') -Raw | ConvertFrom-Json
    $chromiumHead = & git -C (Join-Path $BuildRoot 'src') rev-parse HEAD
    Require-Success 'Referencia de Chromium'
    if ($chromiumHead.Trim() -ne $upstream.chromiumCommit -or !(Test-Path -LiteralPath (Join-Path $BuildRoot 'src\out\Static\args.gn'))) {
      throw 'No hay una compilación preparada de la versión fijada para reanudar.'
    }
  } else {
  Set-Stage 'dependencies'
  & pnpm.cmd install --frozen-lockfile
  Require-Success 'Dependencias'
  Set-Stage 'chromium-sync'
  & node (Join-Path $PSScriptRoot 'configure-native.mjs') $source
  Require-Success 'Configuración de sincronización'
  $upstream = Get-Content -LiteralPath (Join-Path $project 'config\upstream.json') -Raw | ConvertFrom-Json
  if (Test-Path -LiteralPath (Join-Path $BuildRoot 'src\.git')) {
    & git -C (Join-Path $BuildRoot 'src') config --replace-all remote.origin.fetch "+refs/tags/$($upstream.chromiumTag):refs/tags/$($upstream.chromiumTag)"
    Require-Success 'Versión fijada de Chromium'
    # gclient resolves origin/HEAD even for an unmanaged solution. A local
    # shallow checkout has no default-branch ref; use its explicit pinned ref
    # to avoid a network query for the unrelated moving upstream branch.
    & git -C (Join-Path $BuildRoot 'src') update-ref refs/remotes/origin/veyrion-pinned $upstream.chromiumCommit
    Require-Success 'Referencia local de Chromium'
    & git -C (Join-Path $BuildRoot 'src') symbolic-ref refs/remotes/origin/HEAD refs/remotes/origin/veyrion-pinned
    Require-Success 'HEAD local de Chromium'
  }
  # Brave's documented workaround keeps the already pinned unmanaged Chromium
  # checkout from being fetched as all remote branches by gclient --revision.
  & pnpm.cmd run sync --init --no-history --with_issue_44921
  Require-Success 'Sincronización Chromium'
  }
  if (!$ResumeDistribution) {
  Set-Stage 'native-integration'
  & node (Join-Path $PSScriptRoot 'brand-native.mjs') $source
  Require-Success 'Identidad nativa'
  & node (Join-Path $PSScriptRoot 'integrate-native.mjs') $source
  Require-Success 'Inicio integrado'
  Set-Stage 'compile'
  & node (Join-Path $PSScriptRoot 'build.mjs') build
  Require-Success 'Compilación Static'
  }
  Set-Stage 'distribution'
  $flags = Get-Content -LiteralPath (Join-Path $project 'config\build-flags.json') -Raw | ConvertFrom-Json
  $gn = @()
  foreach ($property in $flags.PSObject.Properties) {
    $value = if ($property.Value -is [bool]) { $property.Value.ToString().ToLowerInvariant() } else { [string]$property.Value }
    $gn += @('--gn',"$($property.Name):$value")
  }
  # Build the official runtime archive; our own Inno installer replaces Brave's
  # installer and does not need the separate debug-symbol distribution.
  & pnpm.cmd run build Static --target=brave:create_dist_zips --skip_signing @gn
  Require-Success 'Distribución'
  Set-Stage 'prepare-payload'
  $payload = & (Join-Path $PSScriptRoot 'prepare-payload.ps1') -DistributionDir (Join-Path $BuildRoot 'src\out\Static\dist')
  & (Join-Path $PSScriptRoot 'configure-sandbox-access.ps1') -InstallDir $payload
  $env:NEBULA_BROWSER_EXE = Join-Path $payload 'veyrion.exe'
  $env:VEYRION_NATIVE_VERIFY = '1'
  Set-Stage 'native-verification'
  & node (Join-Path $PSScriptRoot 'verify.mjs')
  Require-Success 'Prueba del navegador propio'
  Set-Stage 'extension-verification'
  $env:VEYRION_TEST_EXTENSIONS = '1'
  & node (Join-Path $PSScriptRoot 'verify.mjs')
  Remove-Item Env:VEYRION_TEST_EXTENSIONS
  Require-Success 'Prueba de extensión independiente'
  Set-Stage 'home-verification'
  $env:VEYRION_HOME_NATIVE = '1'
  & node (Join-Path $PSScriptRoot 'verify-home.mjs')
  Require-Success 'Inicio, fondo local y pausa automática'
  Remove-Item Env:VEYRION_HOME_NATIVE
  Set-Stage 'miniplayer-verification'
  & node (Join-Path $PSScriptRoot 'verify-pip.mjs')
  Require-Success 'Minirreproductor automático con vídeo local'
  Set-Stage 'installer'
  & (Join-Path $PSScriptRoot 'package-native.ps1') -PayloadDir $payload
  Require-Success 'Instalador'
  & node (Join-Path $PSScriptRoot 'sign-update.mjs')
  Require-Success 'Manifiesto de actualización firmado'
  $setup = Join-Path $project 'dist\Veyrion-Setup-x64.exe'
  $hash = Get-FileHash -LiteralPath $setup -Algorithm SHA256
  $hash.Hash | Set-Content -LiteralPath "$setup.sha256"
  Set-Stage 'installation-verification'
  & (Join-Path $PSScriptRoot 'verify-install.ps1') -AllowUpgrade
  Require-Success 'Prueba de instalación'
  Set-Stage 'installer-verified' 'complete' $setup
} catch {
  Set-Stage $stage 'failed' $_.Exception.Message
  Write-Error $_
  exit 1
} finally { Stop-Transcript | Out-Null }
