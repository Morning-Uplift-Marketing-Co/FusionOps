# Smoke test — Google Ads / Analytics relay (Phase B)

Covers the `t.{domain}/gtag/js`, `/g/collect`, `/j/collect`, `/ccm/collect`, and `/pagead/*` routes added to `apps/api-worker/src/worker.js`.

**Scope:** verifies worker-side behavior only. LPs still load gtag directly from `googletagmanager.com` until `scripts/inject-tracking.mjs` is updated in a follow-up PR.

## Pre-flight

```bash
# From repo root
git log -1 --format='%h %s'   # expect the relay commit
npx wrangler whoami           # expect authenticated to lp-factory
```

Pick a test domain that already has a `t.{domain}/*` Workers Route bound (see `apps/api-worker/wrangler.toml`). Examples:

- `t.scratchpetlending.com`
- `t.scratchpetfinancing.com` (fixed in PR #120)

Export for convenience:

```bash
export T=t.scratchpetlending.com
```

## Phase 0 — flag off (safety regression test)

`ENABLE_GTAG_RELAY` is **unset/off by default**. All relay paths must return 404 and **NOT** disturb `/e` or `/v`.

```bash
# 1. Relay paths should 404 cleanly when flag is off
curl -sS -o /dev/null -w "%{http_code}\n" "https://$T/gtag/js?id=AW-1234567890"
# expect: 404

curl -sS -o /dev/null -w "%{http_code}\n" "https://$T/g/collect?tid=G-ABC123"
# expect: 404

# 2. Pixel still works (regression check — PR #120 behavior)
curl -sS -o /dev/null -w "%{http_code} %{content_type}\n" \
  "https://$T/e?e=smoketest_flag_off&d=$T&sid=smoke1"
# expect: 200 image/gif
```

If any of the above fail, **abort** — the route matcher is shadowing existing endpoints.

## Phase 1 — enable flag

```bash
npx wrangler deploy \
  --name lp-factory-api \
  --var ENABLE_GTAG_RELAY:1 \
  --config apps/api-worker/wrangler.toml
```

Or set via dashboard → Workers → `lp-factory-api` → Settings → Variables → Add `ENABLE_GTAG_RELAY = 1`.

## Phase 2 — loader (`/gtag/js`)

```bash
# 2a. Valid conversion ID → 200, JS body, rewritten URLs
curl -sS -D- "https://$T/gtag/js?id=AW-1234567890&l=dataLayer" -o /tmp/gtag.js
# expect: HTTP/2 200
#         content-type: application/javascript; charset=UTF-8
#         x-relay-target: loader
#         set-cookie: _gcl_aw=... (only if Referer has gclid — see 2c)

grep -c 'google-analytics.com' /tmp/gtag.js
# expect: 0  (all rewritten to https://t.{domain})

grep -c "$T" /tmp/gtag.js
# expect: >0 (rewritten references)

# 2b. Missing id → 400
curl -sS -o /dev/null -w "%{http_code}\n" "https://$T/gtag/js"
# expect: 400

# 2c. Malicious id → 400
curl -sS -o /dev/null -w "%{http_code}\n" "https://$T/gtag/js?id=../../etc/passwd"
# expect: 400

# 2d. Cookie seeding — Referer with gclid
curl -sS -D- -o /dev/null \
  -H "Referer: https://www.$(echo $T | sed 's/^t\.//')/apply?gclid=TEST_GCLID_ABC123" \
  "https://$T/gtag/js?id=AW-1234567890"
# expect: Set-Cookie: _gcl_aw=GCL.<ts>.TEST_GCLID_ABC123; Domain=.{rootdomain}; ...
```

## Phase 3 — collect beacons

```bash
# 3a. GA4 collect (GET)
curl -sS -o /dev/null -w "%{http_code}\n" \
  "https://$T/g/collect?v=2&tid=G-ABCDEF1234&cid=1.1&en=page_view"
# expect: 200 or 204 (upstream passes through — Google usually 204)

# 3b. GA4 collect (POST) — sendBeacon simulates this
curl -sS -o /dev/null -w "%{http_code}\n" -X POST \
  -H "Content-Type: text/plain;charset=UTF-8" \
  --data-raw "en=form_submit&tid=G-ABCDEF1234" \
  "https://$T/g/collect?v=2"
# expect: 200 or 204

# 3c. Ads conversion
curl -sS -o /dev/null -w "%{http_code}\n" \
  "https://$T/pagead/conversion/1234567890/?random=1&label=AbCdEfGhIj&guid=ON&script=0"
# expect: 200 or 302 (Google redirects conversion pings)
```

## Phase 4 — negative / security

```bash
# 4a. Paths under /pagead/ that are NOT in the allowlist must 404.
# Allowlisted prefixes: /pagead/conversion, /pagead/1p-conversion,
# /pagead/form-data, /pagead/viewthroughconversion.
curl -sS -o /dev/null -w "%{http_code}\n" "https://$T/pagead/arbitrary-attacker-path"
# expect: 404
curl -sS -o /dev/null -w "%{http_code}\n" "https://$T/pagead/privacy-dashboard"
# expect: 404
# Sanity: an allowlisted subpath still works
curl -sS -o /dev/null -w "%{http_code}\n" \
  "https://$T/pagead/conversion/1234567890/?random=1&label=test&guid=ON&script=0"
# expect: 200 or 302

# 4b. Unknown top-level path (not pixel, not relay) still 404s
curl -sS -o /dev/null -w "%{http_code}\n" "https://$T/random-attacker-path"
# expect: 404

# 4c. Pixel still works with flag ON
curl -sS -o /dev/null -w "%{http_code} %{content_type}\n" \
  "https://$T/e?e=smoketest_flag_on&d=$T&sid=smoke2"
# expect: 200 image/gif
```

## Phase 5 — rollback

If anything is wrong, flip the flag off (no redeploy needed) via dashboard:

```
Workers → lp-factory-api → Settings → Variables
  ENABLE_GTAG_RELAY = 0   (or delete the var)
```

All relay paths return to 404. `/e` and `/v` are unaffected either way.

## What this test does NOT cover

- LP browser integration (needs `scripts/inject-tracking.mjs` changes — next PR).
- Conversion landing in Google Ads UI (needs new `send_to` IDs wired into LP).
- Enhanced Conversions for Leads (SHA-256 PII — next PR).
- `_gcl_aw` cookie actually extending attribution window (needs real Safari session).

Those are covered in `DESIGN.md §7` (Validation Phases C–E).
