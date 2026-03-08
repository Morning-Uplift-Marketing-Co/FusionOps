# Cleanup Script - Zip Unnecessary Files
# Created: 2026-03-09
# Purpose: Archive unnecessary files before deletion

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$archiveName = "unnecessary-files-backup-$timestamp.zip"

Write-Host "🗜️ Creating archive: $archiveName" -ForegroundColor Cyan
Write-Host ""

# Create temporary list file
$filesToZip = @()

# ─── Test Scripts ───
Write-Host "📝 Adding test scripts..." -ForegroundColor Yellow
$testScripts = @(
    "api-deploy-test.mjs",
    "create-test-domain.mjs",
    "deploy-template-test.mjs",
    "simple-deploy-test.mjs",
    "test-deploy-api.mjs",
    "test-real-deploy.mjs",
    "test-ui-deploy.mjs",
    "create-and-deploy.mjs",
    "direct-deploy.mjs",
    "real-deploy.mjs"
)
foreach ($file in $testScripts) {
    if (Test-Path $file) {
        $filesToZip += $file
        Write-Host "  ✓ $file" -ForegroundColor Gray
    }
}

# ─── Screenshots ───
Write-Host "📸 Adding screenshots..." -ForegroundColor Yellow
$screenshots = Get-ChildItem -Path . -Filter "*.jpg" -File | Where-Object { $_.Name -notlike "*node_modules*" }
foreach ($file in $screenshots) {
    $filesToZip += $file.FullName
    Write-Host "  ✓ $($file.Name)" -ForegroundColor Gray
}

# ─── Archive Files ───
Write-Host "📦 Adding archive files..." -ForegroundColor Yellow
$archives = @(
    "apps.zip",
    "ppc-claude-web-V1.zip",
    "ppc-claude-web-V1.tar.gz",
    "src-apps-packages.tar.gz",
    "migrate-files.tar.gz",
    "template-installment-bear-004.zip",
    "template-pet-orange-starter.zip",
    "template-template-03-test.zip"
)
foreach ($file in $archives) {
    if (Test-Path $file) {
        $filesToZip += $file
        $size = (Get-Item $file).Length / 1MB
        Write-Host "  ✓ $file ($([math]::Round($size, 2)) MB)" -ForegroundColor Gray
    }
}

# ─── Template Archives ───
$templateArchives = Get-ChildItem -Path "templates" -Filter "*.zip" -File -ErrorAction SilentlyContinue
foreach ($file in $templateArchives) {
    $filesToZip += $file.FullName
    Write-Host "  ✓ templates\$($file.Name)" -ForegroundColor Gray
}

# ─── Log Files ───
Write-Host "📋 Adding log files..." -ForegroundColor Yellow
$logs = Get-ChildItem -Path . -Filter "*.log" -File | Where-Object { $_.FullName -notlike "*node_modules*" }
foreach ($file in $logs) {
    $filesToZip += $file.FullName
    Write-Host "  ✓ $($file.Name)" -ForegroundColor Gray
}

# ─── Text Files (specific ones) ───
Write-Host "📄 Adding output/check files..." -ForegroundColor Yellow
$textFiles = @(
    "astro_check.txt",
    "astro_check_v2.txt",
    "astro_check_v3.txt",
    "deploy_output.txt",
    "deploy_output_v2.txt",
    "deploy_proxy_v2.txt",
    "verify_output.txt",
    "v4_d1_list.txt",
    "v5_d1_list.txt"
)
foreach ($file in $textFiles) {
    if (Test-Path $file) {
        $filesToZip += $file
        Write-Host "  ✓ $file" -ForegroundColor Gray
    }
}

# ─── Apps logs ───
$appsLogs = Get-ChildItem -Path "apps" -Filter "*.txt" -File -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notlike "*node_modules*" }
foreach ($file in $appsLogs) {
    $filesToZip += $file.FullName
    Write-Host "  ✓ $($file.FullName.Replace($PWD.Path + '\', ''))" -ForegroundColor Gray
}

# ─── Temporary Files ───
Write-Host "🗂️ Adding temporary files..." -ForegroundColor Yellow
$tempFiles = @(
    "tmp_check.html",
    "tracking-dashboard-data.json",
    "templates_response.json",
    "lc_api_response.json",
    "pro-lp-v1.template.json"
)
foreach ($file in $tempFiles) {
    if (Test-Path $file) {
        $filesToZip += $file
        Write-Host "  ✓ $file" -ForegroundColor Gray
    }
}

# ─── Debug/Fix Scripts ───
Write-Host "🔧 Adding debug/fix scripts..." -ForegroundColor Yellow
$debugScripts = @(
    "debug-connections.js",
    "fix-cloudflare-settings.mjs",
    "fix-object-error.cjs",
    "fix.tw.cjs",
    "copy-tracking.mjs",
    "setup-tracking-dashboard.mjs",
    "update-settings.mjs"
)
foreach ($file in $debugScripts) {
    if (Test-Path $file) {
        $filesToZip += $file
        Write-Host "  ✓ $file" -ForegroundColor Gray
    }
}

# ─── Batch Files ───
Write-Host "⚙️ Adding batch files..." -ForegroundColor Yellow
$batchFiles = Get-ChildItem -Path . -Filter "*.bat" -File
foreach ($file in $batchFiles) {
    $filesToZip += $file.FullName
    Write-Host "  ✓ $($file.Name)" -ForegroundColor Gray
}

# ─── PDF Files ───
Write-Host "📚 Adding PDF files..." -ForegroundColor Yellow
if (Test-Path "internet-bs-api.pdf") {
    $filesToZip += "internet-bs-api.pdf"
    Write-Host "  ✓ internet-bs-api.pdf" -ForegroundColor Gray
}

# ─── Create Archive ───
Write-Host ""
Write-Host "📦 Creating archive..." -ForegroundColor Cyan
Write-Host "Total files: $($filesToZip.Count)" -ForegroundColor White

if ($filesToZip.Count -eq 0) {
    Write-Host "❌ No files found to archive!" -ForegroundColor Red
    exit 1
}

try {
    # Use Compress-Archive
    Compress-Archive -Path $filesToZip -DestinationPath $archiveName -CompressionLevel Optimal -Force
    
    $archiveSize = (Get-Item $archiveName).Length / 1MB
    Write-Host ""
    Write-Host "✅ Archive created successfully!" -ForegroundColor Green
    Write-Host "   File: $archiveName" -ForegroundColor White
    Write-Host "   Size: $([math]::Round($archiveSize, 2)) MB" -ForegroundColor White
    Write-Host ""
    Write-Host "📋 Files archived:" -ForegroundColor Cyan
    Write-Host "   - Test scripts: $($testScripts.Count)" -ForegroundColor Gray
    Write-Host "   - Screenshots: $($screenshots.Count)" -ForegroundColor Gray
    Write-Host "   - Archives: $($archives.Count + $templateArchives.Count)" -ForegroundColor Gray
    Write-Host "   - Logs: $($logs.Count + $appsLogs.Count)" -ForegroundColor Gray
    Write-Host "   - Temp files: $($tempFiles.Count)" -ForegroundColor Gray
    Write-Host "   - Debug scripts: $($debugScripts.Count)" -ForegroundColor Gray
    Write-Host "   - Batch files: $($batchFiles.Count)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "⚠️  To delete the original files, run:" -ForegroundColor Yellow
    Write-Host "   .\delete-archived-files.ps1" -ForegroundColor White
    
} catch {
    Write-Host ""
    Write-Host "❌ Error creating archive: $_" -ForegroundColor Red
    exit 1
}
