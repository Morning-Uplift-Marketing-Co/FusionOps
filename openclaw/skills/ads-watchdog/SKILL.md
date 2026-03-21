---
name: lp_ads_watchdog
description: Monitor Google Ads accounts via Multilogin browser profiles for policy violations and suspensions
metadata.openclaw.requires.bins: ["curl", "jq"]
---

# LP Factory Google Ads Watchdog (via Multilogin)

Monitor Google Ads accounts for policy violations, ad disapprovals, and account suspensions. Uses Multilogin browser profiles (each logged into a different Google Ads account) instead of Google Ads API.

## Why Multilogin Instead of Google Ads API

- Multiple Google Ads accounts across different identities
- Each account has its own Multilogin browser profile (already logged in)
- Google Ads API requires single MCC — not possible with multi-identity setup

## Configuration

Required environment variables:
- `MLX_EMAIL`: Multilogin account email
- `MLX_PASSWORD`: Multilogin account password (MD5 hashed by API)
- `MLX_LAUNCHER`: Local launcher URL (default: `https://launcher.mlx.yt:45001`)
- `MLX_API_BASE`: Remote API URL (default: `https://api.multilogin.com`)
- `TELEGRAM_BOT_TOKEN`: Telegram bot token
- `TELEGRAM_CHAT_ID`: Target chat ID

Profile-to-account mapping (configure in skill):
```json
{
  "profiles": [
    { "profileId": "uuid-1", "accountName": "Main Account", "adsId": "123-456-7890" },
    { "profileId": "uuid-2", "accountName": "Backup Account", "adsId": "098-765-4321" },
    { "profileId": "uuid-3", "accountName": "Scale Account", "adsId": "111-222-3333" }
  ]
}
```

## How It Works

### Step 1: Authenticate with Multilogin

```bash
# Get auth token
MLX_TOKEN=$(curl -s -X POST "${MLX_API_BASE}/user/signin" \
  -H "Content-Type: application/json" \
  -d '{"email":"'${MLX_EMAIL}'","password":"'${MLX_PASSWORD_MD5}'"}' \
  | jq -r '.data.token')
```

### Step 2: For Each Profile, Start Browser + Check Ads

```bash
# Start browser profile (returns Selenium/Puppeteer connection port)
RESULT=$(curl -s -X GET "${MLX_LAUNCHER}/api/v2/profile/start?profileId=${PROFILE_ID}&automation_type=puppeteer" \
  -H "Authorization: Bearer ${MLX_TOKEN}")

BROWSER_PORT=$(echo $RESULT | jq -r '.data.port')
WS_ENDPOINT=$(echo $RESULT | jq -r '.data.wsEndpoint')
```

### Step 3: Browser Automation via Puppeteer

Connect to the running Multilogin browser and check Google Ads:

1. Navigate to `https://ads.google.com/aw/overview`
2. Check for notification banner (policy alerts, account issues)
3. Navigate to `https://ads.google.com/aw/ads` → filter "Disapproved"
4. Extract: ad count with DISAPPROVED status
5. Check account status bar for suspension warnings
6. Take screenshot for evidence

### Step 4: Stop Browser Profile

```bash
curl -s -X GET "${MLX_LAUNCHER}/api/v2/profile/stop?profileId=${PROFILE_ID}" \
  -H "Authorization: Bearer ${MLX_TOKEN}"
```

### Step 5: Send Telegram Alert

Only send if issues found.

## Message Format

### All Clear
```
Google Ads Check: All 3 accounts OK
Profiles checked: Main, Backup, Scale
Next check: 2 hours
```

### Issues Found
```
GOOGLE ADS ALERT

Main Account (123-456-7890):
  - 2 ads DISAPPROVED
  - Reason: "Misleading claims" on ad #98765
  - Screenshot: [attached]

Scale Account (111-222-3333):
  - ACCOUNT SUSPENDED
  - Banner: "Policy violation under review"
  - Screenshot: [attached]

Backup Account (098-765-4321): OK

ACTION: Pause affected campaigns to stop wasted spend
```

## Cron Setup

```bash
openclaw cron add \
  --name "LP Ads Watchdog" \
  --cron "0 */2 * * *" \
  --session isolated \
  --message "Check all Google Ads accounts via Multilogin browser profiles. For each profile: start browser, navigate to Google Ads, check for disapproved ads and account suspensions, take screenshots, stop browser. Alert via Telegram if any issues found." \
  --announce --channel telegram
```

## Safety

- Read-only browser interaction (no campaign modifications)
- Always stop browser profile after check (prevent resource leak)
- Screenshot evidence attached to alerts
- Max 5 minutes per profile check (timeout and move to next)
- If Multilogin launcher is not running, skip check and log warning
