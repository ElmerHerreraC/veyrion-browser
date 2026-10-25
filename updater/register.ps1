param([switch]$Uninstall)
$ErrorActionPreference = 'Stop'
$env:PSModulePath = (Join-Path $PSHOME 'Modules') + ';' + $env:PSModulePath
$identity = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$account = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$name = 'VeyrionUpdate-' + $identity
if ($Uninstall) { Unregister-ScheduledTask -TaskName $name -Confirm:$false -ErrorAction SilentlyContinue; exit 0 }
$scriptPath = Join-Path $PSScriptRoot 'update.ps1'
$hostPath = Join-Path $PSScriptRoot 'VeyrionUpdate.exe'
if (!(Test-Path -LiteralPath $hostPath)) { throw 'Missing console-free update host.' }
$action = New-ScheduledTaskAction -Execute $hostPath -Argument 'check'
$logon = New-ScheduledTaskTrigger -AtLogOn -User $account
$periodic = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 15)
$principal = New-ScheduledTaskPrincipal -UserId $account -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero)
Register-ScheduledTask -TaskName $name -Description 'Checks signed Veyrion updates without a console. Installation is requested in browser settings.' -Action $action -Trigger @($logon,$periodic) -Principal $principal -Settings $settings -Force | Out-Null
if (!(Get-ScheduledTask -TaskName $name)) { throw 'Veyrion updater registration failed.' }
Start-ScheduledTask -TaskName $name
