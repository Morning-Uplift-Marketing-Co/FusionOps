---
name: lp_domain_health
description: Check all deployed LP domains for uptime, SSL validity, and DNS correctness
metadata.openclaw.requires.bins: ["curl", "dig"]
---

# LP Factory Domain Health Check

Periodically verify that all deployed landing page domains are live, SSL is valid, and DNS records point to the correct Cloudflare Pages project.

## When to Use

Run on cron every 6 hours. Alert immediately when a domain goes down, SSL is expiring soon, or DNS is misconfigured.

## Configuration

Required environment variables:
- `LP_API_BASE`: LP Factory API base URL (e.g., `https://your-worker.workers.dev`)
- `TELEGRAM_BOT_TOKEN`: Telegram bot API token
- `TELEGRAM_CHAT_ID`: Target chat ID

## How It Works

1. Fetch all active sites:
   ```bash
   curl -s "${LP_API_BASE}/sites" | jq '.sites[] | select(.status == "active")'
   ```

2. For each domain, run 3 checks:

   **HTTP Check** — Domain responds with 200:
   ```bash
   curl -sL -o /dev/null -w "%{http_code}" --max-time 10 "https://${DOMAIN}"
   ```

   **SSL Check** — Certificate not expiring within 7 days:
   ```bash
   echo | openssl s_client -servername ${DOMAIN} -connect ${DOMAIN}:443 2>/dev/null | openssl x509 -noout -enddate
   ```

   **DNS Check** — CNAME points to *.pages.dev:
   ```bash
   dig +short CNAME ${DOMAIN}
   ```

3. Collect failures and send single Telegram summary.

## Message Format

### All Healthy
```
Domain Health: All 15 domains OK
Next check: 6 hours
```

### Issues Found
```
DOMAIN HEALTH ALERT

DOWN (HTTP != 200):
  - badloan.com (503)
  - quickcash.net (timeout)

SSL EXPIRING (<7 days):
  - fastoffer.com (expires Mar 25)

DNS MISMATCH:
  - newloan.com (CNAME -> old-project.pages.dev)

Healthy: 12/15 domains
```

## Cron Setup

```bash
openclaw cron add \
  --name "LP Domain Health" \
  --cron "0 */6 * * *" \
  --session isolated \
  --message "Run domain health check on all active LP Factory sites. Check HTTP status, SSL expiry, and DNS CNAME for each domain. Report issues via Telegram." \
  --announce --channel telegram
```

## Safety

- All checks are read-only (HTTP GET, DNS lookup, SSL check)
- 10-second timeout per domain to avoid hanging
- Batch results into single message (no spam)
