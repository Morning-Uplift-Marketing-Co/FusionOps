# Delete Archived Files Script
# Created: 2026-03-09
# Purpose: Delete files that have been archived
# ⚠️ WARNING: This will permanently delete files!

Write-Host "⚠️  DELETE ARCHIVED FILES" -ForegroundColor Red
Write-Host "This will permanently delete files that were archived." -ForegroundColor Yellow
Write-Host ""

# Check if backup exists
$latestBackup = Get-ChildItem -Path . -Filter "unnecessary-files-backup-*.zip" | Sort-Object LastWriteTime -Descending | Select-Object -First 1

if (-not $latestBackup) {
    Write-Host "❌ No backup archive found!" -ForegroundColor Red
    Write-Host "   Please run cleanup-unnecessary-files.ps1 first." -ForegroundColor Yellow
    exit 1
}

Write-Host "📦 Found backup: $($latestBackup.Name)" -ForegroundColor Cyan
Write-Host "   Created: $($latestBackup.LastWriteTime)" -ForegroundColor Gray
Write-Host "   Size: $([math]::Round($latestBackup.Length / 1MB, 2)) MB" -ForegroundColor Gray
Write-Host ""

$confirmation = Read-Host "Are you sure you want to DELETE the archived files? (yes/no)"

if ($confirmation -ne "yes") {
    Write-Host "❌ Cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "🗑️  Deleting files..." -ForegroundColor Red

$deletedCount = 0
$errorCount = 0

# ─── Test Scripts ───
$testScripts = @(
    "api-deploy-test.mjs", "create-test-domain.mjs", "deploy-template-test.mjs",
    "simple-deploy-test.mjs", "test-deploy-api.mjs", "test-real-deploy.mjs",
    "test-ui-deploy.mjs", "create-and-deploy.mjs", "direct-deploy.mjs", "real-deploy.mjs"
)
foreach ($file in $testScripts) {
    if (Test-Path $file) {
        try {
            Remove-Item $file -Force
            Write-Host "  ✓ Deleted: $file" -ForegroundColor Gray
            $deletedCount++
        } catch {
            Write-Host "  ✗ Error: $file - $_" -ForegroundColor Red
            $errorCount++
        }
    }
}

# ─── Screenshots ───
$screenshots = Get-ChildItem -Path . -Filter "*.jpg" -File | Where-Object { $_.Name -notlike "*node_modules*" }
foreach ($file in $screenshots) {
    try {
        Remove-Item $file.FullName -Force
        Write-Host "  ✓ Deleted: $($file.Name)" -ForegroundColor Gray
        $deletedCount++
    } catch {
        Write-Host "  ✗ Error: $($file.Name) - $_" -ForegroundColor Red
        $errorCount++
    }
}

# ─── Archive Files ───
$archives = @(
    "apps.zip", "ppc-claude-web-V1.zip", "ppc-claude-web-V1.tar.gz",
    "src-apps-packages.tar.gz", "migrate-files.tar.gz",
    "template-installment-bear-004.zip", "template-pet-orange-starter.zip",
    "template-template-03-test.zip"
)
foreach ($file in $archives) {
    if (Test-Path $file) {
        try {
            Remove-Item $file -Force
            Write-Host "  ✓ Deleted: $file" -ForegroundColor Gray
            $deletedCount++
        } catch {
            Write-Host "  ✗ Error: $file - $_" -ForegroundColor Red
            $errorCount++
        }
    }
}

# ─── Template Archives ───
$templateArchives = Get-ChildItem -Path "templates" -Filter "*.zip" -File -ErrorAction SilentlyContinue
foreach ($file in $templateArchives) {
    try {
        Remove-Item $file.FullName -Force
        Write-Host "  ✓ Deleted: templates\$($file.Name)" -ForegroundColor Gray
        $deletedCount++
    } catch {
        Write-Host "  ✗ Error: templates\$($file.Name) - $_" -ForegroundColor Red
        $errorCount++
    }
}

# ─── Log Files ───
$logs = Get-ChildItem -Path . -Filter "*.log" -File | Where-Object { $_.FullName -notlike "*node_modules*" }
foreach ($file in $logs) {
    try {
        Remove-Item $file.FullName -Force
        Write-Host "  ✓ Deleted: $($file.Name)" -ForegroundColor Gray
        $deletedCount++
    } catch {
        Write-Host "  ✗ Error: $($file.Name) - $_" -ForegroundColor Red
        $errorCount++
    }
}

# ─── Text Files ───
$textFiles = @(
    "astro_check.txt", "astro_check_v2.txt", "astro_check_v3.txt",
    "deploy_output.txt", "deploy_output_v2.txt", "deploy_proxy_v2.txt",
    "verify_output.txt", "v4_d1_list.txt", "v5_d1_list.txt"
)
foreach ($file in $textFiles) {
    if (Test-Path $file) {
        try {
            Remove-Item $file -Force
            Write-Host "  ✓ Deleted: $file" -ForegroundColor Gray
            $deletedCount++
        } catch {
            Write-Host "  ✗ Error: $file - $_" -ForegroundColor Red
            $errorCount++
        }
    }
}

# ─── Apps logs ───
$appsLogs = Get-ChildItem -Path "apps" -Filter "*.txt" -File -Recurse -ErrorAction SilentlyContinue | Where-Object { $_.FullName -notlike "*node_modules*" }
foreach ($file in $appsLogs) {
    try {
        Remove-Item $file.FullName -Force
        Write-Host "  ✓ Deleted: $($file.FullName.Replace($PWD.Path + '\', ''))" -ForegroundColor Gray
        $deletedCount++
    } catch {
        Write-Host "  ✗ Error: $($file.FullName.Replace($PWD.Path + '\', '')) - $_" -ForegroundColor Red
        $errorCount++
    }
}

# ─── Temporary Files ───
$tempFiles = @(
    "tmp_check.html", "tracking-dashboard-data.json", "templates_response.json",
    "lc_api_response.json", "pro-lp-v1.template.json"
)
foreach ($file in $tempFiles) {
    if (Test-Path $file) {
        try {
            Remove-Item $file -Force
            Write-Host "  ✓ Deleted: $file" -ForegroundColor Gray
            $deletedCount++
        } catch {
            Write-Host "  ✗ Error: $file - $_" -ForegroundColor Red
            $errorCount++
        }
    }
}

# ─── Debug Scripts ───
$debugScripts = @(
    "debug-connections.js", "fix-cloudflare-settings.mjs", "fix-object-error.cjs",
    "fix.tw.cjs", "copy-tracking.mjs", "setup-tracking-dashboard.mjs", "update-settings.mjs"
)
foreach ($file in $debugScripts) {
    if (Test-Path $file) {
        try {
            Remove-Item $file -Force
            Write-Host "  ✓ Deleted: $file" -ForegroundColor Gray
            $deletedCount++
        } catch {
            Write-Host "  ✗ Error: $file - $_" -ForegroundColor Red
            $errorCount++
        }
    }
}

# ─── Batch Files ───
$batchFiles = Get-ChildItem -Path . -Filter "*.bat" -File
foreach ($file in $batchFiles) {
    try {
        Remove-Item $file.FullName -Force
        Write-Host "  ✓ Deleted: $($file.Name)" -ForegroundColor Gray
        $deletedCount++
    } catch {
        Write-Host "  ✗ Error: $($file.Name) - $_" -ForegroundColor Red
        $errorCount++
    }
}

# ─── PDF Files ───
if (Test-Path "internet-bs-api.pdf") {
    try {
        Remove-Item "internet-bs-api.pdf" -Force
        Write-Host "  ✓ Deleted: internet-bs-api.pdf" -ForegroundColor Gray
        $deletedCount++
    } catch {
        Write-Host "  ✗ Error: internet-bs-api.pdf - $_" -ForegroundColor Red
        $errorCount++
    }
}

# ─── Empty Folders ───
Write-Host ""
Write-Host "🗂️  Removing empty folders..." -ForegroundColor Yellow
$emptyFolders = @("tmp", "test-artifacts", "dist")
foreach ($folder in $emptyFolders) {
    if (Test-Path $folder) {
        try {
            Remove-Item $folder -Recurse -Force -ErrorAction SilentlyContinue
            Write-Host "  ✓ Deleted: $folder\" -ForegroundColor Gray
        } catch {
            Write-Host "  ✗ Error: $folder\ - $_" -ForegroundColor Red
        }
    }
}

# ─── Summary ───
Write-Host ""
Write-Host "✅ Cleanup complete!" -ForegroundColor Green
Write-Host "   Deleted: $deletedCount files" -ForegroundColor White
if ($errorCount -gt 0) {
    Write-Host "   Errors: $errorCount files" -ForegroundColor Red
}
Write-Host ""
Write-Host "📦 Backup archive: $($latestBackup.Name)" -ForegroundColor Cyan
Write-Host "   Keep this file safe in case you need to restore!" -ForegroundColor Yellow
