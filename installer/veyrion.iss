; Inno Setup. Only accepts the separately staged native distribution.
#ifndef PayloadDir
  #error Supply /DPayloadDir with the validated native distribution directory.
#endif
#ifnexist PayloadDir + "\veyrion.exe"
  #error No native veyrion.exe exists. The Brave preview cannot be packaged.
#endif
[Setup]
AppId={{6C63BB20-2F16-4AF6-8CED-CBA7E7536C1A}
AppName=Veyrion
AppVersion=0.8.0
AppPublisher=Veyrion Project
DefaultDirName={localappdata}\Programs\Veyrion
DefaultGroupName=Veyrion
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir=..\dist
OutputBaseFilename=Veyrion-Setup-x64
SetupIconFile=..\Veyrion.ico
UninstallDisplayIcon={app}\Veyrion.ico
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
CloseApplications=yes
[Languages]
Name: "spanish"; MessagesFile: "compiler:Languages\Spanish.isl"
[Tasks]
Name: "desktopicon"; Description: "Crear acceso de Veyrion en el escritorio"
[Files]
Source: "{#PayloadDir}\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "..\Veyrion.ico"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\updater\*"; DestDir: "{app}\updater"; Flags: ignoreversion
Source: "..\tools\configure-sandbox-access.ps1"; DestDir: "{app}\updater"; Flags: ignoreversion
[Icons]
Name: "{group}\Veyrion"; Filename: "{app}\veyrion.exe"; WorkingDir: "{app}"; IconFilename: "{app}\Veyrion.ico"
Name: "{autodesktop}\Veyrion"; Filename: "{app}\veyrion.exe"; WorkingDir: "{app}"; IconFilename: "{app}\Veyrion.ico"; Tasks: desktopicon
[Run]
Filename: "{app}\veyrion.exe"; Description: "Abrir Veyrion y configurar perfil, importación y sincronización"; Flags: nowait postinstall skipifsilent
; User profiles are deliberately not deleted during uninstall.
[UninstallRun]
Filename: "{sys}\WindowsPowerShell\v1.0\powershell.exe"; Parameters: "-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File ""{app}\updater\register.ps1"" -Uninstall"; Flags: runhidden waituntilterminated; RunOnceId: "VeyrionUpdater"
[Code]
var ConfigurationFailed: Boolean;
procedure RunConfiguration(const ScriptName, Extra: String);
var ResultCode: Integer;
begin
  if not Exec(ExpandConstant('{sys}\WindowsPowerShell\v1.0\powershell.exe'),
    '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' +
    ExpandConstant('{app}\updater\') + ScriptName + '" ' + Extra,
    '', SW_HIDE, ewWaitUntilTerminated, ResultCode) then begin
    ConfigurationFailed := True;
    RaiseException('No se pudo configurar Veyrion: ' + ScriptName);
  end;
  if ResultCode <> 0 then begin
    ConfigurationFailed := True;
    RaiseException('La configuración de Veyrion falló: ' + ScriptName);
  end;
end;
function GetCustomSetupExitCode(): Integer;
begin
  if ConfigurationFailed then Result := 41 else Result := 0;
end;
procedure CurStepChanged(CurStep: TSetupStep);
begin
  if CurStep = ssPostInstall then begin
    RunConfiguration('configure-sandbox-access.ps1', '-InstallDir "' + ExpandConstant('{app}') + '"');
    RunConfiguration('register.ps1', '');
  end;
end;

