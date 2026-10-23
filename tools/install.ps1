#requires -Version 5.1
[CmdletBinding()]
param(
    [Alias('Target')][string]$VaultPath,
    [string]$PackagePath,
    [switch]$DryRun,
    [switch]$SkipProbes,
    [switch]$ZoteroCompanion
)
$ErrorActionPreference = 'Stop'
if (-not $PackagePath) { $PackagePath = Split-Path -Parent $PSScriptRoot }
$utf8 = New-Object Text.UTF8Encoding($false)

function Assert-NoLinks([string]$Path) {
    $cursor = [IO.Path]::GetFullPath($Path)
    while ($cursor) {
        $item = Get-Item -LiteralPath $cursor -Force -ErrorAction SilentlyContinue
        if ($item -and ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Symbolic link/junction rejected: $cursor" }
        $parent = [IO.Path]::GetDirectoryName($cursor)
        if ($parent -eq $cursor) { break }; $cursor = $parent
    }
}
function Assert-Directory([string]$Path) {
    Assert-NoLinks $Path
    if ((Test-Path -LiteralPath $Path) -and -not (Test-Path -LiteralPath $Path -PathType Container)) { throw "Expected directory: $Path" }
}
function Assert-File([string]$Path) {
    Assert-NoLinks $Path
    if ((Test-Path -LiteralPath $Path) -and -not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw "Expected file: $Path" }
}
function Get-LocalPath([string]$Path) {
    if ($Path -notmatch '^[a-zA-Z]:[\\/]' -or $Path.Substring(2) -match '[:<>"|?*\x00-\x1f]') { throw 'Use an absolute local drive path, not a relative, UNC or device path.' }
    foreach ($part in ($Path.Substring(3) -split '[\\/]')) {
        if ($part -in @('.', '..') -or $part -match '[. ]$' -or $part -match '^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)') { throw 'Unsafe path component; traversal, device names and trailing dots/spaces are rejected.' }
    }
    return [IO.Path]::GetFullPath($Path).TrimEnd([char[]]'\/')
}
function Select-Vault {
    $registered = @()
    if ($env:APPDATA) {
        $registry = Join-Path $env:APPDATA 'obsidian/obsidian.json'
        if (Test-Path -LiteralPath $registry -PathType Leaf) {
            try {
                $data = [IO.File]::ReadAllText($registry) | ConvertFrom-Json
                $registered = @($data.vaults.PSObject.Properties | ForEach-Object { $_.Value.path } | Where-Object { $_ -is [string] -and (Test-Path -LiteralPath $_ -PathType Container) } | Select-Object -Unique)
            } catch { Write-Host 'Could not read Obsidian vault registrations; enter a vault path instead.' }
        }
    }
    Write-Host '奶蛙 / Paper Library - choose an Obsidian vault'
    for ($i = 0; $i -lt $registered.Count; $i++) { Write-Host ("[{0}] {1}" -f ($i + 1), $registered[$i]) }
    Write-Host 'Enter a number, an absolute vault path, or B to browse. Empty input cancels.'
    $choice = (Read-Host 'Vault').Trim().Trim('"')
    if (-not $choice) { throw 'Installation cancelled; no changes.' }
    if ($choice -match '^\d+$') {
        $number = 0
        if (-not [int]::TryParse($choice, [ref]$number) -or $number -lt 1 -or $number -gt $registered.Count) { throw 'Invalid vault number.' }
        return $registered[$number - 1]
    }
    if ($choice -eq 'B') {
        Add-Type -AssemblyName System.Windows.Forms
        $dialog = New-Object Windows.Forms.FolderBrowserDialog
        try {
            $dialog.Description = '选择 Obsidian vault / Select a vault folder'
            if ($dialog.ShowDialog() -ne [Windows.Forms.DialogResult]::OK) { throw 'Installation cancelled; no changes.' }
            return $dialog.SelectedPath
        } finally { $dialog.Dispose() }
    }
    return $choice
}
function Write-Text([string]$Path, [string]$Text) { [IO.File]::WriteAllText($Path, $Text, $utf8) }
function Get-Sha256([string]$Path) {
    $stream = [IO.File]::OpenRead($Path)
    $hasher = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($hasher.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
    finally { $stream.Dispose(); $hasher.Dispose() }
}

if ([string]::IsNullOrWhiteSpace($VaultPath)) { $VaultPath = Select-Vault }
$vault = Get-LocalPath $VaultPath
$package = Get-LocalPath $PackagePath
if ($vault.Length -le [IO.Path]::GetPathRoot($vault).TrimEnd([char[]]'\/').Length) { throw 'A drive root is not a vault.' }
Assert-Directory $vault
Assert-Directory $package
if ($package -eq $vault -or $package.StartsWith($vault + '\', [StringComparison]::OrdinalIgnoreCase) -or $vault.StartsWith($package + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Extract the source ZIP outside the target vault.' }
foreach ($protected in @($env:SystemRoot, $env:ProgramFiles, ${env:ProgramFiles(x86)}, $env:USERPROFILE)) {
    if ($protected -and ($vault -eq $protected.TrimEnd('\') -or ($protected -ne $env:USERPROFILE -and $vault.StartsWith($protected.TrimEnd('\') + '\', [StringComparison]::OrdinalIgnoreCase)))) { throw 'Choose a dedicated vault directory outside system folders.' }
}
$config = Join-Path $vault '.obsidian'
$plugins = Join-Path $config 'plugins'
$destination = Join-Path $plugins 'paper-library'
$community = Join-Path $config 'community-plugins.json'
$homepage = Join-Path $vault '文献首页.md'
$papers = Join-Path $vault '文献'
$notes = Join-Path $vault '阅读笔记'
foreach ($dir in @($config, $plugins, $destination, $papers, $notes)) { Assert-Directory $dir }
foreach ($file in @($community, $homepage)) { Assert-File $file }

# All source and destination checks finish before creating or changing anything.
$indexPath = Join-Path $package 'tools/install-manifest.json'
Assert-File $indexPath
$index = [IO.File]::ReadAllText($indexPath) | ConvertFrom-Json
if ($index.schema -ne 1 -or $index.pluginId -ne 'paper-library' -or -not $index.files) { throw 'Invalid tools/install-manifest.json.' }
$allowed = @('main.js', 'manifest.json', 'styles.css', 'assets/reading-icon.svg', 'assets/reading-frog.png')
$seen = @{}; $plan = @()
foreach ($entry in $index.files) {
    $relative = [string]$entry.path
    if ($relative -cnotin $allowed) { throw "Unsafe or unreviewed runtime entry: $relative" }
    if ($seen.ContainsKey($relative)) { throw "Duplicate runtime entry: $relative" }; $seen[$relative] = $true
    if ($entry.sha256 -notmatch '^[a-f0-9]{64}$') { throw 'Invalid SHA256.' }
    $source = Join-Path (Join-Path $package 'plugin') $relative
    $target = Join-Path $destination $relative
    Assert-File $source; Assert-File $target
    $ancestor = [IO.Path]::GetDirectoryName($target)
    while ($ancestor.Length -ge $destination.Length) { Assert-Directory $ancestor; $ancestor = [IO.Path]::GetDirectoryName($ancestor) }
    $digest = Get-Sha256 $source
    if ($digest -ne $entry.sha256) { throw "Checksum mismatch: $relative. Maintainers must rerun tools/generate-install-manifest.ps1 after the final build." }
    $plan += [PSCustomObject]@{ Source = $source; Target = $target; Digest = $digest }
}
foreach ($required in $allowed) { if (-not $seen.ContainsKey($required)) { throw "Missing runtime: $required" } }
$manifest = [IO.File]::ReadAllText((Join-Path $package 'plugin/manifest.json')) | ConvertFrom-Json
if ($manifest.id -ne 'paper-library' -or $manifest.version -ne $index.version) { throw 'Plugin manifest/index mismatch.' }
$pluginIds = @()
$originalCommunity = $null
if (Test-Path -LiteralPath $community) {
    $originalCommunity = [IO.File]::ReadAllText($community)
    if ($originalCommunity.TrimStart() -notmatch '^\[') { throw 'community-plugins.json must be a JSON array; repair it before installing.' }
    $parsed = ('{"ids":' + $originalCommunity + '}') | ConvertFrom-Json
    foreach ($id in $parsed.ids) {
        if ($id -isnot [string]) { throw 'community-plugins.json contains a non-string plugin ID.' }
        $pluginIds += $id
    }
}
$enablePlugin = $pluginIds -notcontains 'paper-library'
if ($enablePlugin) { $pluginIds += 'paper-library' }
$communityText = ConvertTo-Json -InputObject @($pluginIds) -Depth 8
$vaultUri = [Uri]::EscapeDataString($vault)
$stub = @"
---
paper-library-home: true
---

# 文献首页

[打开奶蛙文献首页](obsidian://paper-library?vault=$vaultUri&action=home)

也可在 Obsidian 命令面板运行「Paper Library · 文献阅读：打开文献首页」。
PDF 保存在「文献」，阅读笔记保存在「阅读笔记」。已有笔记和 PDF 不会被安装器修改。
"@
Write-Host "Vault: $vault"
Write-Host "Paper Library $($manifest.version): $($plan.Count) runtime files from plugin/."
Write-Host 'Preserve: data.json, PDFs, notes, other plugins and existing home page.'
if ($DryRun) { Write-Host 'DRY RUN: validation passed; no files or settings changed.' }
else {
    # Reject changed source files once more before the first write.
    foreach ($item in $plan) {
        if ((Get-Sha256 $item.Source) -ne $item.Digest) { throw 'Source changed during validation; retry after the build finishes.' }
    }
    foreach ($dir in @($vault, $config, $plugins, $destination, $papers, $notes)) { [IO.Directory]::CreateDirectory($dir) | Out-Null }
    foreach ($item in $plan) {
        [IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($item.Target)) | Out-Null
        [IO.File]::Copy($item.Source, $item.Target, $true)
    }
    if (-not (Test-Path -LiteralPath $homepage)) { Write-Text $homepage $stub }
    if ($enablePlugin -or $null -eq $originalCommunity) { Write-Text $community ($communityText + [Environment]::NewLine) }
    Write-Host 'Installed. Open this vault in Obsidian, allow community plugins, then enable/reload Paper Library.'
    Write-Host 'An already-running Obsidian is not restarted or reloaded by this installer.'
}
if (-not $SkipProbes) {
    foreach ($name in @('Zotero', 'codex', 'opencodex')) {
        $command = Get-Command $name -ErrorAction SilentlyContinue | Select-Object -First 1
        $detected = [bool]$command
        $processNames = if ($name -eq 'opencodex') { @('opencodex', 'opencodex-desktop') } else { @($name) }
        if (Get-Process -Name $processNames -ErrorAction SilentlyContinue) { $detected = $true }
        Write-Host ("Probe {0} executable/running app detected: {1}" -f $name, $detected)
    }
    foreach ($probe in @(@('OpenCodex config', '.opencodex/config.json'), @('Codex account file', '.codex/auth.json'))) {
        $accountRoot = $env:USERPROFILE
        if ($probe[0] -eq 'Codex account file' -and $env:CODEX_HOME) { $configPath = Join-Path $env:CODEX_HOME 'auth.json' }
        elseif ($accountRoot) { $configPath = Join-Path $accountRoot $probe[1] }
        else { $configPath = $null }
        $present = $configPath -and (Test-Path -LiteralPath $configPath -PathType Leaf)
        Write-Host ("Probe {0} present: {1} (contents not read; login not verified)" -f $probe[0], [bool]$present)
    }
    $response = $null
    try {
        $request = [Net.HttpWebRequest]::Create('http://127.0.0.1:23119/api/')
        $request.Proxy = $null; $request.Timeout = 1000; $request.AllowAutoRedirect = $false
        $response = $request.GetResponse()
        Write-Host ("Probe Zotero local API HTTP status: {0}; plugin checks runtime access." -f [int]$response.StatusCode)
    } catch { Write-Host 'Probe Zotero local API: unavailable or access disabled; start/configure Zotero when needed.' }
    finally { if ($response) { $response.Close() } }
    Write-Host 'No account files were read/copied and no application was installed, started or authenticated.'
}
$xpi = Join-Path $package 'zotero-addon/paper-library-zotero.xpi'
if (Test-Path -LiteralPath $xpi -PathType Leaf) { Write-Host "Optional Zotero companion: $xpi" }
Write-Host 'Zotero companion requires manual installation: Zotero > Tools > Plugins > gear > Install Plugin From File.'
Write-Host 'The installer never modifies a Zotero profile. No Release is required.'
