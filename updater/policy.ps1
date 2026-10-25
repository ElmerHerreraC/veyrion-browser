Set-StrictMode -Version Latest
function Read-UpdateManifest($Envelope, $Config) {
  if ($Envelope.payload -isnot [string] -or $Envelope.signature -isnot [string] -or $Envelope.payload.Length -gt 16000 -or $Envelope.signature.Length -gt 2000) { throw 'Invalid update envelope.' }
  $bytes = [Convert]::FromBase64String($Envelope.payload)
  $rsa = New-Object Security.Cryptography.RSACryptoServiceProvider
  $rsa.PersistKeyInCsp = $false
  try {
    $rsa.FromXmlString($Config.publicKeyXml)
    if (!$rsa.VerifyData($bytes, 'SHA256', [Convert]::FromBase64String($Envelope.signature))) { throw 'Invalid update signature.' }
  } finally { $rsa.Dispose() }
  $value = [Text.Encoding]::UTF8.GetString($bytes) | ConvertFrom-Json
  if ($value.version -isnot [string] -or $value.version -cnotmatch '^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$') { throw 'Invalid update version.' }
  $expected = 'https://github.com/' + $Config.repository + '/releases/download/v' + $value.version + '/Veyrion-Setup-x64.exe'
  if ($value.repository -cne $Config.repository -or $value.url -cne $expected) { throw 'Unexpected update source.' }
  if ($value.sha256 -isnot [string] -or $value.sha256 -cnotmatch '^[a-f0-9]{64}$' -or $value.size -isnot [ValueType] -or $value.size -lt 1 -or $value.size -gt 1073741824 -or [Math]::Truncate($value.size) -ne $value.size) { throw 'Invalid installer digest or size.' }
  [void][Version]::Parse($value.version)
  return $value
}
function Test-UpdateInstaller([string]$Path, $Manifest) {
  if ((Get-Item -LiteralPath $Path).Length -ne $Manifest.size) { throw 'Incomplete installer.' }
  $stream = [IO.File]::OpenRead($Path)
  $sha = [Security.Cryptography.SHA256]::Create()
  try { $hash = [BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-','').ToLowerInvariant() }
  finally { $stream.Dispose(); $sha.Dispose() }
  if ($hash -cne $Manifest.sha256) { throw 'Installer hash mismatch.' }
}
