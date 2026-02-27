@echo off
echo ============================================
echo  Deploy API Worker + Pixel Worker
echo ============================================
echo.

REM Step 1: Deploy API Worker (has new pixel-provision endpoint)
echo [1/3] Deploying API Worker...
cd /d F:\AI_Workspace\beta-project\ppc-claude-web-V1\apps\api-worker
call npx wrangler deploy
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: API Worker deploy failed!
    pause
    exit /b 1
)
echo [1/3] API Worker deployed OK
echo.

REM Step 2: Run Pixel Worker D1 migrations (if not already)
echo [2/3] Running Pixel Worker D1 migrations...
cd /d F:\AI_Workspace\beta-project\ppc-claude-web-V1\apps\pixel-worker
call npx wrangler d1 migrations apply fusionops-pixel-new-v2 --remote
echo [2/3] Migrations applied (or already up-to-date)
echo.

REM Step 3: Deploy Pixel Worker
echo [3/3] Deploying Pixel Worker...
call npx wrangler deploy
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Pixel Worker deploy failed!
    pause
    exit /b 1
)
echo [3/3] Pixel Worker deployed OK
echo.

echo ============================================
echo  All workers deployed successfully!
echo  
echo  New endpoints:
echo    POST /api/automation/cf/worker-route
echo    POST /api/automation/cf/pixel-provision
echo  
echo  On next LP deploy, t.{domain} will be
echo  auto-provisioned (DNS + Worker Route)
echo ============================================
pause
