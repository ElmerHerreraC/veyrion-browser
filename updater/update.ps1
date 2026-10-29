param([switch]$Apply)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'policy.ps1')
$script:downloadVersion = $null
$installDir = Split-Path -Parent $PSScriptRoot
$installedExe = Join-Path $installDir 'veyrion.exe'
$cache = Join-Path $env:LOCALAPPDATA 'Veyrion\Updates'
[IO.Directory]::CreateDirectory($cache) | Out-Null
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$mutex = New-Object Threading.Mutex($false, ('Local\VeyrionUpdate-' + $identity))
$locked = $false
function Write-UpdateStatus([string]$State, [string]$Detail, [long]$Downloaded = 0, [long]$Total = 0) {
  $statusPath = Join-Path $cache 'status.json'
  $json = @{state=$State;detail=$Detail;downloaded=$Downloaded;total=$Total;checkedAt=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json
  [IO.File]::WriteAllText(($statusPath + '.tmp'), $json, (New-Object Text.UTF8Encoding($false)))
  Move-Item -LiteralPath ($statusPath + '.tmp') -Destination $statusPath -Force
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
      $lastProgress = [DateTime]::UtcNow
      while (($count = $inputStream.Read($buffer,0,$buffer.Length)) -gt 0) {
        $total += $count
        if ($total -gt $Limit) { throw 'Update exceeds permitted size.' }
        $outputStream.Write($buffer,0,$count)
        if ($script:downloadVersion -and ([DateTime]::UtcNow - $lastProgress).TotalMilliseconds -ge 500) {
          Write-UpdateStatus 'downloading' $script:downloadVersion $total $Limit
          $lastProgress = [DateTime]::UtcNow
        }
      }
    } finally { $outputStream.Dispose(); $inputStream.Dispose() }
  } finally { $response.Dispose() }
}
try {
  # A user click must not be discarded while the scheduled check owns the lock.
  try { $locked = $mutex.WaitOne($(if ($Apply) { 35000 } else { 0 })) } catch [Threading.AbandonedMutexException] { $locked = $true }
  if (!$locked) { exit 0 }
  if ((Get-Item -LiteralPath $installedExe).VersionInfo.ProductName -ne 'Veyrion') { throw 'Unexpected installed product.' }
  $config = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'config.json') -Raw | ConvertFrom-Json
  if ($config.repository -cne 'ElmerHerreraC/veyrion-browser' -or $config.manifestUrl -cne 'https://github.com/ElmerHerreraC/veyrion-browser/releases/latest/download/veyrion-update.json') { throw 'Unexpected update channel.' }
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  Write-UpdateStatus $(if ($Apply) {'starting'} else {'checking'}) $config.version
  $manifestPath = Join-Path $cache 'manifest.download'
  Save-BoundedDownload $config.manifestUrl $manifestPath 20000
  $manifest = Read-UpdateManifest (Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json) $config
  if ([Version]$manifest.version -le [Version]$config.version) { Write-UpdateStatus 'current' $config.version; exit 0 }
  # Background checks only announce a verified version. The browser owns consent.
  if (!$Apply) { Write-UpdateStatus 'available' $manifest.version; exit 0 }
  $installer = Join-Path $cache ('Veyrion-' + $manifest.version + '-Setup-x64.exe')
  $valid = $false
  if (Test-Path -LiteralPath $installer) {
    try { Test-UpdateInstaller $installer $manifest; $valid = $true } catch { $valid = $false }
  }
  if (!$valid) {
    Write-UpdateStatus 'downloading' $manifest.version
    $script:downloadVersion = $manifest.version
    $temporary = $installer + '.download'
    Save-BoundedDownload $manifest.url $temporary $manifest.size
    $script:downloadVersion = $null
    Write-UpdateStatus 'verifying' $manifest.version $manifest.size $manifest.size
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
  Write-UpdateStatus 'installing' $manifest.version
  $process = Start-Process -FilePath $installer -ArgumentList '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /NOCLOSEAPPLICATIONS' -PassThru -WindowStyle Hidden
  $process.WaitForExit()
  if ($process.ExitCode -ne 0) { throw ('Installer exit: ' + $process.ExitCode) }
  $current = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'config.json') -Raw | ConvertFrom-Json
  if ($current.version -cne $manifest.version) { throw 'Installed version did not advance.' }
  Write-UpdateStatus 'installed' $manifest.version
} catch { Write-UpdateStatus 'error' $_.Exception.Message; exit 1 }
finally { if ($locked) { $mutex.ReleaseMutex() }; $mutex.Dispose() }
