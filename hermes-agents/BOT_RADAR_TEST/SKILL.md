# BOT_RADAR_TEST — Google Ads Bot Detection Smoke Test

## Purpose
Manual/CI smoke test that simulates Google Ads bot traffic through the pixel worker
and verifies the full detection pipeline: pixel write → bot_detect → D1 write → bot-radar API.

## When to run
- After deploying pixel-worker changes
- After running BOT_IP_SYNC (to confirm IP ranges are seeded)
- Before deploying a new site (confirm detector is alive)

## Prerequisites
```bash
# Terminal 1 — pixel worker
cd apps/pixel-worker && npx wrangler dev --port 8789

# Terminal 2 — api worker (for verification)
cd apps/api-worker && npx wrangler dev --port 8787
```

## Usage
```bash
cd hermes-agents/BOT_RADAR_TEST

# Local dev (default)
python run.py

# Verbose — show each HTTP response
python run.py --verbose

# Production (verify live system)
python run.py \
  --pixel https://lp-factory-pixel.misty-feather-556e.workers.dev \
  --api   https://lp-factory-api.misty-feather-556e.workers.dev

# Or via env vars
PIXEL_WORKER_BASE=http://localhost:8789 \
API_WORKER_BASE=http://localhost:8787 \
python run.py
```

## Test scenarios
| Scenario | IP | User-Agent | Expected |
|----------|-----|-----------|----------|
| AdsBot-Google | 66.249.64.1 | AdsBot-Google | recorded, type=adsbot |
| Googlebot | 66.249.66.1 | Googlebot/2.1 | recorded, type=googlebot |
| Google-InspectionTool | 66.249.68.1 | Google-InspectionTool | recorded, type=inspection |
| AdsBot-Mobile | 66.249.70.1 | AdsBot-Google-Mobile | recorded, type=adsbot |
| Human control | 1.2.3.4 | Chrome browser | NOT recorded |

## Score breakdown
| Signals active | Score | Result |
|---------------|-------|--------|
| UA only | 0.20 | NOT recorded (< 0.50 threshold) |
| UA + PTR | 0.55 | Recorded (medium confidence) |
| UA + PTR + IP CIDR | 0.90 | Recorded, is_bot=true, high confidence |

## What it checks
1. Pixel worker is reachable (GET /health)
2. API worker is reachable (GET /api/health)
3. Baseline bot_visits count (before)
4. Sends 5 POST /e requests with spoofed headers
5. Waits 2s for async D1 writes (waitUntil)
6. Verifies delta in /api/bot-radar/summary
7. Confirms bot IPs appear in /api/bot-radar/top-ips with correct bot_type
8. Verifies human control IP is absent from top-ips
