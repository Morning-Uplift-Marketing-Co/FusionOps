# Per-Account Runbook — Google Ads Setup (5 min)

Checklist to run **every time you spin up a new Google Ads account** for an LP Factory domain.

## Prerequisites

- [ ] Google Ads account access with Admin or Standard role
- [ ] Access to `deploy-configs/{domain}.json` in the ppc-claude-web-V1 repo
- [ ] Voluum dashboard access (to link this new Ads account)

## Step 1 — Verify conversion ID exists (30 seconds)

1. Google Ads UI → **Tools** → **Conversions**
2. Top of page shows conversion ID: `AW-XXXXXXXXX`
3. If missing, click **New conversion action** → Website → skip through setup → the ID will be assigned

Record: `AW-________________`

## Step 2 — Create `form_start` conversion action (90 seconds)

1. Google Ads UI → **Tools** → **Conversions** → **+ New conversion action**
2. Source: **Website**
3. URL: `https://{domain}` → Scan (can skip if prompted)
4. Click **Add a conversion action manually**
5. Fill in:

| Field | Value |
|---|---|
| Goal and action optimization | Lead → Submit lead form |
| **Conversion name** | `form_start` |
| Value | Don't use a value |
| Count | Every |
| Click-through conversion window | 30 days |
| View-through conversion window | 1 day |
| Include in "Conversions" | **OFF (observation only)** |
| Attribution model | Data-driven (or Last click if data-driven unavailable) |

6. Save
7. On the **Tag setup** page, click **Use Google tag**
8. Copy the **Conversion label** (the string after `/` in `send_to`)

Record: `gtagFormStartLabel = ________________`

## Step 3 — Create `form_submit` conversion action (90 seconds)

Same as Step 2 but with:

| Field | Value |
|---|---|
| **Conversion name** | `form_submit` |
| Value | Use the same value — $5 USD |
| Count | Every |
| Click-through conversion window | 30 days |
| View-through conversion window | 1 day |
| Include in "Conversions" | **ON (primary)** |
| Attribution model | Data-driven |

Save → copy conversion label.

Record: `gtagFormSubmitLabel = ________________`

## Step 4 — Enable Enhanced Conversions for Leads (60 seconds)

1. In the `form_submit` conversion action detail page, scroll to **Enhanced conversions**
2. Toggle **Turn on enhanced conversions**
3. Select **Enter conversion details within your code** → **Google tag**
4. Accept the customer data terms
5. Save

(No code action needed — `scripts/inject-tracking.mjs` already sends `user_data` via `gtag('set', ...)`)

## Step 5 — Verify Voluum → Google Ads integration is live (60 seconds)

This is **existing** setup but verify it still works for the new Ads account:

1. Voluum dashboard → Settings → Integrations → **Google Ads**
2. Confirm the Ads account is linked (OAuth green check)
3. Confirm the conversion action Voluum uploads to is the **sold_lead** action (or whatever its name is) — **NOT** `form_submit` or `form_start`
4. If Voluum's mapped conversion is wrong → update mapping in Voluum dashboard

⚠️ **Critical:** Voluum must map to a conversion action whose name does NOT collide with browser-fired actions (`form_start`, `form_submit`). Name collision = double-count = Smart Bidding corruption.

## Step 6 — Update deploy-config (30 seconds)

Edit `deploy-configs/{domain}.json`:

```jsonc
{
  // ... existing fields ...
  "conversionId": "AW-XXXXXXXXX",               // from Step 1
  "gtagFormStartLabel": "xXx_________Cxx",      // from Step 2
  "gtagFormSubmitLabel": "yYy_________Cyy",     // from Step 3
  "formStartLabel": "xXx_________Cxx",          // duplicate for backward compat
  "formSubmitLabel": "yYy_________Cyy"          // duplicate for backward compat
}
```

Commit:

```bash
git add deploy-configs/{domain}.json
git commit -m "tracking({domain}): register conversion labels for new Ads account"
git push
```

This triggers `deploy-lp.yml` → LP rebuilds with the new labels → tracking active within ~2 min.

## Step 7 — Smoke test (90 seconds)

1. Open LP in incognito Chrome: `https://{domain}?gclid=test_gclid_12345`
2. DevTools → Network tab → filter for `t.{domain}`
3. Verify:
   - `GET /gtag/js?id=AW-XXX` returns 200 `application/javascript`
   - `GET /g/collect?...` fires on page load
4. Interact with ZIP field or amount slider
5. Verify `GET /pagead/conversion/AW-XXX/?label=FORM_START_LABEL...` appears
6. Submit the form (test lead)
7. Verify `GET /pagead/conversion/AW-XXX/?label=FORM_SUBMIT_LABEL&value=5...` appears
8. Google Ads UI → Conversions → `form_submit` → wait 5-10 min → should show "Recent conversions: 1"

## Troubleshooting

### `/gtag/js?id=...` returns 400

- Check conversion ID format: must be `AW-\d+`. Anything else is rejected by the worker allowlist.

### `/gtag/js?id=...` returns 502/504

- Upstream Google outage. Relay has no caching for `/gtag/js` — fallback requires setting `transport_url` empty in `scripts/inject-tracking.mjs`. Emergency only.

### No `/pagead/conversion/*` in Network tab

- Conversion labels not present in deploy-config → `window.__formSubmitLabel` is empty → fire point skipped
- Fix: re-verify Step 6 committed correctly

### Google Ads says "No recent conversions"

- Check time: Google Ads has 3-24h lag for new conversion actions
- Check `pixel_events` D1 for `lg_submit` events — if present but Google Ads shows zero, the `/pagead/*` relay is broken

### Enhanced Conversions "No data yet"

- Wait 24h — EC4L batch processing is slow
- If still empty: Tag Assistant → find `form_submit` event → inspect `user_data` block — must be present with 64-char lowercase hex strings

### Double-counted sold_lead

- Go to Voluum → check conversion action name → if it is `form_submit`, rename it to `sold_lead` or anything unique
- Or: rename browser `form_submit` in deploy-config to `form_submit_lp` or similar

## Estimated per-account time

- **First time on a new account:** 5-7 minutes
- **Subsequent accounts (muscle memory):** 3 minutes

## Paper trail

Keep a log in `.planning/specs/tracking-pipeline-v1/accounts-log.md` (create when first used) of:

| Date | Domain | AW-ID | form_start label | form_submit label | Notes |
|---|---|---|---|---|---|
| YYYY-MM-DD | example.com | AW-123 | ABC | XYZ | First rollout |
