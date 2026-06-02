# setup-new-pc.ps1 — automate the music-stack setup on a fresh PC
#
# Usage (from PowerShell):
#   .\setup-new-pc.ps1                        # default machine name = "studioPC"
#   .\setup-new-pc.ps1 -MachineName "ur44"    # custom name
#
# Assumptions:
#   - You're on Windows with PowerShell.
#   - Git, Node.js (LTS), Python 3.x, GitHub CLI (gh), Claude Code (claude) are
#     already installed. The script verifies and bails if anything is missing.
#   - You want C:\workspace\music-stack\ as the workspace (same path as primary
#     PC, so Claude project memory keys align).
#
# What it does:
#   1) Verify prerequisites.
#   2) Run `gh auth login` if not already authenticated.
#   3) Create C:\workspace\music-stack\ and clone the 5 active repos:
#      Music, chill, drum-floor, namima, openclaw.
#   4) Tag the local git config with the machine name so future Session Ledger
#      entries can be prefixed (e.g. "## YYYY-MM-DD [studioPC] — ...").
#   5) Run stack-check to confirm 0 BAD.
#   6) Open the NEW-PC-SETUP.md doc in the browser (it contains the bootstrap
#      prompt to paste into Claude Code's first turn).
#   7) Print the next-step commands.

param(
  [string]$MachineName = "studioPC",
  [string]$Workspace = "C:\workspace\music-stack"
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg) { Write-Host "    $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    $msg" -ForegroundColor Yellow }

Write-Step "music-stack setup for machine '$MachineName'"

# 1) Prerequisites
Write-Step "Checking prerequisites"
$missing = @()
foreach ($tool in @("git", "node", "python", "gh", "claude")) {
  if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
    $missing += $tool
  } else {
    Write-Ok "$tool found"
  }
}
if ($missing.Count -gt 0) {
  Write-Error "Missing tools: $($missing -join ', '). Install them and re-run."
}

# 2) GitHub auth
Write-Step "Checking GitHub auth"
gh auth status 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Warn "Not authenticated — launching 'gh auth login'..."
  gh auth login
} else {
  Write-Ok "gh authenticated"
}

# 3) Workspace + clones
Write-Step "Preparing workspace at $Workspace"
if (-not (Test-Path $Workspace)) {
  New-Item -ItemType Directory -Path $Workspace | Out-Null
  Write-Ok "Created $Workspace"
} else {
  Write-Ok "$Workspace exists"
}
Set-Location $Workspace

$repos = @("Music", "chill", "drum-floor", "namima", "openclaw")
foreach ($repo in $repos) {
  $repoPath = Join-Path $Workspace $repo
  if (Test-Path $repoPath) {
    Write-Ok "$repo already cloned, skipping"
  } else {
    Write-Step "Cloning QuietBriony/$repo"
    gh repo clone "QuietBriony/$repo"
    if ($LASTEXITCODE -ne 0) {
      Write-Error "Clone failed for $repo. Check 'gh auth' permissions."
    }
  }
}

# 4) Machine-name tag in Music repo's git config (local, not global)
Set-Location (Join-Path $Workspace "Music")
git config --local music.machineName $MachineName
Write-Ok "git config music.machineName = $MachineName (in Music repo)"

# 5) stack-check
Write-Step "Running stack-check"
node scripts/stack-check.mjs
if ($LASTEXITCODE -ne 0) {
  Write-Warn "stack-check returned non-zero — investigate before working."
} else {
  Write-Ok "stack-check passed (0 BAD)"
}

# 6) Open the setup doc in browser (contains the bootstrap prompt)
Write-Step "Opening NEW-PC-SETUP.md in browser (for the bootstrap prompt)"
Start-Process "https://github.com/QuietBriony/Music/blob/main/docs/NEW-PC-SETUP.md"

# 7) Next steps
Write-Host ""
Write-Host "================================================================" -ForegroundColor Green
Write-Host " music-stack setup complete on machine '$MachineName'" -ForegroundColor Green
Write-Host "================================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1) cd $Workspace\Music"
Write-Host "  2) claude"
Write-Host "  3) Paste the bootstrap prompt from NEW-PC-SETUP.md section 6"
Write-Host "     (browser just opened it). The prompt establishes context,"
Write-Host "     standing constraints, and the GitHub sync rhythm."
Write-Host ""
Write-Host "Per-session reminder before any work:" -ForegroundColor Cyan
Write-Host "  git pull --ff-only origin main"
Write-Host ""
Write-Host "When adding to SESSION-LEDGER, prefix new entries with [$MachineName]:" -ForegroundColor Cyan
Write-Host "  ## YYYY-MM-DD [$MachineName] — <one-line summary> (vNNN)"
Write-Host ""
