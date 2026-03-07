param([string]$Token)

if (-not $Token) {
    Write-Error "Usage: .\push-workflow.ps1 -Token ghp_xxxxx"
    exit 1
}

$repo = "Morning-Uplift-Marketing-Co/FusionOps"
$branch = "main"
$headers = @{
    "Authorization" = "Bearer $Token"
    "Accept" = "application/vnd.github+json"
    "X-GitHub-Api-Version" = "2022-11-28"
    "Content-Type" = "application/json"
}

function Push-File($filePath, $localPath, $message) {
    $content = Get-Content $localPath -Raw -Encoding UTF8
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($content)
    $b64 = [Convert]::ToBase64String($bytes)
    
    $url = "https://api.github.com/repos/$repo/contents/$filePath"
    
    # Get current SHA
    try {
        $existing = Invoke-RestMethod -Uri "$url`?ref=$branch" -Headers $headers -Method Get
        $sha = $existing.sha
        Write-Host "Found existing SHA: $($sha.Substring(0,7))"
    } catch {
        $sha = $null
        Write-Host "File does not exist yet"
    }
    
    $body = @{ message = $message; content = $b64; branch = $branch }
    if ($sha) { $body.sha = $sha }
    
    $bodyJson = $body | ConvertTo-Json
    
    try {
        $result = Invoke-RestMethod -Uri $url -Headers $headers -Method Put -Body $bodyJson
        Write-Host "OK $filePath -> $($result.commit.sha.Substring(0,7))"
    } catch {
        Write-Error "FAIL $filePath : $_"
    }
}

$root = "f:\AI_Workspace\beta-project\ppc-claude-web-V1"

Push-File ".github/workflows/deploy-lp.yml" "$root\.github\workflows\deploy-lp.yml" "fix: fetch-depth 2 + fallback config finder"
Push-File "templates/installment-bear/tsconfig.json" "$root\templates\installment-bear\tsconfig.json" "fix: add tsconfig.json for Astro build"

Write-Host "Done. Now redeploy from UI."
