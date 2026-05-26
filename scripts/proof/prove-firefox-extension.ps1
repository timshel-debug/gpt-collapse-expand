[CmdletBinding()]
param(
  [string]$XpiPath = (Join-Path $PSScriptRoot '..\..\xpi-output\gpt-collapse-expand.xpi'),
  [string]$ReportRoot = (Join-Path $PSScriptRoot '..\..\reports\firefox-extension-proof'),
  [string]$SiteUrl = 'https://chatgpt.com/'
)

$ErrorActionPreference = 'Stop'

function Write-Blocker {
  param(
    [string]$Classification,
    [string]$Message,
    [string]$InstallHint = ''
  )

  Write-Host $Classification
  Write-Host $Message
  if ($InstallHint) {
    Write-Host $InstallHint
  }
  exit 1
}

function Get-FirefoxBinary {
  param([string]$EnvBinary)

  if ($EnvBinary -and (Test-Path $EnvBinary)) {
    return (Resolve-Path $EnvBinary).Path
  }

  $cmd = Get-Command firefox -ErrorAction SilentlyContinue
  if ($cmd) {
    return $cmd.Source
  }

  $candidates = @(
    "$env:ProgramFiles\Mozilla Firefox\firefox.exe",
    "$env:ProgramFiles(x86)\Mozilla Firefox\firefox.exe"
  )

  foreach ($candidate in $candidates) {
    if ($candidate -and (Test-Path $candidate)) {
      return (Resolve-Path $candidate).Path
    }
  }

  return $null
}

function Get-GeckoDriverPath {
  $cmd = Get-Command geckodriver -ErrorAction SilentlyContinue
  if ($cmd -and (Test-Path $cmd.Source)) {
    return (Resolve-Path $cmd.Source).Path
  }

  $wingetPackages = Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'
  if (Test-Path $wingetPackages) {
    $candidate = Get-ChildItem $wingetPackages -Recurse -Filter geckodriver.exe -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($candidate) {
      return $candidate.FullName
    }
  }

  return $null
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..\..')
$xpiFullPath = $null
if (Test-Path $XpiPath) {
  $xpiFullPath = (Resolve-Path $XpiPath).Path
} else {
  Write-Blocker -Classification 'BLOCKED_MISSING_XPI' -Message "Missing XPI: $XpiPath" -InstallHint 'Run .\build-xpi.ps1 first.'
}

$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
  Write-Blocker -Classification 'BLOCKED_MISSING_PYTHON' -Message 'Python is not available on PATH.' -InstallHint 'Install Python 3 and ensure python.exe is available, then rerun.'
}

$firefoxBinary = Get-FirefoxBinary -EnvBinary $env:CGCC_FIREFOX_BINARY
if (-not $firefoxBinary) {
  Write-Blocker -Classification 'BLOCKED_MISSING_FIREFOX' -Message 'Firefox is not available.' -InstallHint 'Install Firefox or set CGCC_FIREFOX_BINARY to firefox.exe, then rerun.'
}

$seleniumCheck = & $python.Source -c "import selenium; print(selenium.__version__)" 2>&1
if ($LASTEXITCODE -ne 0) {
  Write-Blocker -Classification 'BLOCKED_MISSING_SELENIUM' -Message 'Python selenium is not installed.' -InstallHint 'Install with: python -m pip install selenium'
}

$geckodriverPath = Get-GeckoDriverPath
if (-not $geckodriverPath) {
  Write-Blocker -Classification 'BLOCKED_MISSING_GECKODRIVER' -Message 'geckodriver is not available on PATH.' -InstallHint 'Install geckodriver and ensure geckodriver.exe is on PATH, then rerun.'
}

$profilePath = $env:CGCC_FIREFOX_PROFILE
if ($profilePath -and -not (Test-Path $profilePath)) {
  Write-Blocker -Classification 'BLOCKED_MISSING_PROFILE' -Message "CGCC_FIREFOX_PROFILE does not exist: $profilePath" -InstallHint 'Set CGCC_FIREFOX_PROFILE to a valid Firefox profile directory, then rerun.'
}

$timestamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$reportDir = Join-Path $ReportRoot $timestamp
New-Item -ItemType Directory -Force -Path $reportDir | Out-Null

if ($firefoxBinary -and ($firefoxBinary -notmatch 'WindowsApps')) {
  $env:CGCC_FIREFOX_BINARY = $firefoxBinary
}
$env:CGCC_GECKODRIVER_BINARY = $geckodriverPath
$env:CGCC_FIREFOX_PROFILE = $profilePath
$env:CGCC_PROOF_DIR = $reportDir
$env:CGCC_XPI_PATH = $xpiFullPath
$env:CGCC_SITE_URL = $SiteUrl

$pythonScript = Join-Path $PSScriptRoot 'prove-firefox-extension.py'
if (-not (Test-Path $pythonScript)) {
  Write-Blocker -Classification 'BLOCKED_MISSING_PYTHON_LANE' -Message "Missing Python proof script: $pythonScript"
}

& $python.Source $pythonScript --xpi-path $xpiFullPath --report-dir $reportDir --site-url $SiteUrl
exit $LASTEXITCODE
