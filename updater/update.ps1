$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'policy.ps1')
$installDir = Split-Path -Parent $PSScriptRoot
$installedExe = Join-Path $installDir 'veyrion.exe'
$cache = Join-Path $env:LOCALAPPDATA 'Veyrion\Updates'
[IO.Directory]::CreateDirectory($cache) | Out-Null
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$mutex = New-Object Threading.Mutex($false, ('Local\VeyrionUpdate-' + $identity))
$locked = $false
function Write-UpdateStatus([string]$State, [string]$Detail) {
  @{state=$State;detail=$Detail;checkedAt=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $cache 'status.json') -Encoding UTF8
}
function Save-BoundedDownload([string]$Url, [string]$Path, [long]$Limit) {
  $request = [Net.HttpWebRequest]::Create($Url)
  $request.Timeout = 30000
  $request.ReadWriteTimeout = 30000
  $request.UserAgent = 'Veyrion-Updater'
  $response = $request.GetResponse()
  try {
    if ($response.ResponseUri.Scheme -ne 'https' -or $response.ContentLength -gt $Limit) { throw 'Unexpected update response.' }
    $inputStream = $response.GetResponseStream()
    $outputStream = [IO.File]::Create($Path)
    try {
      $buffer = New-Object byte[] 65536
      [long]$total = 0
      while (($count = $inputStream.Read($buffer,0,$buffer.Length)) -gt 0) {
        $total += $count
        if ($total -gt $Limit) { throw 'Update exceeds permitted size.' }
        $outputStream.Write($buffer,0,$count)
      }
    } finally { $outputStream.Dispose(); $inputStream.Dispose() }
  } finally { $response.Dispose() }
}
try {
  try { $locked = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $locked = $true }
  if (!$locked) { exit 0 }
  if ((Get-Item -LiteralPath $installedExe).VersionInfo.ProductName -ne 'Veyrion') { throw 'Unexpected installed product.' }
  $config = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'config.json') -Raw | ConvertFrom-Json
  if ($config.repository -cne 'ElmerHerreraC/veyrion-browser' -or $config.manifestUrl -cne 'https://github.com/ElmerHerreraC/veyrion-browser/releases/latest/download/veyrion-update.json') { throw 'Unexpected update channel.' }
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $manifestPath = Join-Path $cache 'manifest.download'
  Save-BoundedDownload $config.manifestUrl $manifestPath 20000
  $manifest = Read-UpdateManifest (Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json) $config
  if ([Version]$manifest.version -le [Version]$config.version) { Write-UpdateStatus 'current' $config.version; exit 0 }
  $installer = Join-Path $cache ('Veyrion-' + $manifest.version + '-Setup-x64.exe')
  $valid = $false
  if (Test-Path -LiteralPath $installer) {
    try { Test-UpdateInstaller $installer $manifest; $valid = $true } catch { $valid = $false }
  }
  if (!$valid) {
    Write-UpdateStatus 'downloading' $manifest.version
    $temporary = $installer + '.download'
    Save-BoundedDownload $manifest.url $temporary $manifest.size
    Test-UpdateInstaller $temporary $manifest
    Move-Item -LiteralPath $temporary -Destination $installer -Force
  }
  Write-UpdateStatus 'ready-on-close' $manifest.version
  # Never terminate the browser or discard a session to apply an update.
  while (@(Get-Process -Name veyrion -ErrorAction SilentlyContinue | Where-Object { $_.Path -ieq $installedExe }).Count -gt 0) { Start-Sleep -Seconds 5 }
  # Revalidate immediately before executing, including the anti-rollback check.
  $current = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'config.json') -Raw | ConvertFrom-Json
  if ([Version]$manifest.version -le [Version]$current.version) { exit 0 }
  Test-UpdateInstaller $installer $manifest
  $process = Start-Process -FilePath $installer -ArgumentList '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /NOCLOSEAPPLICATIONS' -PassThru -WindowStyle Hidden
  $process.WaitForExit()
  if ($process.ExitCode -ne 0) { throw ('Installer exit: ' + $process.ExitCode) }
  $current = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'config.json') -Raw | ConvertFrom-Json
  if ($current.version -cne $manifest.version) { throw 'Installed version did not advance.' }
  Write-UpdateStatus 'installed' $manifest.version
} catch { Write-UpdateStatus 'error' $_.Exception.Message; exit 1 }
finally { if ($locked) { $mutex.ReleaseMutex() }; $mutex.Dispose() }
