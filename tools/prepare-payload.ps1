param([Parameter(Mandatory=$true)][string]$DistributionDir)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$distribution = (Resolve-Path -LiteralPath $DistributionDir).Path
$archives = @(Get-ChildItem -LiteralPath $distribution -Filter '*.zip' -File | Where-Object { $_.Name -notmatch 'symbols' })
if ($archives.Count -ne 1) { throw 'Se esperaba un único archivo de distribución del navegador.' }
$payload = Join-Path $distribution ('veyrion-payload-' + [Guid]::NewGuid().ToString('N'))
[IO.Directory]::CreateDirectory($payload) | Out-Null
$boundary = [IO.Path]::GetFullPath($payload) + [IO.Path]::DirectorySeparatorChar
$archive = [IO.Compression.ZipFile]::OpenRead($archives[0].FullName)
try {
  foreach ($entry in $archive.Entries) {
    $relative = $entry.FullName.Replace('\','/') -replace '^(\./)+', ''
    if (!$relative -or $relative.EndsWith('/')) { continue }
    # Chromium's Windows archive puts runtime files under the version directory.
    # Keep the standalone distribution flat so the executable loads its adjacent
    # DLLs and resources without installer registry entries.
    $relative = $relative -replace '^\d+\.\d+\.\d+\.\d+/', ''
    if ([IO.Path]::IsPathRooted($relative) -or $relative.Contains(':') -or ($relative.Split('/') -contains '..')) { throw "Ruta inválida en distribución: $relative" }
    $target = [IO.Path]::GetFullPath((Join-Path $payload $relative))
    if (!$target.StartsWith($boundary, [StringComparison]::OrdinalIgnoreCase)) { throw 'La distribución intenta escribir fuera del paquete.' }
    [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target)) | Out-Null
    [IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $target, $false)
  }
} finally { $archive.Dispose() }
foreach ($required in @('veyrion.exe','chrome.dll','chrome_elf.dll','resources.pak','icudtl.dat','locales')) {
  if (!(Test-Path -LiteralPath (Join-Path $payload $required))) { throw "Distribución incompleta: $required" }
}
Write-Output $payload
