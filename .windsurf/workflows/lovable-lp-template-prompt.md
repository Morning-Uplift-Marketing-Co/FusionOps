# Lovable Prompt — Tracking-Complete Astro LP Template
# ใช้: Copy ทั้งหมดด้านล่าง วางใน Lovable.dev → New Project

---

Build a complete Astro 4 landing page project for a personal loan / pet financing offer. This must be a production-ready template with 100% tracking coverage across all 31 checks.

---

## PROJECT STRUCTURE

```
src/
  pages/
    index.astro        ← Hero + Form (LeadsGate embed)
    apply.astro        ← Apply page (LeadsGate full form)
  layouts/
    Layout.astro       ← Base HTML shell with all scripts
  styles/
    global.css         ← CSS custom properties + resets
public/
  _headers            ← Cloudflare cache + security headers
src/
  pages/
    e.ts              ← GET beacon endpoint /e
    robots.txt.ts     ← robots.txt
```

---

## ENVIRONMENT VARIABLES (all must use `import.meta.env.PUBLIC_*`)

```
PUBLIC_SITE_DOMAIN=example.com
PUBLIC_OFFER_NAME=Quick Cash Loans
PUBLIC_GOOGLE_ADS_ID=AW-XXXXXXXXX
PUBLIC_CONVERSION_LABEL=XXXXXXXXXXX
PUBLIC_CONVERSION_VALUE=1
PUBLIC_AID=XXXX
PUBLIC_VOLUUM_CLICK_URL=https://t.example.com/click
PUBLIC_LEADSGATE_FORM_ID=XXXXX
PUBLIC_LEADSGATE_APPLY_ID=XXXXX
PUBLIC_PIXEL_DOMAIN=t.example.com
PUBLIC_GTM_ID=GTM-XXXXXXX
```

---

## Layout.astro — HEAD SCRIPTS (all with data-cfasync="false")

### 1. Google Tag Manager
```html
<script data-cfasync="false">
(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer',import.meta.env.PUBLIC_GTM_ID);
</script>
```

### 2. Google Ads gtag
```html
<script data-cfasync="false" async src={`https://www.googletagmanager.com/gtag/js?id=${import.meta.env.PUBLIC_GOOGLE_ADS_ID}`}></script>
<script data-cfasync="false" define:vars={{ gadsId: import.meta.env.PUBLIC_GOOGLE_ADS_ID }}>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', gadsId);
</script>
```

### 3. Pixel + sessionStorage capture
```html
<script data-cfasync="false" define:vars={{
  aid: import.meta.env.PUBLIC_AID,
  pixelDomain: import.meta.env.PUBLIC_PIXEL_DOMAIN
}}>
  // Capture GCLID + UTM into sessionStorage
  (function(){
    var p = new URLSearchParams(location.search);
    ['gclid','utm_source','utm_medium','utm_campaign','utm_content','utm_term'].forEach(function(k){
      if(p.get(k)) sessionStorage.setItem(k, p.get(k));
    });
  })();

  // First-party pixel
  window.__pixel = window.pixel = function(event, data){
    try {
      var d = data || {};
      d.event = event;
      d.aid = aid;
      d.domain = location.hostname;
      d.gclid = sessionStorage.getItem('gclid') || '';
      d.utm_source = sessionStorage.getItem('utm_source') || '';
      var qs = Object.keys(d).map(function(k){
        return encodeURIComponent(k)+'='+encodeURIComponent(d[k]||'');
      }).join('&');
      new Image().src = 'https://'+pixelDomain+'/e?'+qs+'&_t='+Date.now();
    } catch(e){}
  };

  // Page view
  pixel('pv');
</script>
```

### 4. Voluum click ID capture
```html
<script data-cfasync="false">
  (function(){
    var p = new URLSearchParams(location.search);
    var cid = p.get('cid') || p.get('click_id') || p.get('vcid');
    if(cid) sessionStorage.setItem('voluum_cid', cid);
    window.__voluum_cid = cid || sessionStorage.getItem('voluum_cid') || '';
  })();
</script>
```

---

## Layout.astro — BODY END SCRIPTS

### 5. Scroll depth micro-conversions
```html
<script data-cfasync="false">
  (function(){
    var fired = {};
    window.addEventListener('scroll', function(){
      var pct = Math.round(
        (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100
      );
      [25,50,75,100].forEach(function(n){
        if(pct >= n && !fired['s'+n]){
          fired['s'+n] = true;
          pixel('scroll_'+n);
        }
      });
    }, {passive: true});
  })();
</script>
```

### 6. Time-on-page micro-conversions
```html
<script data-cfasync="false">
  (function(){
    var fired = {};
    [30,60].forEach(function(sec){
      setTimeout(function(){
        if(!fired['t'+sec]){ fired['t'+sec]=true; pixel('top_'+sec+'s'); }
      }, sec * 1000);
    });
  })();
</script>
```

### 7. GTM noscript fallback (inside `<body>` tag)
```html
<noscript>
  <iframe src={`https://www.googletagmanager.com/ns.html?id=${import.meta.env.PUBLIC_GTM_ID}`}
    height="0" width="0" style="display:none;visibility:hidden"></iframe>
</noscript>
```

---

## index.astro — HERO PAGE

### Structure
- Full-width hero with headline + sub-headline using CSS custom properties
- Trust badges row (BBB, SSL, Fast Approval, No Obligation)
- LeadsGate short form embed (zip + email step)
- Benefits section (3 columns)
- FAQ accordion (3 questions)
- Footer with disclaimer text

### LeadsGate short form embed
```html
<script data-cfasync="false" define:vars={{
  formId: import.meta.env.PUBLIC_LEADSGATE_FORM_ID,
  gadsId: import.meta.env.PUBLIC_GOOGLE_ADS_ID,
  convLabel: import.meta.env.PUBLIC_CONVERSION_LABEL,
  convValue: import.meta.env.PUBLIC_CONVERSION_VALUE,
  aid: import.meta.env.PUBLIC_AID,
  voluumUrl: import.meta.env.PUBLIC_VOLUUM_CLICK_URL
}}>
  var firedFormStart = false;
  window.LGForms = window.LGForms || {};
  window.LGForms[formId] = {
    hooks: {
      onStart: function(){
        if(!firedFormStart){
          firedFormStart = true;
          pixel('form_start');
          gtag('event','form_start');
        }
      },
      onStep: function(step){
        pixel('form_step', { step: step });
      },
      onZip: function(zip){
        pixel('ze', { zip: zip });
      },
      onAmount: function(amt){
        pixel('amt', { amount: amt });
      },
      onSuccess: function(data){
        // Google Ads conversion
        gtag('event','conversion',{
          send_to: gadsId+'/'+convLabel,
          value: Number(convValue),
          currency: 'USD'
        });
        // First-party pixel
        pixel('lead', { aid: aid });
        // Voluum postback
        if(window.__voluum_cid){
          new Image().src = voluumUrl
            + '?cid=' + window.__voluum_cid
            + '&payout=AUTO'
            + '&txid=' + ((data && data.lead_id) || '');
        }
      }
    }
  };
  // Legacy alias
  window.onSuccess = window.LGForms[formId].hooks.onSuccess;
</script>

<div id={`lf-${import.meta.env.PUBLIC_LEADSGATE_FORM_ID}`}></div>
<script
  data-cfasync="false"
  src={`https://leadsgate.com/form/${import.meta.env.PUBLIC_LEADSGATE_FORM_ID}.js`}
  async
></script>
```

---

## apply.astro — FULL APPLICATION PAGE

Same hooks structure as index.astro but using `PUBLIC_LEADSGATE_APPLY_ID`.
Include `onAmount` hook for amount slider pixel tracking.

---

## src/pages/e.ts — GET BEACON ENDPOINT

```typescript
import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ url }) => {
  // Pixel beacon — receives tracking events
  // In production: forward to your analytics pipeline
  console.log('[pixel]', Object.fromEntries(url.searchParams));
  return new Response('', {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    }
  });
};
```

---

## src/pages/robots.txt.ts

```typescript
import type { APIRoute } from 'astro';

export const GET: APIRoute = () => {
  return new Response(
    `User-agent: *\nAllow: /\nSitemap: https://${import.meta.env.PUBLIC_SITE_DOMAIN}/sitemap.xml`,
    { headers: { 'Content-Type': 'text/plain' } }
  );
};
```

---

## public/_headers

```
/*
  X-Frame-Options: SAMEORIGIN
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Cache-Control: public, max-age=3600

/e
  Cache-Control: no-store
  Access-Control-Allow-Origin: *
```

---

## src/styles/global.css — CSS CUSTOM PROPERTIES

```css
:root {
  --brand-primary: #ef4444;
  --brand-secondary: #f97316;
  --brand-gradient: linear-gradient(135deg, #ef4444, #f97316);
  --bg-page: #0f172a;
  --bg-card: #1e293b;
  --text-main: #f1f5f9;
  --text-muted: #94a3b8;
  --border: #334155;
  --radius: 12px;
  --font: 'Inter', system-ui, sans-serif;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: var(--font); background: var(--bg-page); color: var(--text-main); }

.btn-primary {
  background: var(--brand-gradient);
  color: white;
  border: none;
  border-radius: var(--radius);
  padding: 14px 32px;
  font-size: 1.1rem;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.2s;
}
.btn-primary:hover { opacity: 0.9; }
```

---

## REQUIREMENTS CHECKLIST — ต้องได้ครบ 31/31

| # | Check | Location |
|---|-------|----------|
| 1 | gtag config loaded | Layout.astro `<head>` |
| 2 | gtag conversion fired on lead | onSuccess hook |
| 3 | Google Ads conversion value set | onSuccess hook |
| 4 | pixel() function defined | Layout.astro `<head>` |
| 5 | window.__pixel alias | Layout.astro `<head>` |
| 6 | pixel('pv') on page load | Layout.astro `<head>` |
| 7 | pixel('lead') on form success | onSuccess hook |
| 8 | pixel('form_start') on first interaction | onStart hook |
| 9 | pixel('form_step') on each step | onStep hook |
| 10 | pixel('ze') on ZIP entry | onZip hook |
| 11 | pixel('amt') on amount selection | onAmount hook |
| 12 | pixel('scroll_25') | body script |
| 13 | pixel('scroll_50') | body script |
| 14 | pixel('scroll_75') | body script |
| 15 | pixel('scroll_100') | body script |
| 16 | pixel('top_30s') | body script |
| 17 | pixel('top_60s') | body script |
| 18 | GCLID captured to sessionStorage | Layout.astro `<head>` |
| 19 | UTM params captured to sessionStorage | Layout.astro `<head>` |
| 20 | Voluum CID captured | Layout.astro `<head>` |
| 21 | Voluum postback fired on lead | onSuccess hook |
| 22 | LeadsGate onStart hook | index/apply.astro |
| 23 | LeadsGate onStep hook | index/apply.astro |
| 24 | LeadsGate onZip hook | index/apply.astro |
| 25 | LeadsGate onSuccess hook | index/apply.astro |
| 26 | onSuccess legacy alias | index/apply.astro |
| 27 | firedFormStart dedup flag | index/apply.astro |
| 28 | aid param in pixel calls | pixel() function |
| 29 | All scripts have data-cfasync="false" | all script tags |
| 30 | GET beacon endpoint /e returns 204 | src/pages/e.ts |
| 31 | CSS custom properties defined | global.css |

---

## IMPORTANT RULES

1. **Hardcode nothing** — every value must come from `import.meta.env.PUBLIC_*`
2. **Every `<script>` tag must have `data-cfasync="false"`** (Cloudflare Rocket Loader bypass)
3. Use `define:vars={{}}` in Astro script tags to inject env vars into inline scripts
4. The pixel beacon must use `new Image().src` (NOT fetch or sendBeacon — those fail on static hosts)
5. LeadsGate hooks must be set **before** the LeadsGate script loads
6. `firedFormStart` flag prevents duplicate `form_start` events
7. All placeholder values (AW-XXXXXXXXX, XXXXX, etc.) must remain as-is so the user can swap them out
