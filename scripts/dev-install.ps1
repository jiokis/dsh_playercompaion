$ErrorActionPreference = 'Stop'
$repo = (Split-Path -Parent $PSScriptRoot) -replace '\\', '/'
$dsh = Join-Path $env:LOCALAPPDATA 'Programs\DeepSeek Harness\resources\runtime\cli\bin\dsh.cmd'
if (-not (Test-Path $dsh)) {
  throw "dsh CLI not found: $dsh"
}
Write-Output "Installing $repo into profile lore-dev"
& $dsh plugin --profile lore-dev add ("link:" + $repo)
if ($LASTEXITCODE -ne 0) { throw 'dsh plugin add failed' }
Write-Output '--- dump config ---'
& $dsh --profile lore-dev --dump-config | Select-String -Pattern 'lore-companion' -Context 2,2
