param([Parameter(Mandatory=$true)][int]$BuildProcessId, [switch]$InstallIfClosed)
$ErrorActionPreference='Stop'
$project=Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $project
$source='D:/VeyrionBuild/src'
$version=(Get-Content -LiteralPath 'package.json' -Raw | ConvertFrom-Json).version
$receipt=Join-Path $project 'artifacts/production-finalization.json'
function State([string]$phase,[string]$detail){
  @{version=$version;phase=$phase;detail=$detail;updatedAt=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -LiteralPath $receipt -Encoding utf8
}
Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
public static class ReleasePowerRequest {
  [DllImport("kernel32.dll")]
  public static extern uint SetThreadExecutionState(uint flags);
}
'@
try {
  if([ReleasePowerRequest]::SetThreadExecutionState([uint32]2147483649) -eq 0){throw 'No se pudo mantener activo el sistema durante la finalización.'}
  State 'waiting' 'Esperando que termine la compilación del motor.'
  $build=Get-Process -Id $BuildProcessId -ErrorAction SilentlyContinue
  if($build){$started=$build.StartTime;while($true){$active=Get-Process -Id $BuildProcessId -ErrorAction SilentlyContinue;if(!$active -or $active.StartTime -ne $started){break};Start-Sleep -Seconds 20}}
  if((Get-Content -LiteralPath 'artifacts/native-build-production-final.log' -Raw) -notmatch 'Build Succeeded:'){throw 'El motor no terminó correctamente. No se empaquetará.'}
  $flags=Get-Content -LiteralPath "$source/out/Static/gen/base/debug/debugging_buildflags.h" -Raw
  if($flags -notmatch 'BUILDFLAG_INTERNAL_EXPENSIVE_DCHECKS_ARE_ON\(\) \(0\)'){throw 'Siguen activadas las comprobaciones costosas.'}
  $definitions=Get-Content -LiteralPath "$source/out/Static/obj/third_party/blink/renderer/bindings/core/v8/v8.ninja" -TotalCount 1
  if($definitions -match 'DCHECK_ALWAYS_ON'){throw 'Blink todavía tiene DCHECK_ALWAYS_ON.'}
  State 'version' 'Integrando la versión del instalador en los recursos nativos.'
  & node tools/integrate-release-version.mjs "$source/brave"
  if($LASTEXITCODE -ne 0){throw 'Falló la integración de versión.'}
  $env:DEPOT_TOOLS_WIN_TOOLCHAIN='0';$env:DEPOT_TOOLS_UPDATE='0'
  $env:vs2026_install='C:/Program Files/Microsoft Visual Studio/2026/BuildTools'
  $env:PYTHONPATH="$source/brave/script"
  $env:PATH="$source/brave/vendor/depot_tools;"+$env:PATH
  State 'resources' 'Compilando únicamente los recursos modificados de versión.'
  & "$source/third_party/siso/cipd/siso.exe" ninja --offline -C "$source/out/Static" brave -local_jobs=28 -k 1 *> artifacts/native-build-release-version.log
  if($LASTEXITCODE -ne 0){throw 'Falló la compilación de recursos de versión.'}
  State 'staging' 'Preparando la distribución completa con el motor corregido.'
  $stage=Join-Path $project ('artifacts/veyrion-payload-'+$version.Replace('.',''))
  if(!(Test-Path -LiteralPath $stage)){Copy-Item -LiteralPath 'artifacts/veyrion-payload-083' -Destination $stage -Recurse}
  foreach($file in (Get-ChildItem -LiteralPath $stage -File)){
    $name=if($file.Name -eq 'veyrion.exe'){'chrome.exe'}else{$file.Name}
    $native=Join-Path "$source/out/Static" $name
    if(Test-Path -LiteralPath $native){Copy-Item -LiteralPath $native -Destination $file.FullName -Force}
  }
  Copy-Item -LiteralPath 'updater/config.json' -Destination (Join-Path $stage 'updater/config.json') -Force
  & tools/configure-sandbox-access.ps1 -InstallDir $stage
  $env:NEBULA_BROWSER_EXE=Join-Path $stage 'veyrion.exe'
  $env:VEYRION_PRODUCTION_VERIFY='1'
  State 'smoke' 'Comprobación breve de Kick con tres recolecciones de memoria y descarga oficial de extensión.'
  & node tools/diagnose-web-compat.mjs *> artifacts/production-smoke.log
  if($LASTEXITCODE -ne 0){throw 'Falló la comprobación del motor corregido.'}
  State 'packaging' 'Generando y firmando el instalador.'
  $archive=Join-Path $project 'dist/archive/0.8.3'
  New-Item -ItemType Directory -Path $archive -Force | Out-Null
  Get-ChildItem -LiteralPath 'dist' -File | Copy-Item -Destination $archive -Force
  & tools/package-native.ps1 -PayloadDir $stage *> artifacts/package-production.log
  if($LASTEXITCODE -ne 0){throw 'Falló la generación del instalador.'}
  & node tools/sign-update.mjs
  if($LASTEXITCODE -ne 0){throw 'Falló la firma del manifiesto.'}
  (Get-FileHash -LiteralPath 'dist/Veyrion-Setup-x64.exe' -Algorithm SHA256).Hash.ToLowerInvariant() | Set-Content -LiteralPath 'dist/Veyrion-Setup-x64.exe.sha256' -Encoding ascii
  if($InstallIfClosed){
    $installed=Join-Path $env:LOCALAPPDATA 'Programs/Veyrion/veyrion.exe'
    $running=Get-CimInstance Win32_Process -Filter "Name='veyrion.exe'" | Where-Object {$_.ExecutablePath -ieq $installed}
    if($running){State 'ready-needs-close' 'Instalador listo; Veyrion está abierto. No se cerrarán ventanas automáticamente.';exit 0}
    State 'installing' 'Actualizando la instalación existente conservando el perfil.'
    & tools/verify-install.ps1 -AllowUpgrade -QuickVerify *> artifacts/installed-production.log
    if($LASTEXITCODE -ne 0){throw 'La instalación o su comprobación no terminó correctamente.'}
    State 'installed' 'Instalación y comprobación breve completadas. Falta publicar la Release en GitHub.'
  }else{State 'ready' 'Instalador firmado listo para instalar y publicar.'}
}catch{State 'failed' $_.Exception.Message;throw}
finally{[void][ReleasePowerRequest]::SetThreadExecutionState([uint32]2147483648)}
