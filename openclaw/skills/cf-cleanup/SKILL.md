---
name: lp_cf_cleanup
description: Find and remove orphaned Cloudflare Pages projects and DNS records not linked to active sites
metadata.openclaw.requires.bins: ["curl", "jq"]
---

# LP Factory Cloudflare Cleanup

Identify Cloudflare Pages projects and DNS records that are no longer linked to any active LP Factory site. Report orphans and wait for confirmation before deleting.

## When to Use

Run weekly (Sunday night). This solves the problem of Cloudflare getting cluttered with abandoned projects when domains are deleted from the dashboard but not cleaned up in CF.

## Configuration

Required environment variables:
- `LP_API_BASE`: LP Factory API base URL
- `CF_API_TOKEN`: Cloudflare API token (with Pages + DNS permissions)
- `CF_ACCOUNT_ID`: Cloudflare account ID
- `CF_ZONE_IDS`: Comma-separated zone IDs to scan for orphan DNS records
- `TELEGRAM_BOT_TOKEN`: Telegram bot token
- `TELEGRAM_CHAT_ID`: Target chat ID

## How It Works

1. Fetch active sites from LP Factory:
   ```bash
   ACTIVE_DOMAINS=$(curl -s "${LP_API_BASE}/sites" | jq -r '.sites[].domain')
   ```

2. Fetch all CF Pages projects:
   ```bash
   CF_PROJECTS=$(curl -s -H "Authorization: Bearer ${CF_API_TOKEN}" \
     "https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/pages/projects" \
     | jq -r '.result[].name')
   ```

3. Fetch DNS CNAME records for each zone:
   ```bash
   DNS_RECORDS=$(curl -s -H "Authorization: Bearer ${CF_API_TOKEN}" \
     "https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/dns_records?type=CNAME" \
     | jq '.result[] | {id, name, content}')
   ```

4. Diff to find orphans:
   - **Orphan project**: exists in CF Pages but no active site uses it
   - **Orphan DNS**: CNAME points to *.pages.dev but domain not in active sites

5. Send report via Telegram and WAIT for confirmation before deleting.

## Message Format

### Report (No Action Yet)
```
CF Cleanup Report (Weekly)

Orphaned Pages Projects (5):
  1. old-loan-site-abc
  2. test-deploy-xyz
  3. demo-template-001
  4. expired-campaign-feb
  5. backup-old-site

Orphaned DNS Records (3):
  1. oldloan.com -> old-loan-site-abc.pages.dev
  2. testsite.net -> test-deploy-xyz.pages.dev
  3. demo.example.com -> demo-template-001.pages.dev

Reply "delete all" to clean up, or specify numbers to skip.
Active sites: 15 (not affected)
```

### After Confirmation
```
CF Cleanup Complete

Deleted Projects: 5
Deleted DNS Records: 3
Skipped: 0

Active sites verified: 15/15 still live
```

## Cron Setup

```bash
openclaw cron add \
  --name "LP CF Cleanup" \
  --cron "0 22 * * 0" \
  --tz "Asia/Bangkok" \
  --session main \
  --message "Run weekly Cloudflare cleanup: find orphaned Pages projects and DNS records not linked to active LP Factory sites. Report findings and wait for my confirmation before deleting anything." \
  --announce --channel telegram
```

## Safety

- NEVER auto-delete. Always report first and wait for human confirmation.
- Verify active sites are NOT in the delete list before proceeding.
- After deletion, re-check all active domains are still reachable (HTTP 200).
- Uses `--session main` (not isolated) so it can receive confirmation replies.
