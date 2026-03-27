@echo off
echo ========================================
echo FORCE CLEAN AND REBUILD
echo ========================================
echo.

echo Step 1: Kill all node processes...
taskkill /F /IM node.exe 2>nul
timeout /t 2 >nul

echo Step 2: Clean dist and cache...
if exist dist rmdir /s /q dist
if exist node_modules\.vite rmdir /s /q node_modules\.vite
echo Done.
echo.

echo Step 3: Rebuilding...
call npm run build
echo.
call npm run dev
echo ========================================
echo REBUILD COMPLETE!
echo ========================================
echo.
echo IMPORTANT: You MUST do this in browser:
echo 1. Press Ctrl+Shift+Delete
echo 2. Select "Cached images and files"
echo 3. Select "All time"
echo 4. Click "Clear data"
echo 5. Close ALL browser windows
echo 6. Reopen browser
echo 7. Go to: http://localhost:4321
echo.
pause
