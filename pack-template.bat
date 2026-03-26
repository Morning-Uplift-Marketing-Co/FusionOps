@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

REM FusionOps: run pack-template.mjs from repo root
REM Drag-drop a folder onto this .bat, or double-click and paste path.

set "SRC=%~1"
if "!SRC!"=="" (
  set /p "SRC=Path to template folder under repo or absolute (e.g. templates\my-lp): "
)
if not exist "!SRC!\" (
  echo ERROR: Folder not found: !SRC!
  pause
  exit /b 1
)

for %%I in ("!SRC!") do set "BASENAME=%%~nxI"
set /p "TID=Template ID [default: !BASENAME!]: "
if "!TID!"=="" set "TID=!BASENAME!"

set /p "DISP=Display name (optional, Enter to skip): "

echo.
echo Repo: %cd%
echo Source: !SRC!
echo Template ID: !TID!
echo.

if not "!DISP!"=="" (
  call npm run pack-template -- "!SRC!" "!TID!" --name "!DISP!"
) else (
  call npm run pack-template -- "!SRC!" "!TID!"
)

echo.
echo Done. See script output for ZIP / path.
pause
