Write-Host "Building XPI with proper paths..."

# Remove old XPI
if (Test-Path 'xpi-output/gpt-collapse-expand.xpi') {
    Remove-Item 'xpi-output/gpt-collapse-expand.xpi' -Force
    Write-Host "[OK] Removed old XPI"
}

# Create temp directory for staging
$tmpdir = New-TemporaryFile
Remove-Item $tmpdir
New-Item -ItemType Directory -Path $tmpdir | Out-Null

# Copy all files
Copy-Item 'manifest.json' $tmpdir\
Copy-Item 'background.js' $tmpdir\
Copy-Item 'content-script.js' $tmpdir\
Copy-Item 'options.html' $tmpdir\
Copy-Item 'options.js' $tmpdir\
Copy-Item 'content-styles.css' $tmpdir\
Copy-Item 'icons' $tmpdir\icons -Recurse

Write-Host "[OK] Files staged"

# Compress to ZIP (which will become the XPI)
Compress-Archive -Path "$tmpdir\*" -DestinationPath 'xpi-output/gpt-collapse-expand.xpi' -Force

# Clean up temp dir
Remove-Item $tmpdir -Recurse -Force

# Verify
$file = Get-Item 'xpi-output/gpt-collapse-expand.xpi'
Write-Host ""
Write-Host "[SUCCESS] XPI package created"
Write-Host "  File: $($file.Name)"
Write-Host "  Size: $([math]::Round($file.Length/1024, 2)) KB"
Write-Host "  Path: $($file.FullName)"
