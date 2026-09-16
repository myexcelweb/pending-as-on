# ============================================================
#  Push-PendingAsOn.ps1
#  Applies an updated build of the Docket (pending-as-on) project
#  (delivered as a .zip, e.g. docket-ui-simplified.zip) on top of
#  your existing local git checkout, then commits and pushes it.
#
#  Repo: https://github.com/myexcelweb/pending-as-on
#
#  This is the PUSH counterpart to Update-PendingAsOn.ps1 (which only
#  pulls). Use Update-PendingAsOn.ps1 when you want the latest from
#  GitHub; use this script when you have a new .zip of the project
#  (from Claude, a teammate, etc.) that you want to apply locally and
#  push back up to GitHub.
#
#  Usage (run in PowerShell):
#    .\Push-PendingAsOn.ps1
#    .\Push-PendingAsOn.ps1 -ZipPath "C:\Downloads\docket-ui-simplified.zip"
#    .\Push-PendingAsOn.ps1 -ProjectPath "D:\MyProjects\pending-as-on"
#    .\Push-PendingAsOn.ps1 -CommitMessage "Tabbed UI + CNR dedupe + designation summary"
#    .\Push-PendingAsOn.ps1 -DryRun
#    .\Push-PendingAsOn.ps1 -SkipInstall -SkipBuild
#
# ============================================================

param(
    # The .zip you were given (only used if it actually exists - see
    # -SourcePath below for the "I already extracted it" case)
    [string]$ZipPath = (Join-Path $PSScriptRoot "docket-ui-simplified.zip"),

    # An ALREADY-EXTRACTED source folder to copy from, instead of a zip.
    # If left blank, and no zip is found either, the script checks whether
    # $PSScriptRoot itself looks like an extracted project (has
    # package.json + src\) and uses that automatically - this covers the
    # common case of running this script from right inside the unzipped
    # folder you downloaded.
    [string]$SourcePath = "",

    # Folder where your EXISTING git checkout of the project lives
    [string]$ProjectPath = (Join-Path $PSScriptRoot "pending-as-on"),

    # Branch to commit/push to
    [string]$Branch = "main",

    # Git remote name
    [string]$Remote = "origin",

    # Commit message
    [string]$CommitMessage = "Update from Claude build",

    # Show what would change, but don't commit or push
    [switch]$DryRun,

    # Skip "npm install" after applying the update
    [switch]$SkipInstall,

    # Skip "npm run build" verification before pushing
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

function Write-Step($msg) { Write-Host ""; Write-Host ">>> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    $msg" -ForegroundColor Yellow }
function Write-Err($msg)  { Write-Host "    ERROR: $msg" -ForegroundColor Red }

# --- Pre-checks ---
Write-Step "Checking tools..."

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Err "git is not installed or not in PATH. Install Git for Windows first."
    exit 1
}
Write-Ok "git found: $(git --version)"

$hasNode = Get-Command node -ErrorAction SilentlyContinue
$hasNpm  = Get-Command npm  -ErrorAction SilentlyContinue
if (-not $hasNode -or -not $hasNpm) {
    Write-Warn "Node.js / npm not found. Files will still be applied and pushed, but install/build steps will be skipped."
    $SkipInstall = $true
    $SkipBuild = $true
} else {
    Write-Ok "node found: $(node --version)"
    Write-Ok "npm found:  $(npm --version)"
}

$gitDir = Join-Path $ProjectPath ".git"
if (-not (Test-Path $gitDir)) {
    Write-Err "No git repo found at: $ProjectPath"
    Write-Err "Run Update-PendingAsOn.ps1 first to clone the repo, then re-run this script."
    exit 1
}
Write-Ok "Existing repo found at: $ProjectPath"

# --- Make sure we're starting from a clean, up-to-date branch ---
Set-Location $ProjectPath

Write-Step "Checking working tree state..."
$preStatus = git status --porcelain
if ($preStatus) {
    Write-Warn "Your working tree already has uncommitted changes:"
    Write-Host $preStatus
    Write-Warn "These will be MIXED IN with the update from the zip."
    Write-Warn "If that's not what you want, stash or commit them first (Ctrl+C to abort now)."
}

$branchNow = git rev-parse --abbrev-ref HEAD 2>$null
if ($branchNow -ne $Branch) {
    Write-Step "Switching to branch '$Branch' (currently on '$branchNow')..."
    git checkout $Branch
    if ($LASTEXITCODE -ne 0) {
        Write-Err "git checkout $Branch failed."
        exit 1
    }
}

# --- Work out where the update is coming from: a zip, an explicit
#     already-extracted folder, or (auto-detected) this script's own
#     folder if it already looks like an extracted project. ---
Write-Step "Locating update source..."

$usingZip = $false
$tempDir = $null
$sourceRoot = $null

if ($SourcePath -and (Test-Path $SourcePath)) {
    $sourceRoot = (Resolve-Path $SourcePath).Path
    Write-Ok "Using explicit -SourcePath: $sourceRoot"
} elseif (Test-Path $ZipPath) {
    $usingZip = $true
    Write-Ok "Zip found: $ZipPath"
} elseif ((Test-Path (Join-Path $PSScriptRoot "package.json")) -and (Test-Path (Join-Path $PSScriptRoot "src"))) {
    # This script is sitting inside an already-extracted project folder
    # (e.g. you unzipped docket-ui-simplified.zip yourself and are running
    # this from inside full_project\). Use that folder as the source.
    $sourceRoot = $PSScriptRoot
    Write-Ok "No zip given, but this folder looks like an extracted project - using it as the source: $sourceRoot"
} else {
    Write-Err "Couldn't find an update source."
    Write-Err "Pass -ZipPath 'C:\path\to\docket-ui-simplified.zip', or -SourcePath 'C:\path\to\extracted\full_project',"
    Write-Err "or run this script from inside the already-extracted project folder."
    exit 1
}

if ($usingZip) {
    Write-Step "Extracting zip..."
    $tempDir = Join-Path $env:TEMP ("pending-as-on-update-" + [guid]::NewGuid().ToString("N"))
    Expand-Archive -Path $ZipPath -DestinationPath $tempDir -Force

    # The zip contains a single top-level folder (e.g. "full_project").
    # Find it so we copy its CONTENTS, not an extra nested folder.
    $topLevel = Get-ChildItem -Path $tempDir | Where-Object { $_.PSIsContainer }
    if ($topLevel.Count -eq 1) {
        $sourceRoot = $topLevel[0].FullName
    } else {
        $sourceRoot = $tempDir
    }
}
Write-Ok "Source root: $sourceRoot"

# --- Copy files into the repo, without touching .git, node_modules, dist,
#     this script itself, or (if the destination happens to sit INSIDE the
#     source folder, as it does when you run this from inside an extracted
#     zip) the destination folder itself. ---
Write-Step "Applying update into $ProjectPath ..."

$xdArgs = @(".git", "node_modules", "dist")
$resolvedProjectPath = (Resolve-Path $ProjectPath -ErrorAction SilentlyContinue)
if ($resolvedProjectPath -and $resolvedProjectPath.Path.StartsWith($sourceRoot, [System.StringComparison]::OrdinalIgnoreCase) -and $resolvedProjectPath.Path -ne $sourceRoot) {
    # ProjectPath is nested inside sourceRoot - exclude its full path so
    # robocopy doesn't try to copy the repo folder into itself.
    $xdArgs += $resolvedProjectPath.Path
    Write-Warn "Destination is nested inside the source folder - excluding it from the copy to avoid self-nesting."
}
$xfArgs = @(".gitignore", "*.ps1", "*.zip")

if ($DryRun) {
    Write-Warn "DRY RUN - showing what would change (robocopy /L), nothing will be written."
    robocopy $sourceRoot $ProjectPath /MIR /L /XD $xdArgs /XF $xfArgs /NFL:$false /NDL:$false | Out-Host
} else {
    robocopy $sourceRoot $ProjectPath /MIR /XD $xdArgs /XF $xfArgs /NP | Out-Host
    # robocopy's success exit codes are 0-7, not just 0
    if ($LASTEXITCODE -ge 8) {
        Write-Err "robocopy reported a serious error (code $LASTEXITCODE)."
        exit 1
    }
    Write-Ok "Files applied."
}

if ($usingZip -and $tempDir) {
    Remove-Item -Recurse -Force $tempDir -ErrorAction SilentlyContinue
}

if ($DryRun) {
    Write-Step "Dry run complete. Re-run without -DryRun to actually apply, commit, and push."
    exit 0
}

# --- npm install (recommended: package.json / package-lock.json may have changed) ---
if (-not $SkipInstall) {
    Write-Step "Running npm install..."
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Err "npm install failed."
        exit 1
    }
    Write-Ok "Dependencies installed"
} else {
    Write-Warn "Skipped npm install"
}

# --- npm run build (sanity check before pushing broken code) ---
if (-not $SkipBuild) {
    Write-Step "Running npm run build to verify the update compiles..."
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Err "Build failed. NOT committing or pushing."
        Write-Err "Fix the error above, or re-run with -SkipBuild to push anyway (not recommended)."
        exit 1
    }
    Write-Ok "Build succeeded"
} else {
    Write-Warn "Skipped build verification"
}

# --- Stage, commit, push ---
Write-Step "Checking for changes to commit..."
$status = git status --porcelain
if (-not $status) {
    Write-Ok "No changes detected - repo already matches the zip. Nothing to commit or push."
    exit 0
}

Write-Step "Staging changes..."
git add -A

Write-Step "Committing..."
git commit -m "$CommitMessage"
if ($LASTEXITCODE -ne 0) {
    Write-Err "git commit failed."
    exit 1
}
Write-Ok "Committed."

Write-Step "Pushing to $Remote/$Branch..."
git push $Remote $Branch
if ($LASTEXITCODE -ne 0) {
    Write-Err "git push failed."
    Write-Warn "If origin has new commits you don't have, run: git pull --rebase $Remote $Branch"
    Write-Warn "then re-run: git push $Remote $Branch"
    exit 1
}
Write-Ok "Pushed successfully."

Write-Step "Done."
Write-Host ""
Write-Host ("  Project path : " + $ProjectPath) -ForegroundColor White
Write-Host ("  Branch       : " + $Branch) -ForegroundColor White
Write-Host ("  Commit       : " + $CommitMessage) -ForegroundColor White
Write-Host ""