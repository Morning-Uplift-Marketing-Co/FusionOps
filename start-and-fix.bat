@echo off
echo ========================================
echo START DEV SERVER + AUTO-FIX SETTINGS
echo ========================================
echo.

echo Step 1: Starting dev server...
start "Dev Server" cmd /k "npm run dev"
echo.
echo Waiting for server to start...
timeout /t 8 >nul

echo Step 2: Auto-fixing Cloudflare settings...
node fix-cloudflare-settings.mjs

echo.
echo ========================================
echo DONE!
echo ========================================
echo.
echo 1. Browser should auto-open with fixed settings
echo 2. Or manually go to: http://localhost:4321
echo 3. If needed, hard refresh with Ctrl+Shift+R
echo.
pause
