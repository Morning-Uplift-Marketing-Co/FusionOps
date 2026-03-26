@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

REM FusionOps: run prepare-bolt-astro-import from repo root
REM - Double-click: prompts for folder path + template id
REM - Drag-drop a folder onto this .bat: uses that folder as source (still asks template id)

set "SRC=%~1"
if "!SRC!"=="" (
  set /p "SRC=Path to exported template folder (e.g. H:\export\my-lp): "
)
if not exist "!SRC!\" (
  echo ERROR: Folder not found: !SRC!
  pause
  exit /b 1
)

set "TID="
if not "!SRC!"=="" (
  for %%I in ("!SRC!") do set "BASENAME=%%~nxI"
)
set /p "TID=Template ID [default: !BASENAME!]: "
if "!TID!"=="" set "TID=!BASENAME!"

echo.
echo Repo: %cd%
echo Source: !SRC!
echo Template ID: !TID!
echo.

call npm run prepare-bolt-astro-import -- "!SRC!" "!TID!"

echo.
echo Done. Check tmp\prepared-template-imports — copy the folder into templates\!TID! if needed.
pause
