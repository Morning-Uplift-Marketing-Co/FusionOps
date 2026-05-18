# BOT_IP_SYNC — Google Bot IP Range Sync

**Daily sync of Google's official bot IP ranges into Cloudflare D1.**

## Configuration

```yaml
schedule: "0 3 * * *"   # Daily 03:00 UTC
```

## Behavior

1. Fetch Google's official JSON IP lists:
   - https://developers.google.com/static/search/apis/ipranges/googlebot.json
   - https://developers.google.com/static/search/apis/ipranges/special-crawlers.json
   - https://developers.google.com/static/search/apis/ipranges/user-triggered-fetchers.json
2. Parse CIDR ranges (IPv4 + IPv6)
3. POST to Cloudflare D1 via API Worker endpoint `/api/bot-ip-sync`
4. Update `bot_ip_ranges` table (REPLACE strategy)
5. Log summary: count of ranges per source

## Environment Variables

```
CF_API_TOKEN=...
API_WORKER_BASE=https://lp-factory-api.misty-feather-556e.workers.dev
BOT_IP_SYNC_TELEGRAM_CHAT_ID=...
BOT_IP_SYNC_TELEGRAM_BOT_TOKEN=...
```

## Output

```
🤖 BOT IP SYNC COMPLETE

Sources synced:
- googlebot.json: 47 ranges (IPv4: 28, IPv6: 19)
- special-crawlers.json: 12 ranges
- user-triggered-fetchers.json: 8 ranges

Total: 67 CIDR ranges updated
Last sync: 2026-05-18T03:00:00Z
```
