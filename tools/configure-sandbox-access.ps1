param([string]$InstallDir = (Join-Path $env:LOCALAPPDATA 'Programs\Veyrion'), [switch]$VerifyOnly)
$ErrorActionPreference = 'Stop'
$env:PSModulePath = (Join-Path $PSHOME 'Modules') + ';' + $env:PSModulePath
$installedRoot = (Resolve-Path -LiteralPath $InstallDir).Path
$installedBinary = Join-Path $installedRoot 'veyrion.exe'
if (!(Test-Path -LiteralPath $installedBinary) -or (Get-Item -LiteralPath $installedBinary).VersionInfo.ProductName -ne 'Veyrion') {
  throw 'La carpeta debe contener la instalación nativa de Veyrion.'
}
# Same read/execute capabilities as Chromium's ConfigureAppContainerSandbox.
# No write permission is granted, and the user-data directory is not touched.
$capabilities = @(
  'S-1-15-3-1024-3424233489-972189580-2057154623-747635277-1604371224-316187997-3786583170-1043257646',
  'S-1-15-3-1024-2302894289-466761758-1166120688-1039016420-2430351297-4240214049-4028510897-3317428798'
)
foreach ($capability in $capabilities) {
  if ($VerifyOnly) { continue }
  & "$env:SystemRoot\System32\icacls.exe" $installedRoot /grant "*${capability}:(OI)(CI)(RX)" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'No se pudieron configurar los permisos AppContainer.' }
}
$rules = (Get-Acl -LiteralPath $installedBinary).GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])
foreach ($capability in $capabilities) {
  $allowed = $rules | Where-Object {
    $_.IdentityReference.Value -eq $capability -and $_.AccessControlType -eq 'Allow' -and
    ($_.FileSystemRights -band [Security.AccessControl.FileSystemRights]::ReadAndExecute) -eq [Security.AccessControl.FileSystemRights]::ReadAndExecute
  }
  if (!$allowed) { throw 'No se heredó la lectura/ejecución al ejecutable.' }
}
Write-Output 'Permisos AppContainer de lectura y ejecución verificados; sandbox activo.'
