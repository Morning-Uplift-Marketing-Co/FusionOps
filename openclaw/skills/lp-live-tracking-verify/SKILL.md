---
name: lp_live_tracking_verify
description: After deploy, verify a live LP URL for HTML leaks, basic HTTP, and tracking markers (gtag, Voluum/pixel, first-party /e). Read-only fetches.
metadata.openclaw.requires.bins: ["curl"]
---

# LP Factory — Live site tracking verification

## When to use

- User pasted a production/staging URL after deploy.
- Cron/heartbeat: spot-check new domains from deploy notifications.
- Phrases: "เช็ค pixel", "tracking ครบไหม", "หน้าเว็บหลัง deploy", "gtag", "Voluum".

## Constants

- `TARGET_URL`: full `https://...` URL (no credentials in URL).
- Optional `EXPECTED_DOMAIN`: apex for first-party pixel host `t.{domain}` (infer from URL if omitted).

## Safety

- Read-only: GET HTML, no POST, no login stuffing.
- Do not exfiltrate PII from page content into logs beyond short snippets.
- If response is not HTML (JSON, etc.), report and stop.

## Procedure

1. **HTTP + final URL**

   ```bash
   curl -sL -o /tmp/lp-check.html -w "code=%{http_code} redirect=%{url_effective}\n" --max-time 25 "$TARGET_URL"
   ```

   Expect `code=200`. Note final URL after redirects.

2. **Astro / template leak** (must NOT appear as raw text)

   ```bash
   grep -E '\{(title|brand|voluumDomain|conversionId|noindex)[^}]*\}' /tmp/lp-check.html || true
   ```

   If matches look like visible leaks (not inside `<script>`), flag **FAIL: expression leak**.

3. **Tracking markers** (adjust patterns if product changes)

   | Check | Suggested grep |
   |-------|----------------|
   | Google Ads / gtag | `grep -iE 'gtag|googletagmanager|AW-[0-9]' /tmp/lp-check.html` |
   | Voluum / direct tracking | `grep -iE 'voluum|dtpCallback|data-voluum' /tmp/lp-check.html` |
   | First-party pixel / beacon | `grep -iE 'sendBeacon|/e[\"'\'']|t\.[^/]+\.[^/]+/e' /tmp/lp-check.html` |

   Document which checks **passed / missing**. Missing is OK only if user said tracking disabled for this LP.

4. **Optional — headless**  
   If browser tool available: open URL, check console for red errors, one CTA click path.

5. **Telegram / chat summary**

   ```
   Live check: {domain}
   HTTP: 200 | Final: {url}
   Leak: PASS/FAIL
   gtag: Y/N | Voluum markers: Y/N | fp/beacon: Y/N
   ```

## Reference

- `docs/template-worker-deploy-checklist.md` § Runtime QA / pixel checks
