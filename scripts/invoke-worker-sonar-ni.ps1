[CmdletBinding()]
param(
    [string]$Session = "musou-teien",
    [string]$Recipe = "references\studiopc-sonar-ni-reference.json",
    [string]$WorkerRoot = "C:\workspace\music-stack-worker",
    [switch]$SyncRepo,
    [switch]$AllowVersionMismatch
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot ".."))
$machineGuard = Join-Path $repoRoot "scripts\music-machine.ps1"
& $machineGuard -RequireMachine "worker-gaming" -RequireCapability "worker.daw-reference"
if ($LASTEXITCODE -ne 0) {
    throw "WorkerPC machine-role guard failed"
}

$recipePath = if ([IO.Path]::IsPathRooted($Recipe)) {
    [IO.Path]::GetFullPath($Recipe)
} else {
    [IO.Path]::GetFullPath((Join-Path $repoRoot $Recipe))
}

if (-not (Test-Path -LiteralPath $recipePath -PathType Leaf)) {
    throw "Recipe not found: $recipePath"
}

if ($SyncRepo) {
    $branch = (& git -C $repoRoot branch --show-current).Trim()
    $status = (& git -C $repoRoot status --porcelain)
    if ($branch -ne "main") {
        throw "Refusing to sync WorkerPC repo from branch '$branch'; switch to main first."
    }
    if ($status) {
        throw "Refusing to sync a dirty WorkerPC repo. Preserve or commit its local changes first."
    }

    & git -C $repoRoot fetch origin
    if ($LASTEXITCODE -ne 0) {
        throw "git fetch failed"
    }
    & git -C $repoRoot pull --ff-only origin main
    if ($LASTEXITCODE -ne 0) {
        throw "git pull --ff-only failed"
    }
}

$venvPython = Join-Path $WorkerRoot ".venv\Scripts\python.exe"
$python = if (Test-Path -LiteralPath $venvPython -PathType Leaf) {
    $venvPython
} else {
    (Get-Command python -ErrorAction Stop).Source
}

$pipeline = Join-Path $repoRoot "scripts\worker-gaming-pipeline.py"
$arguments = @(
    "-X", "utf8",
    $pipeline,
    "--worker-root", $WorkerRoot,
    "sonar-ni-reference",
    "--recipe", $recipePath,
    "--session", $Session
)
if (-not $AllowVersionMismatch) {
    $arguments += "--require-exact"
}

& $python @arguments
exit $LASTEXITCODE
