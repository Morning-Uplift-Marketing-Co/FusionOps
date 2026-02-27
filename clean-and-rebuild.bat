@echo off
echo Cleaning build cache...
rmdir /s /q dist 2>nul
rmdir /s /q node_modules\.vite 2>nul
echo Done.
echo.
echo Building...
call npm run build
echo.
echo Build complete! Please refresh browser with Ctrl+Shift+R
pause
