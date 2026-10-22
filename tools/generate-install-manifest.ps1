#requires -Version 5.1
[CmdletBinding()]
param([string]$PackagePath)
$ErrorActionPreference = 'Stop'
if (-not $PackagePath) { $PackagePath = Split-Path -Parent $PSScriptRoot }
$package = [IO.Path]::GetFullPath($PackagePath)
function Assert-NoLinks([string]$Path) {
    $cursor = [IO.Path]::GetFullPath($Path)
    while ($cursor) {
        $item = Get-Item -LiteralPath $cursor -Force -ErrorAction SilentlyContinue
        if ($item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Symbolic link/junction rejected: $cursor" }
        $parent = [IO.Path]::GetDirectoryName($cursor)
        if ($parent -eq $cursor) { break }; $cursor = $parent
    }
}
Assert-NoLinks $package
function Get-Sha256([string]$Path) {
    $stream = [IO.File]::OpenRead($Path)
    $hasher = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($hasher.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
    finally { $stream.Dispose(); $hasher.Dispose() }
}
$names = @('main.js', 'manifest.json', 'styles.css', 'assets/reading-icon.svg', 'assets/reading-frog.png')
$manifestPath = Join-Path $package 'plugin/manifest.json'
Assert-NoLinks $manifestPath
$manifest = [IO.File]::ReadAllText($manifestPath) | ConvertFrom-Json
if ($manifest.id -ne 'paper-library' -or -not $manifest.version) { throw 'Invalid plugin manifest.' }
$files = @()
foreach ($name in $names) {
    $file = Join-Path (Join-Path $package 'plugin') $name
    Assert-NoLinks $file
    if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw "Missing runtime file: $name" }
    $files += [ordered]@{ path = $name; sha256 = (Get-Sha256 $file) }
}
$output = Join-Path $package 'tools/install-manifest.json'
Assert-NoLinks $output
$index = [ordered]@{ schema = 1; pluginId = 'paper-library'; version = $manifest.version; files = $files }
[IO.File]::WriteAllText($output, (($index | ConvertTo-Json -Depth 6) + [Environment]::NewLine), (New-Object Text.UTF8Encoding($false)))
Write-Host "Updated tools/install-manifest.json: $($files.Count) plugin files, version $($manifest.version)."
