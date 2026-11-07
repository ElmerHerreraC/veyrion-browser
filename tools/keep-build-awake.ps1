param([Parameter(Mandatory=$true)][int]$BuildProcessId)
$ErrorActionPreference = 'Stop'
$target = Get-Process -Id $BuildProcessId
$started = $target.StartTime
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class BuildPowerRequest {
  [DllImport("kernel32.dll", SetLastError=true)]
  public static extern uint SetThreadExecutionState(uint flags);
}
'@
try {
  # Keep the system awake only for this build; the display can turn off.
  if ([BuildPowerRequest]::SetThreadExecutionState([uint32]2147483649) -eq 0) {
    throw 'No se pudo solicitar que el sistema permanezca activo.'
  }
  $marker = Join-Path (Split-Path -Parent $PSScriptRoot) 'artifacts/build-awake.json'
  @{active=$true;buildPid=$BuildProcessId} | ConvertTo-Json | Set-Content -LiteralPath $marker
  while ($true) {
    $running = Get-Process -Id $BuildProcessId -ErrorAction SilentlyContinue
    if (!$running -or $running.StartTime -ne $started) { break }
    Start-Sleep -Seconds 20
  }
} finally {
  [void][BuildPowerRequest]::SetThreadExecutionState([uint32]2147483648)
  if ($marker) { @{active=$false;buildPid=$BuildProcessId} | ConvertTo-Json | Set-Content -LiteralPath $marker }
}
