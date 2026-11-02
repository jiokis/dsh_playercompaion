$ErrorActionPreference = 'Stop'
$repo = Split-Path -Parent $PSScriptRoot
$engine = Join-Path $repo 'engine'
$root = Join-Path $env:LOCALAPPDATA 'dsh-lore-companion\engine'
$venv = Get-ChildItem $root -Directory -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $venv) {
  throw 'engine cache not found; run: node scripts/bootstrap-smoke.mjs'
}
$py = Join-Path $venv.FullName 'Scripts\python.exe'
if (-not (Test-Path $py)) {
  throw "engine python not found: $py"
}
$env:PYTHONPATH = $engine
Push-Location $engine
try {
  Write-Output '--- warmup ---'
  & $py -m lore_engine warmup
  if ($LASTEXITCODE -ne 0) { throw 'warmup failed' }
  Write-Output '--- selftest (no warmup) ---'
  & $py -m lore_engine selftest --no-warmup
  if ($LASTEXITCODE -ne 0) { throw 'selftest failed' }
} finally {
  Pop-Location
}
