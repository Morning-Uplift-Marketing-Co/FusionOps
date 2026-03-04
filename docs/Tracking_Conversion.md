## 4. Module 2 — Tracking & Conversion (NO GTM / NO GA4)

### 4.1 Stack

| Layer                    | Purpose                                               | Google dependency?            |
| ------------------------ | ----------------------------------------------------- | ----------------------------- |
| gtag.js (AW-only)        | Micro-conv to train Google Ads AI                     | Yes but only AW-ID, easy swap |
| Custom First-Party Pixel | Permanent data in D1 via CF Worker                    | No                            |
| Voluum                   | Click tracking + sold_lead s2s postback to Google Ads | No                            |

**Removed:** GTM, GA4, Offline CSV Upload, Apps Script

### 4.2 Only 3 Conversion Actions

| Action      | Type      | Trigger                                     | Method              |
| ----------- | --------- | ------------------------------------------- | ------------------- |
| form_start  | Secondary | LeadsGate onFormLoad or amount/zip interact | gtag.js             |
| form_submit | Primary   | LeadsGate onSubmit                          | gtag.js             |
| sold_lead   | Primary   | Network approves lead                       | Voluum s2s postback |

### 4.3 CCPA Privacy Guard

US financial services LPs **must** respect California Consumer Privacy Act (CCPA) opt-out.
When a user opts out via the privacy banner, store the flag and suppress all non-essential tracking.

```javascript
// ─── Privacy Banner: call this when user clicks "Do Not Sell My Info" ───
function ccpaOptOut() {
    localStorage.setItem('ccpa_optout', 'true');
    console.log('[Privacy] CCPA opt-out recorded');
}

// ─── Guard: check before any tracking call ───
function isTrackingSuppressed() {
    return localStorage.getItem('ccpa_optout') === 'true';
}

// ─── Safe wrappers: only fire when tracking is allowed ───
function safeGtag() {
    if (isTrackingSuppressed()) return;
    if (typeof gtag === 'function') gtag.apply(null, arguments);
}

function safePixel(event, data) {
    if (isTrackingSuppressed()) return;
    if (typeof pixel === 'function') pixel(event, data);
}
```

> **Note:** `safeGtag()` and `safePixel()` are used in all hooks below instead of calling `gtag()` / `pixel()` directly. This ensures CCPA compliance across the entire form lifecycle, not just onFormLoad.

### 4.4 Form Embed Code

```javascript
var clickid = new URLSearchParams(window.location.search).get('clickid') || '';

var _lg_form_init_ = {
    aid: "14881",
    template: "fresh",
    click_id: clickid,

    onFormLoad: function() {
        safeGtag('event', 'conversion', { send_to: 'AW-XXX/form_start_label' });
        safePixel('fl');
    },

    onStepChange: function(step) {
        safePixel('step', { step: step });
    },

    onSubmit: function() {
        safeGtag('event', 'conversion', { send_to: 'AW-XXX/form_submit_label' });
        safePixel('fs', { clickid: clickid });
    },

    onSuccess: function(response) {
        safePixel('success', { clickid: clickid, lead_id: response?.lead_id });
        // No redirect — LeadsGate redirects to offer page automatically
    },

    onLeadSold: function(data) {
        safePixel('sold', { clickid: clickid, lead_id: data?.lead_id, payout: data?.price });
    },

    onLeadRejected: function(data) {
        safePixel('rejected', { clickid: clickid, lead_id: data?.lead_id });
    }
};
```

> **Replace** `AW-XXX` with your Google Ads Conversion ID and `form_start_label` / `form_submit_label` with actual conversion labels from Google Ads.

### 4.5 Conversion Flow

```
Google Ads click
  → Voluum (capture clickid via DTP redirect)
  → LP (clickid in URL param)
  → CCPA check (isTrackingSuppressed?)
  → LeadsGate form (click_id passed via _lg_form_init_)
  → onFormLoad  → safeGtag form_start + safePixel fl
  → onStepChange → safePixel step
  → onSubmit    → safeGtag form_submit + safePixel fs
  → onSuccess   → safePixel success
  → LeadsGate auto redirect → offer page
  → Lead approved → postback → Voluum (s2s) → Google Ads sold_lead
```

### 4.6 Front Page Micro-Conv (Amount + ZIP)

```javascript
let formStarted = false;
function fireFormStart() {
    if (formStarted) return;
    formStarted = true;
    safeGtag('event', 'conversion', { send_to: 'AW-XXX/form_start_label' });
    safePixel('fl');
}

// Amount slider interaction triggers form_start once
amountSlider.onChange(() => fireFormStart());
zipInput.onFocus(() => fireFormStart());

// Detail events to custom pixel only
amountSlider.onChange((val) => safePixel('amt', { amount: val }));
zipInput.onChange((val) => {
    if (val.length === 5) safePixel('ze', { zip: val });
});
```

### 4.7 Custom First-Party Pixel

- **Endpoint:** `https://t.{domain}/e` via CF Worker
- **Method:** `navigator.sendBeacon()` (non-blocking, survives page unload)
- **Storage:** Cloudflare D1 (`pixel_events` table)
- **Events:**

| Event Code | Description           | Data                          |
| ---------- | --------------------- | ----------------------------- |
| `pv`       | Page view             | url, referrer, ua             |
| `fl`       | Form load             | gclid, click_id               |
| `step`     | Form step change      | step number                   |
| `fs`       | Form submit           | clickid, gclid                |
| `success`  | Form success          | clickid, lead_id              |
| `sold`     | Lead sold (callback)  | clickid, lead_id, payout      |
| `rejected` | Lead rejected         | clickid, lead_id              |
| `amt`      | Amount selected       | amount value                  |
| `ze`       | ZIP entered           | zip (5-digit)                 |

```javascript
// pixel() implementation (included in LP template automatically)
function pixel(event, data) {
    if (typeof navigator.sendBeacon !== 'function') return;
    var payload = Object.assign({
        e: event,
        t: Date.now(),
        u: location.href,
        r: document.referrer
    }, data || {});
    navigator.sendBeacon('https://t.' + location.hostname + '/e',
        new Blob([JSON.stringify(payload)], { type: 'application/json' })
    );
}
```

---

## 4.8 Voluum Campaign Tracking *(required)*

### Step 1: Install Lander Tracking Script (DTP)

Paste the Voluum Direct Tracking Pixel script into your lander's `<head>` section, **before** closing `</head>`.

> **Important:** Replace `trk.{domain}` with your actual Voluum tracking domain (e.g. `trk.bearloannow.com`). FusionOps LP Wizard auto-generates this script in Step 6 (Tracking).

```html
<meta http-equiv="delegate-ch" content="
  sec-ch-ua https://trk.{domain};
  sec-ch-ua-mobile https://trk.{domain};
  sec-ch-ua-arch https://trk.{domain};
  sec-ch-ua-model https://trk.{domain};
  sec-ch-ua-platform https://trk.{domain};
  sec-ch-ua-platform-version https://trk.{domain};
  sec-ch-ua-bitness https://trk.{domain};
  sec-ch-ua-full-version-list https://trk.{domain};
  sec-ch-ua-full-version https://trk.{domain}
">
<style>.dtpcnt{opacity:0;}</style>
<script>
(function(e,d,k,n,u,v,g,w,C,f,p,x,D,c,q,r,h,t,y,G,z){function A(){for(var a=
d.querySelectorAll(".dtpcnt"),b=0,l=a.length;b<l;b++)a[b][w]=a[b][w].replace(
/(^|\s+)dtpcnt($|\s+)/g,"")}function E(a,b,l,F){var m=new Date;m.setTime(
m.getTime()+(F||864E5));d.cookie=a+"="+b+"; "+l+"samesite=Strict; expires="+
m.toGMTString()+"; path=/";k.setItem(a,b);k.setItem(a+"-expires",m.getTime())}
function B(a){var b=d.cookie.match(new RegExp("(^| )"+a+"=([^;]+)"));return b?
b.pop():k.getItem(a+"-expires")&&+k.getItem(a+"-expires")>(new Date).getTime()?
k.getItem(a):null}z="https:"===e.location.protocol?"secure; ":"";e[f]||(e[f]=
function(){(e[f].q=e[f].q||[]).push(arguments)},r=d[u],d[u]=function(){r&&
r.apply(this,arguments);if(e[f]&&!e[f].hasOwnProperty("params")&&
/loaded|interactive|complete/.test(d.readyState))for(;c=d[v][p++];)
/\/?click\/?($|(\/[0-9]+)?$)/.test(c.pathname)&&(c[g]="javascrip"+
e.postMessage.toString().slice(4,5)+":"+f+'.l="'+c[g]+'",void 0')},
setTimeout(function(){(t=RegExp("[?&]cpid(=([^&#]*)|&|#|$)").exec(
e.location.href))&&t[2]&&(h=t[2],y=B("vl-"+h));var a=B("vl-cep"),
b=location[g];if("savedCep"===D&&a&&(!h||"undefined"===typeof h)&&
0>b.indexOf("cep=")){var l=-1<b.indexOf("?")?"&":"?";b+=l+a}c=
d.createElement("script");q=d.scripts[0];c.defer=1;c.src=x+
(-1===x.indexOf("?")?"?":"&")+"lpref="+n(d.referrer)+"&lpurl="+n(b)+
"&lpt="+n(d.title)+"&vtm="+(new Date).getTime()+(y?"&uw=no":"");c[C]=
function(){for(p=0;c=d[v][p++];)/dtpCallback\.l/.test(c[g])&&(c[g]=
decodeURIComponent(c[g]).match(/dtpCallback\.l="([^"]+)/)[1]);A()};
q.parentNode.insertBefore(c,q);h&&E("vl-"+h,"1",z)},0),setTimeout(A,7E3))
})(window,document,localStorage,encodeURIComponent,
"onreadystatechange","links","href","className","onerror",
"dtpCallback",0,
"https://trk.{domain}/d/.js",   // ← Replace {domain}
"savedCep");
</script>
<noscript>
  <link href="https://trk.{domain}/d/.js?noscript=true&lpurl=" rel="stylesheet"/>
</noscript>
```

### Step 2: Submit Tracking URL to Google Ads

Set the Voluum Lander Tracking URL as the **Final URL** in your Google Ads campaign (Search/Display).

**Lander Tracking URL format:**

```
https://{domain}?gclid={gclid}&gbraid={gbraid}&wbraid={wbraid}&campaignid={campaignid}&adgroupid={adgroupid}&loc_physical_ms={loc_physical_ms}&loc_interest_ms={loc_interest_ms}&matchtype={matchtype}&network={network}&creative={creative}&keyword={keyword}&placement={placement}&targetid={targetid}&cpid={voluum_campaign_id}&lpid={voluum_lander_id}
```

> **Replace:**
> - `{domain}` — your landing page domain (e.g. `bearloannow.com`)
> - `{voluum_campaign_id}` — from Voluum campaign settings
> - `{voluum_lander_id}` — from Voluum lander settings
> - All `{gclid}`, `{campaignid}`, etc. are Google Ads ValueTrack parameters — leave as-is

### Step 3: CTA Click URL

All CTA buttons on the lander must link to the Voluum click URL for proper conversion tracking:

```html
<a href="https://trk.{domain}/click" class="cta-button">
    Check Your Rate →
</a>
```

> Ensure CTA links are inside the `<body>` section. The DTP script automatically rewrites these links to include the Voluum click ID.

---

## 4.9 CCPA Compliance Checklist

For US financial services landing pages, include all of the following:

| Requirement                    | Where                           | Implementation                                |
| ------------------------------ | ------------------------------- | --------------------------------------------- |
| Privacy Policy link            | Footer                          | Link to `/privacy` page                       |
| "Do Not Sell My Info" link     | Footer                          | Triggers `ccpaOptOut()` + shows confirmation   |
| CCPA opt-out persistence       | localStorage                    | `ccpa_optout = 'true'`                        |
| Tracking suppression           | All hooks                       | `safeGtag()` / `safePixel()` wrappers         |
| APR disclosure                 | Above form                      | Required text with min/max APR range           |
| "Not a Lender" disclaimer      | Footer                          | Required for lead gen affiliates               |
| TCPA consent checkbox          | Before form submit              | Required for SMS/call consent                  |
