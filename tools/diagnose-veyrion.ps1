param([switch]$Launch)
$ErrorActionPreference='Stop'
$exe=Join-Path $env:LOCALAPPDATA 'Programs\Veyrion\veyrion.exe'
if(!(Test-Path -LiteralPath $exe)){throw 'No se encontró Veyrion instalado para este usuario.'}
$started=Get-Date
$folder=Join-Path ([Environment]::GetFolderPath('Desktop')) ('Veyrion-Diagnostico-'+$started.ToString('yyyyMMdd-HHmmss'))
[IO.Directory]::CreateDirectory($folder)|Out-Null
$config=Join-Path (Split-Path $exe) 'updater\config.json'
$os=Get-CimInstance Win32_OperatingSystem
$gpu=@(Get-CimInstance Win32_VideoController|Select-Object Name,DriverVersion,DriverDate,AdapterRAM)
@{version=if(Test-Path -LiteralPath $config){(Get-Content -LiteralPath $config -Raw|ConvertFrom-Json).version}else{'unknown'};windows=$os.Caption;build=$os.BuildNumber;architecture=$os.OSArchitecture;totalRamKB=$os.TotalVisibleMemorySize;availableRamKB=$os.FreePhysicalMemory;gpu=$gpu;started=$started.ToUniversalTime().ToString('o')}|ConvertTo-Json -Depth 5|Set-Content -LiteralPath (Join-Path $folder 'system.json') -Encoding UTF8
$browser=$null
if($Launch){
  if(Get-Process veyrion -ErrorAction SilentlyContinue){throw 'Cierra Veyrion desde su menú y vuelve a ejecutar el diagnóstico. No se cerrarán ventanas automáticamente.'}
  $launchArguments=@('--enable-logging','--restore-last-session',('--log-file="'+(Join-Path $folder 'browser-errors.log')+'"'))
  $imported=Join-Path $env:LOCALAPPDATA 'Veyrion\Samsung-Imported'
  if(Test-Path -LiteralPath $imported){$launchArguments+=('--user-data-dir="'+$imported+'"')}
  $browser=Start-Process -FilePath $exe -ArgumentList ($launchArguments -join ' ') -PassThru
  Write-Host 'Reproduce el fallo. Se registrarán hasta diez minutos; puedes cerrar Veyrion para terminar antes.'
}
try{
  $deadline=(Get-Date).AddMinutes($(if($Launch){10}else{0}))
  do{
    $processes=@(Get-Process veyrion -ErrorAction SilentlyContinue|Select-Object Id,CPU,WorkingSet64,PrivateMemorySize64,Responding)
    @{time=[DateTime]::UtcNow.ToString('o');availableRamKB=(Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory;processes=$processes}|ConvertTo-Json -Depth 4 -Compress|Add-Content -LiteralPath (Join-Path $folder 'processes.jsonl') -Encoding UTF8
    if(!$Launch -or !$processes.Count -or (Get-Date)-ge $deadline){break}
    Start-Sleep -Seconds 10
  }while($true)
}finally{
  $events=@(Get-WinEvent -FilterHashtable @{LogName='Application';Id=1000,1001,1002;StartTime=$started.AddMinutes(-30)} -ErrorAction SilentlyContinue|Where-Object{$_.Message -match 'veyrion\.exe'}|Select-Object TimeCreated,Id,Message)
  ConvertTo-Json -InputObject $events -Depth 4|Set-Content -LiteralPath (Join-Path $folder 'windows-errors.json') -Encoding UTF8
  @('Informe local: no se envía automáticamente.','No incluye perfiles, cookies, contraseñas, chats ni volcados de memoria.','El registro del navegador puede incluir direcciones de páginas; revísalo antes de compartirlo.','El navegador no se cierra al finalizar este diagnóstico.')|Set-Content -LiteralPath (Join-Path $folder 'LEEME.txt') -Encoding UTF8
  Write-Host ('Diagnóstico guardado en: '+$folder)
}
