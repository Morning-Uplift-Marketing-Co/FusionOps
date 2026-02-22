# Module 2 — Tracking & Conversion Implementation Guide

> For AI IDE (Claude Code / Cursor) — Complete technical spec for implementing the tracking layer in LP Factory V2 landing pages.

---

## Architecture Overview

This system uses a **zero-GTM, zero-GA4** tracking architecture. Google Tag Manager and Google Analytics 4 are intentionally excluded because Google Ads accounts have short lifespans in multi-account operations — when an account gets banned, all GTM containers and GA4 properties linked to it are lost.

Instead, we use three independent layers:

```
Layer 1: gtag.js (Google Ads only)
  Purpose: Send micro-conversion signals to Google Ads Smart Bidding AI
  Scope: Only 2 events (form_start, form_submit)
  Dependency: Only requires AW-XXXXXXXXX (Conversion ID), easily swapped per account

Layer 2: Custom First-Party Pixel (Cloudflare Worker)
  Purpose: Permanent analytics storage owned by us, independent of any Google account
  Scope: All events (page_view, scroll, time, form events, success)
  Storage: Cloudflare D1 database
  Delivery: navigator.sendBeacon() — non-blocking, survives page unload

Layer 3: Voluum
  Purpose: Click tracking (redirect) + sold_lead server-to-server postback to Google Ads
  Scope: Click attribution + final conversion (revenue)
  Method: Voluum receives postback from affiliate network, then fires s2s to Google Ads
```

---

## Why Only 3 Conversion Actions

Google Ads AI (Smart Bidding) works best with clear, non-diluted signals. More conversion actions = more noise = worse optimization.

| Action | Google Ads Type | Trigger | Purpose |
|---|---|---|---|
| `form_start` | Secondary | User shows intent (interacts with amount selector, ZIP input, or LeadsGate form loads) | Tells AI which audiences have intent. Secondary = AI observes but does NOT optimize bids for this. |
| `form_submit` | Primary | User submits the LeadsGate form | Tells AI which audiences complete forms. Primary = AI optimizes bids for this. |
| `sold_lead` | Primary | Affiliate network approves the lead | Tells AI which audiences generate actual revenue. Primary = AI optimizes bids for this. Sent via Voluum s2s postback, NOT via on-page script. |

**Secondary** conversions are "observation only" — Google Ads AI sees them as helpful context but does NOT use them to set bid amounts.
**Primary** conversions are what Smart Bidding actually optimizes toward (tCPA, tROAS, Maximize Conversions).

---

## gtag.js Setup (Layer 1)

### What to include in every LP

```html
<!-- Google Ads conversion tracking only — NO GA4, NO GTM -->
<script async src="https://www.googletagmanager.com/gtag/js?id=AW-{CONVERSION_ID}"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'AW-{CONVERSION_ID}');
</script>
```

Replace `{CONVERSION_ID}` with the value from `config/brands/{brand}.json` > `gads_conversion_id`.

### How to fire conversion events

```javascript
// form_start — fire ONCE per session
gtag('event', 'conversion', {
  send_to: 'AW-{CONVERSION_ID}/{FORM_START_LABEL}'
});

// form_submit — fire when user submits form
gtag('event', 'conversion', {
  send_to: 'AW-{CONVERSION_ID}/{FORM_SUBMIT_LABEL}'
});
```

Labels come from `config/brands/{brand}.json` > `gads_labels.form_start` and `gads_labels.form_submit`.

### Important: AW-ID is the only Google dependency

When a Google Ads account gets banned, the only thing that changes is `AW-{CONVERSION_ID}` and the two labels. Everything else (pixel, Voluum, LP structure) stays the same. This is stored in the brand JSON config and injected at build time.

---

## Custom First-Party Pixel (Layer 2)

### Architecture

```
LP page loads
  > tracking-pixel.js generates a session ID
  > fires events via navigator.sendBeacon() to https://t.{domain}.com/e
  > CF Worker receives event, writes to D1 database
  > returns 204 No Content (empty response, minimal bandwidth)
```

### Why first-party subdomain

`https://t.bearloannow.com/e` is a first-party subdomain. Ad blockers and browser privacy features block third-party tracking domains (like google-analytics.com) but cannot block first-party subdomains without breaking the site itself.

### tracking-pixel.js implementation

```javascript
(function() {
  const PIXEL_URL = 'https://t.' + window.location.hostname + '/e';
  const sid = crypto.randomUUID();
  const clickid = new URLSearchParams(window.location.search).get('clickid') || '';
  const gclid = new URLSearchParams(window.location.search).get('gclid') || '';

  function fire(event, data) {
    const params = new URLSearchParams({
      e: event,
      sid: sid,
      cid: clickid,
      gid: gclid,
      ts: Date.now(),
      url: window.location.pathname,
      ref: document.referrer,
      ...data
    });
    navigator.sendBeacon(PIXEL_URL, params);
  }

  // Page view — immediate
  fire('pv', {
    ua: navigator.userAgent,
    sw: screen.width,
    sh: screen.height
  });

  // Scroll tracking
  let scrollFired = {};
  window.addEventListener('scroll', function() {
    const pct = Math.round((window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100);
    [25, 50, 75, 100].forEach(function(threshold) {
      if (pct >= threshold && !scrollFired[threshold]) {
        scrollFired[threshold] = true;
        fire('s' + threshold);
      }
    });
  });

  // Time on page
  setTimeout(function() { fire('t30'); }, 30000);
  setTimeout(function() { fire('t60'); }, 60000);

  // Expose for use by LeadsGate callbacks and form interactions
  window.__pixel = fire;
})();
```

### CF Worker endpoint

```javascript
// Worker: t.{domain}.com/e
export default {
  async fetch(request, env) {
    if (request.method !== 'POST') {
      return new Response('', { status: 405 });
    }

    try {
      const body = await request.text();
      const params = new URLSearchParams(body);

      await env.DB.prepare(
        `INSERT INTO pixel_events (event, session_id, click_id, gclid, timestamp, url, referrer, domain, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        params.get('e'),
        params.get('sid'),
        params.get('cid'),
        params.get('gid'),
        params.get('ts'),
        params.get('url'),
        params.get('ref'),
        new URL(request.url).hostname,
        body
      ).run();

      return new Response('', {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-store'
        }
      });
    } catch (e) {
      return new Response('', { status: 500 });
    }
  }
};
```

### D1 Schema for pixel events

```sql
CREATE TABLE IF NOT EXISTS pixel_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event TEXT NOT NULL,
    session_id TEXT DEFAULT '',
    click_id TEXT DEFAULT '',
    gclid TEXT DEFAULT '',
    timestamp TEXT DEFAULT '',
    url TEXT DEFAULT '',
    referrer TEXT DEFAULT '',
    domain TEXT DEFAULT '',
    details TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX idx_pixel_domain_date ON pixel_events(domain, created_at);
CREATE INDEX idx_pixel_session ON pixel_events(session_id);
CREATE INDEX idx_pixel_event ON pixel_events(event);
```

---

## Voluum Integration (Layer 3)

### Click flow

```
1. User clicks Google Ad
2. Google appends gclid to URL
3. URL hits Voluum campaign URL (redirect mode)
4. Voluum generates clickid, stores gclid internally
5. Voluum redirects to LP: https://bearloannow.com/?clickid=abc123
6. LP extracts clickid from URL and passes it to LeadsGate form
```

### sold_lead postback (server-to-server)

```
1. User submits LeadsGate form (clickid attached)
2. LeadsGate processes lead
3. If lead is approved (sold):
   a. LeadsGate fires postback to Voluum with clickid + payout amount
   b. Voluum matches clickid to original click (which has gclid)
   c. Voluum fires s2s postback to Google Ads with gclid + conversion value
4. Google Ads records the conversion for Smart Bidding optimization
```

This entire chain happens server-to-server. No on-page JavaScript is involved for the sold_lead conversion. The LP does NOT need to know about it.

---

## LeadsGate Form Integration (Complete)

### Form embed code

```html
<script type="text/javascript">
var clickid = new URLSearchParams(window.location.search).get('clickid') || '';

var _lg_form_init_ = {
    aid: "{AID}",
    template: "fresh",
    click_id: clickid,

    onFormLoad: function() {
        // FORM_START: LeadsGate form has loaded and is visible
        // Fire gtag conversion (Secondary — trains AI on intent)
        gtag('event', 'conversion', {
            send_to: 'AW-{CONVERSION_ID}/{FORM_START_LABEL}'
        });
        // Fire custom pixel
        window.__pixel('fl');
    },

    onStepChange: function(step) {
        // User progressed to next form step
        // Custom pixel only — NOT sent to Google Ads
        // Used for internal funnel analysis
        window.__pixel('step', { step: step });
    },

    onSubmit: function() {
        // FORM_SUBMIT: User clicked submit button
        // Fire gtag conversion (Primary — AI optimizes bids for this)
        gtag('event', 'conversion', {
            send_to: 'AW-{CONVERSION_ID}/{FORM_SUBMIT_LABEL}'
        });
        // Fire custom pixel
        window.__pixel('fs', { clickid: clickid });
    },

    onSuccess: function(response) {
        // Lead was accepted by the network
        // Custom pixel only — actual conversion is handled by Voluum s2s
        window.__pixel('success', {
            clickid: clickid,
            lead_id: response?.lead_id || ''
        });
        // DO NOT redirect — LeadsGate handles redirect to offer page automatically
        // (e.g. dollarloancash.com or whatever the network configures)
    }
};
</script>
<script type="text/javascript" async="true" src="https://apikeep.com/form/applicationInit.js"></script>
<div id="_lg_form_"></div>
```

### Variable replacement at build time

The Astro build system replaces these placeholders from `config/brands/{brand}.json`:

| Placeholder | Source |
|---|---|
| `{AID}` | `brands.aid` |
| `{CONVERSION_ID}` | `brands.gads_conversion_id` |
| `{FORM_START_LABEL}` | `brands.gads_labels.form_start` |
| `{FORM_SUBMIT_LABEL}` | `brands.gads_labels.form_submit` |

---

## Front Page with Amount Selector + ZIP Input

Some LPs have an interactive front page where users select a loan amount and enter their ZIP code BEFORE the LeadsGate form appears. These interactions should trigger `form_start`.

### Implementation

```javascript
// This code runs on the front page (index.astro or hero block)
// It fires form_start ONCE on the first user interaction

let formStartFired = false;

function fireFormStartOnce() {
    if (formStartFired) return;
    formStartFired = true;

    // Google Ads — Secondary conversion
    gtag('event', 'conversion', {
        send_to: 'AW-{CONVERSION_ID}/{FORM_START_LABEL}'
    });

    // Custom pixel
    window.__pixel('form_start_interact');
}

// Trigger on EITHER action (whichever comes first)
document.getElementById('amount-slider').addEventListener('input', fireFormStartOnce);
document.getElementById('zip-input').addEventListener('focus', fireFormStartOnce);

// Track details to custom pixel only (NOT Google Ads)
document.getElementById('amount-slider').addEventListener('change', function(e) {
    window.__pixel('amt', { amount: e.target.value });
});

document.getElementById('zip-input').addEventListener('input', function(e) {
    if (e.target.value.length === 5) {
        window.__pixel('ze', { zip: e.target.value });
    }
});
```

### Important: form_start fires only ONCE per session

Whether the user interacts with the amount slider, the ZIP input, or the LeadsGate form loads — `form_start` should fire only ONE TIME. Use a flag variable to prevent duplicate fires. This ensures Google Ads AI gets a clean signal.

If the LP has a front page with amount/ZIP AND a separate page with LeadsGate form, only the first interaction triggers form_start. The `onFormLoad` callback should check if form_start was already fired:

```javascript
onFormLoad: function() {
    if (!formStartFired) {
        formStartFired = true;
        gtag('event', 'conversion', {
            send_to: 'AW-{CONVERSION_ID}/{FORM_START_LABEL}'
        });
    }
    window.__pixel('fl');
}
```

---

## DNS Setup for Custom Pixel

Each LP domain needs a `t` subdomain CNAME pointing to the pixel CF Worker:

```
t.bearloannow.com  CNAME  pixel-worker.{cf-account}.workers.dev
t.loanbears.com    CNAME  pixel-worker.{cf-account}.workers.dev
```

This is handled automatically by the Ops Center Domain Auto Wizard (Module 3). When a new domain is added, the wizard creates the `t` subdomain DNS record alongside the main site records.

---

## Event Reference Table

| Event Code | Event Name | Sent to gtag? | Sent to Pixel? | Trigger |
|---|---|---|---|---|
| `pv` | Page View | No | Yes | Page load |
| `s25` | Scroll 25% | No | Yes | Scroll position |
| `s50` | Scroll 50% | No | Yes | Scroll position |
| `s75` | Scroll 75% | No | Yes | Scroll position |
| `s100` | Scroll 100% | No | Yes | Scroll position |
| `t30` | Time 30s | No | Yes | setTimeout |
| `t60` | Time 60s | No | Yes | setTimeout |
| `amt` | Amount Selected | No | Yes | Slider change |
| `ze` | ZIP Entered | No | Yes | Input 5 digits |
| `form_start_interact` | Form Start (front page) | Yes (Secondary) | Yes | First amount/zip interact |
| `fl` | Form Load | Yes (Secondary, if form_start not yet fired) | Yes | LeadsGate onFormLoad |
| `step` | Step Change | No | Yes | LeadsGate onStepChange |
| `fs` | Form Submit | Yes (Primary) | Yes | LeadsGate onSubmit |
| `success` | Lead Accepted | No | Yes | LeadsGate onSuccess |
| `sold_lead` | Lead Sold | Yes (Primary, via Voluum s2s) | Yes (via Voluum postback) | Network approves lead |

---

## File Locations in LP Factory V2

| File | Purpose |
|---|---|
| `src/utils/tracking-pixel.js` | Custom pixel script (embedded in every LP) |
| `config/brands/{brand}.json` | AW-ID, conversion labels, AID, Voluum campaign |
| `src/blocks/forms/ZipFormInline.astro` | Front page form with amount + ZIP |
| `src/layouts/BaseLayout.astro` | Injects gtag.js + pixel script in head/body |
| `engine/composer/compose-variant.mjs` | Reads brand config, injects tracking vars |

---

## Testing Checklist

Before deploying any LP, verify:

- [ ] gtag.js loads with correct AW-ID (check Network tab)
- [ ] form_start fires exactly ONCE on first interaction (check Network tab for googleads.g.doubleclick.net)
- [ ] form_submit fires on LeadsGate submit (check Network tab)
- [ ] Custom pixel fires all events (check Network tab for t.{domain}.com/e)
- [ ] clickid is present in URL and passed to _lg_form_init_.click_id
- [ ] LeadsGate form renders correctly in #_lg_form_ div
- [ ] After form submit, LeadsGate redirects to offer page (NOT the LP handling redirect)
- [ ] No GTM script present anywhere in the page
- [ ] No GA4 script present anywhere in the page
- [ ] D1 database receives pixel events (check via Ops Center Logs)
