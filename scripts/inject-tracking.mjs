#!/usr/bin/env node
/**
 * Auto-inject tracking stack into any template (Astro or Vite/Loveable/HTML)
 *
 * Called from .github/workflows/deploy-lp.yml after deploy-config is merged into .env
 * (PUBLIC_VOLUUMDOMAIN, PUBLIC_VOLUUM_CLICK_URL, PUBLIC_CONVERSIONID, etc.).
 *
 * Injects:
 *   1. Voluum dtpCallback (Direct Tracking Pixel) — reads VOLUUM_DOMAIN from env
 *   2. First-party pixel (fpPixel) — sends to t.{domain}/e
 *   3. Google Ads gtag — reads CONVERSION_ID from env
 *
 * Usage: node scripts/inject-tracking.mjs <template-dir>
 *
 * Supports:
 *   - Astro templates  (astro.config + src/pages/index.astro; src/layouts/Layout.astro when present)
 *   - Vite/React/Loveable (root index.html + vite.config.*) — chosen over stray src/layouts/*.astro
 *   - HTML-first templates (index.html only)
 */
import fs from 'node:fs';
import path from 'node:path';
import { resolveAstroShellAstroPath } from './lib/astro-shell-resolve.mjs';

const templateDir = path.resolve(process.argv[2] || '.');

// ─── Detect template type ───
// Loveable/Vite exports sometimes include orphan src/layouts/*.astro; if we prefer that over
// index.html, the real app shell never gets Voluum/pixel/gtag (scratchpaypet-style bug).
const indexHtml = path.join(templateDir, 'index.html');
const indexAstroPath = path.join(templateDir, 'src', 'pages', 'index.astro');

function findViteConfigInRoot(dir) {
  const names = ['vite.config.ts', 'vite.config.mts', 'vite.config.cts', 'vite.config.js', 'vite.config.mjs', 'vite.config.cjs'];
  return names.some((n) => fs.existsSync(path.join(dir, n)));
}

function hasViteDependency(dir) {
  try {
    const p = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    const d = { ...p.dependencies, ...p.devDependencies };
    return Boolean(d.vite);
  } catch {
    return false;
  }
}

const hasViteConfig = findViteConfigInRoot(templateDir);
const hasAstroConfig = fs.existsSync(path.join(templateDir, 'astro.config.mjs'))
  || fs.existsSync(path.join(templateDir, 'astro.config.ts'))
  || fs.existsSync(path.join(templateDir, 'astro.config.js'));

function hasSrcMainEntry(dir) {
  return ['src/main.tsx', 'src/main.jsx', 'src/main.ts', 'src/main.js'].some(
    (f) => fs.existsSync(path.join(dir, f)),
  );
}

/** True when npm build is Vite, not Astro (Loveable often leaves stray astro.config / index.astro). */
function buildIsViteNotAstro(dir) {
  try {
    const p = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    const b = String(p.scripts?.build || '');
    if (!b.trim()) return false;
    if (/\bastro\s+build\b/i.test(b)) return false;
    return /\bvite\s+build\b/i.test(b) || /\bnpx\s+vite\s+build\b/i.test(b);
  } catch {
    return false;
  }
}

// MUST run before "hasAstroConfig && index.astro" — hybrid junk files should not steal inject target.
const isViteReactLp = Boolean(
  fs.existsSync(indexHtml)
    && hasViteConfig
    && (hasSrcMainEntry(templateDir) || buildIsViteNotAstro(templateDir)),
);

const hasViteShell = Boolean(
  fs.existsSync(indexHtml)
    && (hasViteConfig || (hasViteDependency(templateDir) && !hasAstroConfig)),
);

let layoutAstro = resolveAstroShellAstroPath(templateDir);
let type = 'unknown';

if (isViteReactLp) {
  type = 'vite';
  console.log('(detect) Vite/React LP — index.html + vite.config + (src/main* or vite build in package.json)');
} else if (hasAstroConfig && fs.existsSync(indexAstroPath)) {
  type = 'astro';
  if (!layoutAstro) {
    layoutAstro = indexAstroPath;
    console.log('⚠ No src/layouts/*.astro — injecting tracking into src/pages/index.astro');
  }
} else if (hasViteShell) {
  type = 'vite';
} else if (layoutAstro) {
  type = 'astro';
} else if (fs.existsSync(indexHtml)) {
  type = 'html';
}

console.log(`Template type: ${type}`);
console.log(`Template dir: ${templateDir}`);

if (type === 'unknown') {
  console.warn('⚠ Could not detect template type — skipping tracking injection');
  process.exit(0);
}

// ─── Tracking snippets ───

// Voluum dtpCallback - [Refactored for Performance & Compliance]
const VOLUUM_HEAD_SNIPPET = `
<script data-cfasync="false">
(function(){
  var vd = window.__VOLUUM_DOMAIN__ || '';
  if (!vd) {
    try {
      var cw = window.__VOLUUM_CLICK_URL__ || '';
      if (cw && /^https?:\\/\\//i.test(String(cw))) vd = new URL(String(cw)).hostname || '';
    } catch (_e) {}
  }
  if (!vd) return;

  /* [Senior Dev Fix]:*/
  var m = document.createElement('meta');
  m.httpEquiv = 'delegate-ch';
  m.content = ['sec-ch-ua','sec-ch-ua-mobile','sec-ch-ua-arch','sec-ch-ua-model','sec-ch-ua-platform','sec-ch-ua-platform-version','sec-ch-ua-bitness','sec-ch-ua-full-version-list','sec-ch-ua-full-version'].map(function(h){return h+' https://'+vd}).join('; ');
  document.head.appendChild(m);

  (function(e,d,k,n,u,v,g,w,C,f,p,x,D,c,q,r,h,t,y,G,z){
    function A(){for(var a=d.querySelectorAll(".dtpcnt"),b=0,l=a.length;b<l;b++)a[b][w]=a[b][w].replace(/(^|\\s+)dtpcnt($|\\s+)/g,"")}
    function E(a,b,l,F){var m=new Date;m.setTime(m.getTime()+(F||864E5));d.cookie=a+"="+b+"; "+l+"samesite=Strict; expires="+m.toGMTString()+"; path=/; domain=."+window.location.hostname;k.setItem(a,b);k.setItem(a+"-expires",m.getTime())}
    function B(a){var b=d.cookie.match(new RegExp("(^| )"+a+"=([^;]+)"));return b?b.pop():k.getItem(a+"-expires")&&+k.getItem(a+"-expires")>(new Date).getTime()?k.getItem(a):null}
    z="https:"===e.location.protocol?"secure; ":"";
    e[f]||(e[f]=function(){(e[f].q=e[f].q||[]).push(arguments)},r=d[u],d[u]=function(){r&&r.apply(this,arguments);
    if(e[f]&&!e[f].hasOwnProperty("params")&&/loaded|interactive|complete/.test(d.readyState))for(;c=d[v][p++];)/\\/?click\\/?($|(\\/[0-9]+)?$)/.test(c.pathname)&&(c[g]="javascript:"+f+'.l="'+c[g]+'",void 0')},setTimeout(function(){
      (t=RegExp("[?&]cpid(=([^&#]*)|&|#|$)").exec(e.location.href))&&t[2]&&(h=t[2],y=B("vl-"+h));
      var a=B("vl-cep"),b=location[g];
      if("savedCep"===D&&a&&(!h||"undefined"===typeof h)&&0>b.indexOf("cep=")){var l=-1<b.indexOf("?")?"&":"?";b+=l+a}
      c=d.createElement("script");q=d.scripts[0];c.defer=1;
      c.src="https://"+vd+"/d/.js?lpref="+n(d.referrer)+"&lpurl="+n(b)+"&vtm="+(new Date).getTime()+(y?"&uw=no":"");
      c[C]=function(){for(p=0;c=d[v][p++];)/dtpCallback\\.l/.test(c[g])&&(c[g]=decodeURIComponent(c[g]).match(/dtpCallback\\.l="([^"]+)/)[1]);A()};q.parentNode.insertBefore(c,q);h&&E("vl-"+h,"1",z)},0),setTimeout(A,7E3))
  })(window,document,localStorage,encodeURIComponent,"onreadystatechange","links","href","className","onerror","dtpCallback",0,0,"savedCep");
})();
</script>
<noscript><link id="vlnoscript" rel="stylesheet"/></noscript>
`;

/** Early URL capture for pixels / embeds — must run before PIXEL_BODY_SNIPPET (see hasGclIdCapture). */
const GCLID_CAPTURE_SNIPPET = `
<!-- GCLID capture (auto-injected) -->
<script data-cfasync="false">
(function(){
  var SafeStorage = {
    set: function(k, v) {
      if(v === undefined || v === null || v === '') return;
      var d = new Date(); d.setTime(d.getTime() + (30*24*60*60*1000));
      document.cookie = k + "=" + encodeURIComponent(String(v)) + "; expires=" + d.toUTCString() + "; path=/; domain=." + window.location.hostname.replace(/^www\\./, '');
    }
  };
  var p = new URLSearchParams(window.location.search);
  var flat = {};
  p.forEach(function(v, k) { flat[k] = v; });
  window.__lpLandingParams = flat;
  window.__lpLandingSearch = window.location.search || '';
  try { sessionStorage.setItem('__lp_search', window.location.search || ''); } catch (_) {}
  try { sessionStorage.setItem('__lp_params', JSON.stringify(flat)); } catch (_) {}
  var cid = p.get('gclid') || p.get('gbraid') || p.get('wbraid') || p.get('msclkid') || p.get('fbclid') || p.get('ttclid')
    || p.get('vlcid') || p.get('clickid') || p.get('click_id') || p.get('cid') || p.get('cpid') || '';
  window.__fpClickId = cid || '';
  if (cid) SafeStorage.set('clickid', cid);
  p.forEach(function(v, k) {
    if (/^utm_/i.test(k) || /^(gclid|gbraid|wbraid|gclsrc|dclid|msclkid|fbclid|ttclid|epik|yclid)$/i.test(k)
      || /^(campaignid|adgroupid|creative|keyword|matchtype|network|placement|targetid|device|loc_physical_ms|loc_physicall_ms|loc_interest_ms|adposition|adtype)$/i.test(k)
      || /^(clickid|click_id|cid|cpid|vlcid|icic)$/i.test(k)) {
      SafeStorage.set(k, v);
    }
  });
})();
</script>
`;

const PIXEL_BODY_SNIPPET = `
<!-- First-party pixel + Google Ads gtag (auto-injected) -->
<script data-cfasync="false">
(function(){
  function fpIsAdsPlaceholderVal(v) {
    if (v === undefined || v === null || v === '') return true;
    var s = String(v);
    try { s = decodeURIComponent(s).trim(); } catch (_) { s = s.trim(); }
    return /^\\{[A-Za-z0-9_]+\\}$/.test(s);
  }
  function resolveClickId() {
    try {
      if (window.__fpClickId && !fpIsAdsPlaceholderVal(window.__fpClickId)) return String(window.__fpClickId);
      var p = new URLSearchParams(window.location.search);
      var keys = ['cpid','gclid','gbraid','wbraid','msclkid','fbclid','ttclid','clickid','vlcid','click_id','cid'];
      for (var i = 0; i < keys.length; i++) {
        var v = p.get(keys[i]);
        if (v && !fpIsAdsPlaceholderVal(v)) return v;
      }
      return '';
    } catch (_) { return ''; }
  }
  function resolveGclid() {
    try {
      var p = new URLSearchParams(window.location.search);
      var g = p.get('gclid') || p.get('gbraid') || p.get('wbraid') || '';
      return fpIsAdsPlaceholderVal(g) ? '' : g;
    } catch (_) { return ''; }
  }
  var PX_HOST = window.location.hostname.replace(/^www\./, '');
  var PX_ENDPOINT = 'https://t.' + PX_HOST + '/e';
  function sendPixelBeacon(payload) {
    try {
      var q = new URLSearchParams();
      Object.keys(payload || {}).forEach(function(k){
        var v = payload[k];
        if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
      });
      var i = new Image(1, 1);
      i.src = PX_ENDPOINT + '?' + q.toString();
    } catch(_) {}
  }
  function fpPixel(eventName, extra) {
    var cid = resolveClickId();
    var gid = resolveGclid();
    var base = { e: eventName, d: PX_HOST, ts: Date.now() };
    if (cid) { base.cid = cid; base.cpid = cid; base.click_id = cid; }
    if (gid) base.gclid = gid;
    var payload = Object.assign(base, extra || {});
    sendPixelBeacon(payload);
  }
  if (!window.__fpPageTracked) {
    window.__fpPageTracked = true;
    fpPixel('pv');
  }
  window.__fpPixel = fpPixel;
  window.__pixel = fpPixel;

  // Scroll depth tracking (25/50/75/100)
  var scrollFired = {};
  window.addEventListener('scroll', function(){
    var scrolled = window.scrollY + window.innerHeight;
    var total = document.documentElement.scrollHeight;
    var pct = Math.round((scrolled / total) * 100);
    [25,50,75,100].forEach(function(t){
      if (!scrollFired['s'+t] && pct >= t) { scrollFired['s'+t] = true; fpPixel('scroll_'+t+'%', {depth:t}); }
    });
  }, {passive:true});

  // Time on page (30s/60s)
  setTimeout(function(){ fpPixel('top_30s'); }, 30000);
  setTimeout(function(){ fpPixel('top_60s'); }, 60000);

  // Amount slider + ZIP — same micro-conversion rule as TrackingDashboard: form_start on zip/amount interact
  // (LeadsGate onFormLoad on /apply still fires lg_form_load separately when the embed loads.)
  document.addEventListener('DOMContentLoaded', function(){
    var landingFormStartKey = '_fp_fs_landing';
    function fireLandingFormStart(source) {
      try {
        if (sessionStorage.getItem(landingFormStartKey) === '1') return;
        sessionStorage.setItem(landingFormStartKey, '1');
      } catch (_) {
        if (window.__fpLandingFormStartDone) return;
        window.__fpLandingFormStartDone = true;
      }
      fpPixel('lg_form_load', { source: source || 'landing_micro' });
    }
    var slider = document.querySelector('input[type="range"][id*="amount"], input[type="range"][name*="amount"], .amountSlider, [data-amt]');
    if (slider) {
      var debounce;
      slider.addEventListener('input', function(){
        clearTimeout(debounce);
        debounce = setTimeout(function(){
          fpPixel('amt', {amount: slider.value});
          fireLandingFormStart('amount_slider');
        }, 400);
      });
    }
    // ZIP input tracking
    var zip = document.querySelector('input[id*="zip"], input[name*="zip"], input[placeholder*="ZIP"], .zipCode, input[type="text"][maxlength="5"]');
    if (zip) {
      var zfired = false;
      zip.addEventListener('focus', function(){
        if (!zfired) { zfired = true; fpPixel('ze', {source:'focus'}); }
        fireLandingFormStart('zip_focus');
      });
      zip.addEventListener('input', function(){
        if (zip.value.length === 5) {
          fpPixel('ze', {zip: zip.value});
          fireLandingFormStart('zip_5');
        }
      });
    }
  });
})();
</script>
<script data-cfasync="false">
(function(){
  var cid = window.__CONVERSION_ID__;
  if (!cid) return;
  var relayHost = String(window.__GTAG_RELAY_HOST__ || '').trim();
  var loaderBase = relayHost ? ('https://' + relayHost) : 'https://www.googletagmanager.com';
  var s = document.createElement('script');
  s.async = true;
  s.src = loaderBase + '/gtag/js?id=' + cid;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  var cfg = {};
  if (relayHost) cfg.transport_url = 'https://' + relayHost;
  gtag('config', cid, cfg);
  window.__gtag = gtag;
  window.__gtagConversionId = cid;
  window.__formStartLabel = window.__FORM_START_LABEL__ || '';
  window.__formSubmitLabel = window.__FORM_SUBMIT_LABEL__ || '';
})();
</script>
<script data-cfasync="false">
(function(){
  function fpIsAdsPlaceholderVal(v) {
    if (v === undefined || v === null || v === '') return true;
    var s = String(v);
    try { s = decodeURIComponent(s).trim(); } catch (_) { s = s.trim(); }
    return /^\\{[A-Za-z0-9_]+\\}$/.test(s);
  }
  var SafeStorage = {
    set: function(k, v) {
      if(v === undefined || v === null || v === '' || fpIsAdsPlaceholderVal(v)) return;
      var d = new Date(); d.setTime(d.getTime() + (30*24*60*60*1000));
      document.cookie = k + "=" + encodeURIComponent(String(v)) + "; expires=" + d.toUTCString() + "; path=/; domain=." + window.location.hostname.replace(/^www\\./, '');
    }
  };
  try {
    var o = window.__lpLandingParams;
    if (o && typeof o === 'object') {
      var gclid = o.gclid || o.gbraid || o.wbraid;
      if (gclid && !fpIsAdsPlaceholderVal(gclid)) SafeStorage.set('google_gclid', gclid);
      var clickid = o.clickid || o.vlcid || o.click_id || o.cid || o.cpid;
      if (clickid && !fpIsAdsPlaceholderVal(clickid)) { SafeStorage.set('clickid', clickid); SafeStorage.set('vlcid', clickid); }
      for (var k in o) {
        if (!Object.prototype.hasOwnProperty.call(o, k) || k.length > 96) continue;
        var v = o[k];
        if (v == null || String(v).length > 1024) continue;
        if (/^utm_/i.test(k) || /^(gclid|gbraid|wbraid|gclsrc|dclid|msclkid|fbclid|ttclid)$/i.test(k)
          || /^(campaignid|adgroupid|creative|keyword|matchtype|network|placement|targetid|device|loc_physical_ms|loc_physicall_ms|loc_interest_ms|adposition|adtype|cpid|cid)$/i.test(k)) {
          SafeStorage.set(k, v);
        }
      }
    }
  } catch(_){}
  window.firedFormStart = false;
})();
</script>
`;

// Runtime config script — sets window globals from env vars
// For Vite: reads VITE_* from import.meta.env at build time
// For HTML: values are replaced by deploy pipeline
const RUNTIME_CONFIG_VITE = `
<!-- Runtime config (auto-injected) -->
<script type="module">
  window.__VOLUUM_DOMAIN__ = import.meta.env.VITE_VOLUUM_DOMAIN || '';
  window.__CONVERSION_ID__ = import.meta.env.VITE_CONVERSION_ID || '';
  window.__VOLUUM_CLICK_URL__ = import.meta.env.VITE_VOLUUM_CLICK_URL || '';
  window.__GTAG_RELAY_HOST__ = import.meta.env.VITE_GTAG_RELAY_HOST || '';
  if (!window.__VOLUUM_DOMAIN__ && window.__VOLUUM_CLICK_URL__) {
    try {
      var __vh = new URL(String(window.__VOLUUM_CLICK_URL__)).hostname;
      if (__vh) window.__VOLUUM_DOMAIN__ = __vh;
    } catch (_e) {}
  }
  var ns = document.getElementById('vlnoscript');
  if (ns && window.__VOLUUM_DOMAIN__) ns.href = 'https://' + window.__VOLUUM_DOMAIN__ + '/d/.js?noscript=true&lpurl=';
</script>
`;

/** Plain HTML (no Vite build): read deploy .env so gtag/Voluum IDs exist (CI writes .env before this script). */
function loadDotEnv(dir) {
  const envPath = path.join(dir, '.env');
  const out = {};
  if (!fs.existsSync(envPath)) return out;
  const raw = fs.readFileSync(envPath, 'utf8').replace(/^\uFEFF/, '');
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const key = t.slice(0, eq).trim();
    let val = t.slice(eq + 1);
    try {
      out[key] = JSON.parse(val);
    } catch {
      out[key] = val;
    }
  }
  return out;
}

function voluumClickUrlFromEnv(env) {
  return String(env?.PUBLIC_VOLUUM_CLICK_URL || env?.VITE_VOLUUM_CLICK_URL || '').trim();
}

function hasVoluumCtaRewriterMarkup(html) {
  return html.includes('voluum-cta-rewriter')
    || html.includes('lp-voluum-cta')
    || html.includes('__foPatchCta');
}

/** Fail CI when deploy .env promises a Voluum click URL but the injected shell is missing rewriter (regression guard). */
function enforceRewriterWhenClickUrlInEnv(templateDir, filePath, postContent, label) {
  const env = loadDotEnv(templateDir);
  const click = voluumClickUrlFromEnv(env);
  if (!click || !/^https?:\/\//i.test(click)) return;
  if (hasVoluumCtaRewriterMarkup(postContent)) return;
  const rel = path.relative(templateDir, filePath);
  console.error(
    `::error::inject-tracking: ${label} (${rel}) missing Voluum CTA rewriter but .env has PUBLIC_VOLUUM_CLICK_URL — inject did not write rewriter markup (check disk write, shell path, or script regression).`,
  );
  process.exit(1);
}

/** Append deploy-driven copy bindings to first Astro frontmatter (only lines that are missing). */
function mergeMissingContentEnvIntoFrontmatter(frontmatter) {
  let fm = frontmatter;
  const lines = [
    { detect: /\bconst\s+brand\s*=/, line: "const brand     = import.meta.env.PUBLIC_BRAND     || 'Your Brand';" },
    { detect: /\bconst\s+domain\s*=/, line: "const domain    = import.meta.env.PUBLIC_DOMAIN    || 'example.com';" },
    { detect: /\bconst\s+h1\s*=/, line: "const h1        = import.meta.env.PUBLIC_H1        || '';" },
    { detect: /\bconst\s+sub\s*=/, line: "const sub       = import.meta.env.PUBLIC_SUB       || '';" },
    { detect: /\bconst\s+cta\s*=/, line: "const cta       = import.meta.env.PUBLIC_CTA       || 'Apply Now';" },
    { detect: /\bconst\s+title2\s*=/, line: "const title2    = import.meta.env.PUBLIC_TITLE2    || '';" },
    { detect: /\bconst\s+phone\s*=/, line: "const phone     = import.meta.env.PUBLIC_PHONE     || '';" },
    { detect: /\bconst\s+emailAddr\s*=/, line: "const emailAddr = import.meta.env.PUBLIC_EMAIL     || '';" },
    { detect: /\bconst\s+email\s*=/, line: "const email     = import.meta.env.PUBLIC_EMAIL     || '';" },
    { detect: /\bconst\s+aprMin\s*=/, line: "const aprMin    = import.meta.env.PUBLIC_APRMIN    || '5.99';" },
    { detect: /\bconst\s+aprMax\s*=/, line: "const aprMax    = import.meta.env.PUBLIC_APRMAX    || '35.99';" },
    { detect: /\bconst\s+amountMin\s*=/, line: "const amountMin = import.meta.env.PUBLIC_AMOUNTMIN || '500';" },
    { detect: /\bconst\s+amountMax\s*=/, line: "const amountMax = import.meta.env.PUBLIC_AMOUNTMAX || '10000';" },
    { detect: /\bconst\s+ctaHref\s*=/, line: "const ctaHref   = import.meta.env.PUBLIC_VOLUUM_CLICK_URL || '/apply';" },
  ];
  let added = 0;
  for (const { detect, line } of lines) {
    if (!detect.test(fm)) {
      fm = `${fm.trimEnd()}\n${line}`;
      added += 1;
    }
  }
  return { frontmatter: fm, added };
}

/**
 * Some imported/Bolt templates use literal placeholders like `${title2}` in Astro body.
 * Astro does not evaluate these unless they are written as `{title2}`.
 * Convert known copy placeholders to Astro expressions when matching vars exist.
 *
 * IMPORTANT: Only processes the HTML body section (after the closing ---),
 * never the frontmatter or <script> blocks, to avoid corrupting JS template literals.
 */
function normalizeDollarPlaceholdersInAstroBody(indexContent) {
  if (!indexContent || !indexContent.includes('${')) return { content: indexContent, changed: false };

  // Split out the frontmatter so we never modify JS template literals inside it.
  const fmRe = /^(---[\s\S]*?---[ \t]*\n?)/;
  const fmMatch = indexContent.match(fmRe);
  const frontmatter = fmMatch ? fmMatch[1] : '';
  let body = fmMatch ? indexContent.slice(frontmatter.length) : indexContent;

  // Only check for declared vars within the frontmatter (not the body).
  const hasVar = (name) => new RegExp(`\\bconst\\s+${name}\\s*=`).test(frontmatter || indexContent);

  // Protect <script> blocks from substitution.
  const scriptBlocks = [];
  body = body.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (m) => {
    const token = `\x00SC${scriptBlocks.length}\x00`;
    scriptBlocks.push(m);
    return token;
  });

  let changed = false;
  const replaceIfVar = (placeholder, varName) => {
    if (!hasVar(varName)) return;
    const re = new RegExp(`\\$\\{${placeholder}\\}`, 'g');
    if (re.test(body)) {
      body = body.replace(re, `{${varName}}`);
      changed = true;
    }
  };

  // Common copy vars
  [
    'brand', 'domain', 'h1', 'sub', 'cta', 'title2',
    'phone', 'email', 'address',
    'aprMin', 'aprMax', 'amountMin', 'amountMax',
  ].forEach((v) => replaceIfVar(v, v));

  // CTA/link placeholders often appear as ${redirectUrl} in imported templates
  if (hasVar('ctaHref')) {
    const rr = /\$\{redirectUrl\}/g;
    if (rr.test(body)) {
      body = body.replace(rr, '{ctaHref}');
      changed = true;
    }
  } else if (hasVar('redirectUrl')) {
    replaceIfVar('redirectUrl', 'redirectUrl');
  } else if (hasVar('voluumClickUrl')) {
    replaceIfVar('redirectUrl', 'voluumClickUrl');
  }

  // Restore script blocks.
  scriptBlocks.forEach((b, i) => { body = body.replace(`\x00SC${i}\x00`, b); });

  return { content: frontmatter + body, changed };
}

/**
 * Deploy .env can define PUBLIC_H1 etc., but Astro only renders values that appear in the template
 * as {h1}, {brand}, … Hardcoded "LendPath" will never change — warn in CI logs.
 */
function warnIfCopyEnvNotReferencedInTemplate(indexRaw, env) {
  const m = indexRaw.match(/^---\r?\n[\s\S]*?\r?\n---([\s\S]*)$/);
  if (!m) return;
  const body = m[1];
  const checks = [
    ['PUBLIC_H1', /\{h1\}|\{\s*h1\s*\}/],
    ['PUBLIC_BRAND', /\{brand\}|\{\s*brand\s*\}/],
    ['PUBLIC_SUB', /\{sub\}|\{\s*sub\s*\}/],
    ['PUBLIC_CTA', /\{cta\}|\{\s*cta\s*\}/],
    ['PUBLIC_AMOUNTMIN', /\{amountMin\}|\bamountMin\b/],
    ['PUBLIC_AMOUNTMAX', /\{amountMax\}|\bamountMax\b/],
    ['PUBLIC_APRMIN', /\{aprMin\}|\baprMin\b/],
    ['PUBLIC_APRMAX', /\{aprMax\}|\baprMax\b/],
  ];
  for (const [key, re] of checks) {
    const v = env[key];
    if (v === undefined || v === null || String(v).trim() === '') continue;
    if (!re.test(body)) {
      console.warn(
        `⚠ index.astro template does not reference copy bound to ${key} — deploy value will not appear until markup uses {h1}/{brand}/… (not hardcoded text).`,
      );
    }
  }
}

/**
 * CTA rewrite lives inside the same <script> as window.__VOLUUM_* so Astro/build cannot drop a
 * separate rewriter tag (scratchpaypet.tech had runtime globals but no /apply rewrite).
 */
const VOLUUM_CTA_PATCH_INLINE_JS = `
  function __foDestBase(){try{var w=window.__VOLUUM_CLICK_URL__||'';return(w&&/^https:\\/\\//i.test(String(w)))?String(w).trim():'';}catch(_){return'';}}
  function __foIsVT(v){try{v=decodeURIComponent(String(v==null?"":v)).trim();return/^\\{[A-Za-z0-9_]+\\}$/.test(v);}catch(_){return/^\\{[A-Za-z0-9_]+\\}$/.test(String(v==null?"":v).trim());}}
  function __foMergeCTA(b){try{var u=new URL(b,window.location.href);var l=new URLSearchParams(window.location.search);l.forEach(function(v,k){if(__foIsVT(v))return;u.searchParams.set(k,v);});return u.toString();}catch(_){return b;}}
  function __foPatchCta(){var bs=__foDestBase();if(!bs)return;var d=__foMergeCTA(bs);document.querySelectorAll('a[href="/apply"],a[href="#apply"],a[href="/apply/"],a[data-lp-cta="1"]').forEach(function(a){var h=a.getAttribute("href")||"";if(h==="/apply"||h==="/apply/"||h==="#apply")a.setAttribute("href",d);});document.querySelectorAll('a[href^="/apply?"]').forEach(function(a){a.setAttribute("href",d);});}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",__foPatchCta);else __foPatchCta();
  try{new MutationObserver(__foPatchCta).observe(document.documentElement,{childList:true,subtree:true});}catch(_){}
  setTimeout(__foPatchCta,0);setTimeout(__foPatchCta,400);setTimeout(__foPatchCta,1500);
`.trim();

/**
 * HTML comment for TrackingDashboard static analyzeHtml(); CTA rewrite is inlined in runtime script.
 */
function voluumCtaMarkerAndRewriterSnippet(clickUrlForComment) {
  const clickUrl = String(clickUrlForComment || '').trim();
  const hasCommentUrl = clickUrl && /^https?:\/\//i.test(clickUrl);
  const safeComment = clickUrl.replace(/-->/g, '--\\>');
  const comment = hasCommentUrl
    ? `<!-- lp-voluum-cta: ${safeComment} -->`
    : '<!-- lp-voluum-cta: (runtime: window.__VOLUUM_CLICK_URL__) -->';
  return `\n${comment}\n`;
}

function runtimeConfigFromEnvHtml(env) {
  const vol = env.PUBLIC_VOLUUMDOMAIN || env.VITE_VOLUUM_DOMAIN || '';
  const cid = env.PUBLIC_CONVERSIONID || env.VITE_CONVERSION_ID || '';
  const vclick = env.PUBLIC_VOLUUM_CLICK_URL || env.VITE_VOLUUM_CLICK_URL || '';
  const fsl = env.PUBLIC_FORMSTARTLABEL || env.VITE_FORM_START_LABEL || '';
  const fsub = env.PUBLIC_FORMSUBMITLABEL || env.VITE_FORM_SUBMIT_LABEL || '';
  const gtagRelayHost = env.PUBLIC_GTAGRELAYHOST || env.VITE_GTAG_RELAY_HOST || '';
  return `
<!-- Runtime config from .env (auto-injected, static HTML) -->
<script data-cfasync="false">
(function(){
  window.__VOLUUM_DOMAIN__ = ${JSON.stringify(vol)};
  window.__CONVERSION_ID__ = ${JSON.stringify(cid)};
  window.__VOLUUM_CLICK_URL__ = ${JSON.stringify(vclick)};
  window.__FORM_START_LABEL__ = ${JSON.stringify(fsl)};
  window.__FORM_SUBMIT_LABEL__ = ${JSON.stringify(fsub)};
  window.__GTAG_RELAY_HOST__ = ${JSON.stringify(gtagRelayHost)};
  if (!window.__VOLUUM_DOMAIN__ && window.__VOLUUM_CLICK_URL__) {
    try {
      var __vh = new URL(String(window.__VOLUUM_CLICK_URL__)).hostname;
      if (__vh) window.__VOLUUM_DOMAIN__ = __vh;
    } catch (_e) {}
  }
  var ns = document.getElementById('vlnoscript');
  if (ns && window.__VOLUUM_DOMAIN__) ns.href = 'https://' + window.__VOLUUM_DOMAIN__ + '/d/.js?noscript=true&lpurl=';
  ${VOLUUM_CTA_PATCH_INLINE_JS}
})();
</script>
`;
}

const RUNTIME_CONFIG_ASTRO = `
<!-- Runtime config (auto-injected) -->
<script is:inline>
  window.__VOLUUM_DOMAIN__ = '%%PUBLIC_VOLUUMDOMAIN%%';
  window.__CONVERSION_ID__ = '%%PUBLIC_CONVERSIONID%%';
  window.__VOLUUM_CLICK_URL__ = '%%PUBLIC_VOLUUM_CLICK_URL%%';
  window.__FORM_START_LABEL__ = '%%PUBLIC_FORMSTARTLABEL%%';
  window.__FORM_SUBMIT_LABEL__ = '%%PUBLIC_FORMSUBMITLABEL%%';
  window.__GTAG_RELAY_HOST__ = '%%PUBLIC_GTAGRELAYHOST%%';
  if (!window.__VOLUUM_DOMAIN__ && window.__VOLUUM_CLICK_URL__) {
    try {
      var __vh = new URL(String(window.__VOLUUM_CLICK_URL__)).hostname;
      if (__vh) window.__VOLUUM_DOMAIN__ = __vh;
    } catch (_e) {}
  }
  var ns = document.getElementById('vlnoscript');
  if (ns && window.__VOLUUM_DOMAIN__) ns.href = 'https://' + window.__VOLUUM_DOMAIN__ + '/d/.js?noscript=true&lpurl=';
  ${VOLUUM_CTA_PATCH_INLINE_JS}
</script>
`;

// ─── Injection logic ───

function hasTracking(content) {
  // Never falsely skip for the missing pixel. 
  // We remove existing injected tracking to ensure it's re-injected fresh, making logic idempotent.
  return false;
}

function cleanExistingTracking(html) {
  return html
    .replace(/<!-- Voluum Direct Tracking.*?<\/script>/gs, '')
    .replace(/<noscript><link id="vlnoscript".*?<\/noscript>/g, '')
    .replace(/<!-- GCLID.*?<\/script>/gs, '')
    .replace(/<!-- First-party pixel.*?<\/script>/gs, '')
    .replace(/<script data-cfasync="false">[\s\S]*?__gtagConversionId[\s\S]*?<\/script>/g, '')
    .replace(/<!-- Runtime config.*?<\/script>/gs, '');
    // Do not strip voluum-cta-rewriter; we want to keep the one built into the template
}

function hasGclIdCapture(content) {
  return /window\.__fpClickId|__lpLandingParams|__lpLandingSearch|gclid.*sessionStorage|sessionStorage.*gclid|__fpClickId/.test(content);
}

function injectIntoHtmlOrVite(filePath, isVite, templateRoot) {
  let html = fs.readFileSync(filePath, 'utf8');

  if (hasTracking(html)) {
    console.log(`  ✓ ${path.basename(filePath)} already has tracking — skipping`);
    return false;
  }

  // Idempotently clean old tracking to prevent duplicates
  html = cleanExistingTracking(html);

  // Inject runtime config + voluum before </head>
  // Vite: avoid <script type="module"> for globals — it runs deferred, so sync Voluum may read empty __VOLUUM_DOMAIN__.
  const root = templateRoot || path.dirname(filePath);
  const env = loadDotEnv(root);
  const hasEnvGlobals = Boolean(
    env.PUBLIC_VOLUUMDOMAIN || env.VITE_VOLUUM_DOMAIN
      || env.PUBLIC_CONVERSIONID || env.VITE_CONVERSION_ID
      || env.PUBLIC_VOLUUM_CLICK_URL || env.VITE_VOLUUM_CLICK_URL,
  );
  let runtimeConfig = '';
  if (!isVite || hasEnvGlobals) {
    runtimeConfig = runtimeConfigFromEnvHtml(env);
  }
  if (isVite && !hasEnvGlobals) {
    runtimeConfig = RUNTIME_CONFIG_VITE;
  }
  const vClickEnv = voluumClickUrlFromEnv(env);
  const headInject = runtimeConfig + VOLUUM_HEAD_SNIPPET + voluumCtaMarkerAndRewriterSnippet(vClickEnv);

  // We enforce that Voluum snippet fires absolute first in <head>
  if (html.includes('<head>')) {
    html = html.replace('<head>', '<head>\n' + headInject);
  } else if (html.includes('</head>')) {
    html = html.replace('</head>', headInject + '\n</head>');
  } else if (/<body\b/i.test(html)) {
    html = html.replace(/<body(\s[^>]*)?>/i, (_, g1) => `<head>\n${headInject}\n</head>\n<body${g1 || ''}>`);
  } else {
    html = `${headInject}\n${html}`;
  }

  // Inject GCLID capture before </body> if missing
  if (!hasGclIdCapture(html) && html.includes('</body>')) {
    html = html.replace('</body>', GCLID_CAPTURE_SNIPPET + '\n</body>');
  }

  // Inject pixel + gtag before </body>
  if (html.includes('</body>')) {
    html = html.replace('</body>', PIXEL_BODY_SNIPPET + '\n</body>');
  } else {
    html = html + '\n' + PIXEL_BODY_SNIPPET;
  }

  fs.writeFileSync(filePath, html, 'utf8');
  console.log(`  ✓ Injected tracking into ${path.basename(filePath)}`);
  return true;
}

function injectIntoAstro(filePath, projectRoot) {
  let content = fs.readFileSync(filePath, 'utf8');

  if (hasTracking(content)) {
    console.log(`  ✓ ${path.basename(filePath)} already has tracking — skipping`);
    return false;
  }

  // For Astro, we need to handle the frontmatter section
  // Inject voluum into <head> and pixel before </body>

  // Check if it already reads VOLUUMDOMAIN
  const hasVoluumVar = content.includes('PUBLIC_VOLUUMDOMAIN');

  // Add frontmatter variables if not present
  if (!hasVoluumVar) {
    const fmMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (fmMatch) {
      const additions = '\nconst __voluumDomain = import.meta.env.PUBLIC_VOLUUMDOMAIN || \'\';\n'
        + 'const __conversionId = import.meta.env.PUBLIC_CONVERSIONID || \'\';\n'
        + 'const __voluumClickUrl = import.meta.env.PUBLIC_VOLUUM_CLICK_URL || \'\';\n'
        + 'const __formStartLabel = import.meta.env.PUBLIC_FORMSTARTLABEL || \'\';\n'
        + 'const __formSubmitLabel = import.meta.env.PUBLIC_FORMSUBMITLABEL || \'\';\n'
        + 'const __gtagRelayHost = import.meta.env.PUBLIC_GTAGRELAYHOST || \'\';';
      const newFm = fmMatch[0].replace(/\r?\n---\s*$/, `${additions}\n---`);
      content = content.replace(fmMatch[0], newFm);
    }
  }

  // Replace Astro runtime config placeholders
  const astroRuntime = RUNTIME_CONFIG_ASTRO
    .replace("'%%PUBLIC_VOLUUMDOMAIN%%'", hasVoluumVar ? 'voluumDomain' : '__voluumDomain')
    .replace("'%%PUBLIC_CONVERSIONID%%'", hasVoluumVar ? 'conversionId || ""' : '__conversionId')
    .replace("'%%PUBLIC_VOLUUM_CLICK_URL%%'", hasVoluumVar ? 'voluumClickUrl || ""' : '__voluumClickUrl')
    .replace("'%%PUBLIC_FORMSTARTLABEL%%'", '__formStartLabel')
    .replace("'%%PUBLIC_FORMSUBMITLABEL%%'", '__formSubmitLabel')
    .replace("'%%PUBLIC_GTAGRELAYHOST%%'", '__gtagRelayHost')
    // For Astro, use define:vars or template literals
    .replace('<script is:inline>', () => {
      const varName = hasVoluumVar ? 'voluumDomain' : '__voluumDomain';
      const cidName = hasVoluumVar ? 'conversionId' : '__conversionId';
      const clickName = hasVoluumVar ? 'voluumClickUrl' : '__voluumClickUrl';
      return `<script is:inline define:vars={{ ${varName}, ${cidName}, ${clickName}, __formStartLabel, __formSubmitLabel, __gtagRelayHost }}>`;
    })
    .replace("= '%%PUBLIC_VOLUUMDOMAIN%%'", () => {
      const varName = hasVoluumVar ? 'voluumDomain' : '__voluumDomain';
      return `= ${varName}`;
    })
    .replace("= '%%PUBLIC_CONVERSIONID%%'", () => {
      const cidName = hasVoluumVar ? 'conversionId' : '__conversionId';
      return `= ${cidName}`;
    })
    .replace("= '%%PUBLIC_VOLUUM_CLICK_URL%%'", () => {
      const clickName = hasVoluumVar ? 'voluumClickUrl' : '__voluumClickUrl';
      return `= ${clickName}`;
    })
    .replace("= '%%PUBLIC_FORMSTARTLABEL%%'", '= __formStartLabel')
    .replace("= '%%PUBLIC_FORMSUBMITLABEL%%'", '= __formSubmitLabel')
    .replace("= '%%PUBLIC_GTAGRELAYHOST%%'", '= __gtagRelayHost');

  // Idempotently clean old tracking to prevent duplicates
 // content = cleanExistingTracking(content);

  // Inject into <head> at the top for priority
  const root = projectRoot || path.resolve(path.dirname(filePath), '..', '..');
  const envAstro = loadDotEnv(root);
  const headInject = astroRuntime + '\n' + VOLUUM_HEAD_SNIPPET;
  if (/<\s*head(\s[^>]*)?>/i.test(content)) {
    content = content.replace(/<\s*head(\s[^>]*)?>/i, (m) => `${m}\n${headInject}`);
  } else if (/<\s*\/\s*head\s*>/i.test(content)) {
    content = content.replace(/<\s*\/\s*head\s*>/i, `${headInject}\n$&`);
  } else if (/<\s*body(\s[^>]*)?>/i.test(content)) {
    content = content.replace(/<\s*body(\s[^>]*)?>/i, (m) => `<head>\n${headInject}\n</head>\n${m}`);
  }

  const bodyClose = /<\s*\/\s*body\s*>/i;
  if (bodyClose.test(content)) {
    if (!hasGclIdCapture(content)) {
      content = content.replace(bodyClose, `${GCLID_CAPTURE_SNIPPET}\n$&`);
    }
    content = content.replace(bodyClose, `${PIXEL_BODY_SNIPPET}\n$&`);
  } else {
    const tail = (hasGclIdCapture(content) ? '' : `${GCLID_CAPTURE_SNIPPET}\n`) + PIXEL_BODY_SNIPPET;
    content = `${content}\n${tail}`;
  }

  // Astro requires is:inline for scripts to render as-is (not bundled)
  content = content.replace(/<script data-cfasync="false">/g, '<script is:inline data-cfasync="false">');
  content = content.replace(
    /<script data-cfasync="false" data-fusionops="voluum-cta-rewriter">/gi,
    '<script is:inline data-cfasync="false" data-lp="voluum-cta-rewriter">',
  );
  content = content.replace(
    /<script data-cfasync="false" data-lp="voluum-cta-rewriter">/gi,
    '<script is:inline data-cfasync="false" data-lp="voluum-cta-rewriter">',
  );
  content = content.replace(/\bdata-fusionops-cta=/gi, 'data-lp-cta=');
  content = content.replace(/<script is:inline data-cfasync="false" is:inline>/g, '<script is:inline data-cfasync="false">');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`  ✓ Injected tracking into ${path.basename(filePath)}`);
  return true;
}

// ─── Main ───

let injected = false;

if (type === 'astro' && layoutAstro) {
  console.log(`Injecting tracking into Astro layout: ${layoutAstro}`);
  injected = injectIntoAstro(layoutAstro, templateDir);
} else if (type === 'vite') {
  console.log(`Injecting tracking into Vite index.html`);
  injected = injectIntoHtmlOrVite(indexHtml, true, templateDir);
} else if (type === 'html') {
  console.log(`Injecting tracking into HTML index.html`);
  injected = injectIntoHtmlOrVite(indexHtml, false, templateDir);
}

if (type === 'vite' && fs.existsSync(indexHtml)) {
  const post = fs.readFileSync(indexHtml, 'utf8');
  if (!post.includes('dtpCallback')) {
    console.warn('⚠ Vite index.html still has no Voluum dtpCallback after inject — check index path or permissions.');
  }
  if (!post.includes('__lpLandingParams') && !post.includes('__fpClickId')) {
    console.warn('⚠ Vite index.html missing landing-param capture block — body inject may have failed.');
  }
  if (!post.includes('voluum-cta-rewriter') && !post.includes('lp-voluum-cta') && !post.includes('__foPatchCta')) {
    console.warn('⚠ Vite index.html missing Voluum CTA rewriter — inject voluumCtaMarker may have failed.');
  }
  enforceRewriterWhenClickUrlInEnv(templateDir, indexHtml, post, 'Vite index.html');
}

if (type === 'astro' && layoutAstro && fs.existsSync(layoutAstro)) {
  const post = fs.readFileSync(layoutAstro, 'utf8');
  if (!post.includes('dtpCallback')) {
    console.warn(`⚠ Astro shell ${path.relative(templateDir, layoutAstro)} still has no Voluum dtpCallback after inject.`);
  }
  if (!post.includes('__lpLandingParams') && !post.includes('__fpClickId')) {
    console.warn(`⚠ Astro shell ${path.relative(templateDir, layoutAstro)} missing landing-param capture — body inject may have failed.`);
  }
  if (!post.includes('voluum-cta-rewriter') && !post.includes('lp-voluum-cta') && !post.includes('__foPatchCta')) {
    console.warn(`⚠ Astro shell ${path.relative(templateDir, layoutAstro)} missing Voluum CTA rewriter — inject voluumCtaMarker may have failed.`);
  }
  enforceRewriterWhenClickUrlInEnv(templateDir, layoutAstro, post, 'Astro shell');
}

if (type === 'html' && fs.existsSync(indexHtml)) {
  const post = fs.readFileSync(indexHtml, 'utf8');
  if (!hasVoluumCtaRewriterMarkup(post)) {
    console.warn(`⚠ HTML index.html missing Voluum CTA rewriter — inject voluumCtaMarker may have failed.`);
  }
  enforceRewriterWhenClickUrlInEnv(templateDir, indexHtml, post, 'HTML index.html');
}

if (injected) {
  console.log('✅ Tracking injection complete');
} else {
  console.log('ℹ No tracking injection needed (already present or skipped)');
}

// ─── Scaffold missing Astro boilerplate files ───
// These are identical across all templates. If missing, create them
// so validate-template-tracking.mjs passes.

if (type === 'astro') {
  const scaffoldFiles = {
    'src/pages/apply.astro': `---
// PUBLIC_AID from deploy .env (inject-tracking / CI)
const aid = import.meta.env.PUBLIC_AID || '14881';
const conversionId = import.meta.env.PUBLIC_CONVERSIONID || '';
const formStartLabel = import.meta.env.PUBLIC_FORMSTARTLABEL || '';
const formSubmitLabel = import.meta.env.PUBLIC_FORMSUBMITLABEL || '';
// Google Ads / Analytics relay host (e.g. t.example.com). When set, gtag.js
// loads from the relay and all beacons (GA4 + conversions) are sent via
// transport_url so ad blockers and ITP can't strip them. Defaults to empty,
// preserving legacy direct-to-Google behavior. See
// .planning/specs/tracking-pipeline-v1/DESIGN.md.
const gtagRelayHost = import.meta.env.PUBLIC_GTAGRELAYHOST || '';
const gtagLoaderBase = gtagRelayHost ? \`https://\${gtagRelayHost}\` : 'https://www.googletagmanager.com';
---
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Apply</title>
  <link rel="icon" href="/favicon.ico" sizes="any" />
  <link rel="icon" href="/vite.svg" type="image/svg+xml" />
  <link rel="dns-prefetch" href="//apikeep.com" />
  <style is:inline>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; min-height: 100vh; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    body { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 24px 16px 48px; }
    #_lg_form_ { width: 100%; max-width: 640px; }
  </style>
{conversionId && <script async src={\`\${gtagLoaderBase}/gtag/js?id=\${conversionId}\`}></script>}
</head>
<body>
<!-- Container MUST exist before inline script: LeadsGate reads #_lg_form_ when applicationInit.js runs. -->
<div id="_lg_form_"></div>

<script is:inline define:vars={{ aid, conversionId, formStartLabel, formSubmitLabel, gtagRelayHost }}>
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
if (conversionId) {
  gtag('js', new Date());
  var __gtagCfg = {};
  if (gtagRelayHost) __gtagCfg.transport_url = 'https://' + gtagRelayHost;
  gtag('config', conversionId, __gtagCfg);
}

// Same transport as index: GET image pixel — shows in Network as /e, avoids sendBeacon JSON being dropped or hidden.
function fpPixel(eventName, extra) {
  try {
    var pxHost = window.location.hostname.replace(/^www\./, '');
    var endpoint = 'https://t.' + pxHost + '/e';
    var cid = getVoluumClickId();
    var payload = { e: eventName, d: pxHost, ts: Date.now() };
    if (cid) { payload.cid = cid; payload.cpid = cid; payload.click_id = cid; }
    if (extra && typeof extra === 'object') {
      for (var k in extra) {
        if (!Object.prototype.hasOwnProperty.call(extra, k)) continue;
        var v = extra[k];
        if (v === undefined || v === null) continue;
        if (typeof v === 'object') continue;
        payload[k] = v;
      }
    }
    var q = new URLSearchParams();
    Object.keys(payload).forEach(function(k) {
      var v = payload[k];
      if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
    });
    var img = new Image(1, 1);
    img.src = endpoint + '?' + q.toString();
  } catch(_) {}
}

var SafeStorage = {
  _mem: {},
  set: function(k, v) {
    try { sessionStorage.setItem(k, v); }
    catch (e) { this._mem[k] = v; }
  },
  get: function(k) {
    try { return sessionStorage.getItem(k) || this._getCookie(k); }
    catch (e) { return this._getCookie(k) || this._mem[k] || null; }
  },
  _getCookie: function(k) {
    try { var m = document.cookie.match(new RegExp('(?:^|; )' + k + '=([^;]*)')); return m ? decodeURIComponent(m[1]) : null; } catch(_) { return null; }
  }
};

function getVoluumClickId() {
  var urlParams = new URLSearchParams(window.location.search);
  var fromUrl = urlParams.get('gclid') || urlParams.get('vlcid') || urlParams.get('clickid') || urlParams.get('cid') || urlParams.get('click_id') || urlParams.get('cpid') || '';
  var fromStorage = SafeStorage.get('clickid') || SafeStorage.get('vlcid') || SafeStorage.get('voluum_cpid') || SafeStorage.get('voluum_cid') || '';
  return fromUrl || fromStorage || '';
}

// Fire pv on apply page load
(function() {
  var p = new URLSearchParams(window.location.search);
  var cid = p.get('clickid') || p.get('vlcid') || p.get('click_id') || p.get('cid') || p.get('cpid') || '';
  fpPixel('pv', cid ? { click_id: cid } : {});
})();

// LeadsGate applicationInit.js only copies init.hooks → _lg_form_.hooks (not root-level onFormLoad).
window._lg_form_init_ = {
  aid: aid,
  template: "fresh",
  ref: window.location.hostname,
  get click_id() { return getVoluumClickId(); },

  hooks: {
    onFormLoad: function() {
      try {
        var cid = getVoluumClickId();
        if (!window.__fpLgFormLoadOnce) {
          window.__fpLgFormLoadOnce = true;
          fpPixel('lg_form_load', { click_id: cid, source: 'hook' });
        }
        if (conversionId && formStartLabel && !window.__gtagFormStartFired) {
          window.__gtagFormStartFired = true;
          gtag('event','conversion',{send_to: conversionId + '/' + formStartLabel});
        }
        window.dataLayer.push({ 'event': 'leadsgate_form_start', 'clickId': cid, 'timestamp': new Date().toISOString() });
      } catch(_) {}
    },

    onStepChange: function(step) {
      try {
        var cid = getVoluumClickId();
        var s = (step && typeof step === 'object') ? step.step || step : step;
        fpPixel('lg_step', { step: s, click_id: cid });
        window.dataLayer.push({ 'event': 'leadsgate_form_progress', 'step': s, 'clickId': cid });
        // Final-step form_submit fallback: LeadsGate step numbers are 1-based; step 8+ is typically final
        if (Number(s) >= 8 && !window.__formSubmitFired) {
          window.__formSubmitFired = true;
          fpPixel('lg_submit', { click_id: cid, source: 'step_fallback' });
          if (conversionId && formSubmitLabel) {
            gtag('event','conversion',{send_to: conversionId + '/' + formSubmitLabel});
          }
        }
      } catch(_) {}
    },

    onSubmit: function() {
      try {
        var cid = getVoluumClickId();
        if (!window.__formSubmitFired) {
          window.__formSubmitFired = true;
          fpPixel('lg_submit', { click_id: cid });
          if (conversionId && formSubmitLabel) {
            gtag('event','conversion',{send_to: conversionId + '/' + formSubmitLabel});
          }
        }
        window.dataLayer.push({ 'event': 'leadsgate_form_submit', 'clickId': cid, 'timestamp': new Date().toISOString() });
      } catch(_) {}
    },

    onSuccess: function(data) {
      try {
        if (!data) return;
        var voluumCid = getVoluumClickId();
        var type = data.type || 'unknown';
        var leadId = data.lead_id || '';
        var payout = data.price || 0;
        var status = type === 'soldLead' ? 'approved' : type === 'rejectLead' ? 'declined' : 'pending';
        var finalPayout = payout > 0 ? payout : (status === 'declined' ? 5.00 : 50.00);

        fpPixel('lg_' + status, { click_id: voluumCid, lead_id: leadId, status: status, payout: finalPayout });

        window.dataLayer.push({ 'event': 'lead_conversion_all', 'leadStatus': status, 'leadType': type, 'transactionId': leadId, 'conversionValue': finalPayout, 'clickId': voluumCid });

        if (type === 'soldLead') {
          window.dataLayer.push({ 'event': 'lead_conversion_approved', 'transactionId': leadId, 'conversionValue': finalPayout, 'clickId': voluumCid });
        } else if (type === 'rejectLead') {
          window.dataLayer.push({ 'event': 'lead_declined', 'transactionId': leadId, 'conversionValue': finalPayout, 'clickId': voluumCid });
        } else {
          window.dataLayer.push({ 'event': 'lead_pending', 'transactionId': leadId, 'conversionValue': finalPayout, 'clickId': voluumCid });
        }
      } catch(_) {}
    }
  }
};

var script = document.createElement('script');
script.setAttribute('data-cfasync', 'false');
script.type = 'text/javascript';
script.async = true;
script.src = 'https://apikeep.com/form/applicationInit.js';
document.body.appendChild(script);

// If LeadsGate never calls onFormLoad, still emit form_start when the embed mounts (deduped with hook).
(function setupLgFormLoadFallback() {
  var lgDiv = document.getElementById('_lg_form_');
  if (!lgDiv) return;
  var obs = new MutationObserver(function() {
    if (window.__fpLgFormLoadOnce) { obs.disconnect(); return; }
    if (lgDiv.children.length > 0) {
      window.__fpLgFormLoadOnce = true;
      obs.disconnect();
      fpPixel('lg_form_load', { click_id: getVoluumClickId(), source: 'observer' });
    }
  });
  obs.observe(lgDiv, { childList: true, subtree: true });
  setTimeout(function() {
    try { obs.disconnect(); } catch(_) {}
    if (!window.__fpLgFormLoadOnce) {
      window.__fpLgFormLoadOnce = true;
      fpPixel('lg_form_load', { click_id: getVoluumClickId(), source: 'timeout', error: 'form_not_loaded' });
    }
  }, 15000);
})();

</script>
</body>
</html>
`,
    'src/pages/e.ts': `import type { APIRoute } from 'astro';
export const POST: APIRoute = async ({ request }) => {
  try { const payload = JSON.parse(await request.text()); console.log('[pixel]', payload); } catch (_) {}
  return new Response(null, { status: 204 });
};
export const GET: APIRoute = () => new Response(null, { status: 204 });
`,
    'src/pages/robots.txt.ts': `import type { APIRoute } from 'astro';
export const GET: APIRoute = () => {
  const domain = import.meta.env.PUBLIC_DOMAIN || import.meta.env.PUBLIC_SITE_URL || '';
  const sitemapUrl = domain ? \`https://\${domain}/sitemap.xml\` : '';
  const lines = ['User-agent: *', 'Allow: /', 'Disallow: /apply/'];
  if (sitemapUrl) { lines.push(''); lines.push(\`Sitemap: \${sitemapUrl}\`); }
  return new Response(lines.join('\\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
`,
    'public/_headers': `/*.html
  Cache-Control: no-cache, no-store, must-revalidate

/
  Cache-Control: no-cache, no-store, must-revalidate

/*
  X-Frame-Options: SAMEORIGIN
  X-Content-Type-Options: nosniff
  X-XSS-Protection: 1; mode=block
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()
  Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
  X-Robots-Tag: index, follow
`,
  };

  for (const [relPath, content] of Object.entries(scaffoldFiles)) {
    const fullPath = path.join(templateDir, relPath);
    const isApply = relPath.includes('apply.astro');
    if (isApply || !fs.existsSync(fullPath)) {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
      console.log(`📄 ${isApply ? 'Force-updated' : 'Scaffolded missing file'}: ${relPath}`);
    }
  }

  // Inject env var declarations into index.astro if missing (per-variable — Bolt templates often
  // already declare some PUBLIC_* bindings; hardcoded body copy still needs {h1}/{brand}/… in markup.)
  const indexAstro = path.join(templateDir, 'src', 'pages', 'index.astro');
  if (fs.existsSync(indexAstro)) {
    let indexContent = fs.readFileSync(indexAstro, 'utf8');
    let changed = false;

    const fmMatch = indexContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (fmMatch) {
      const { frontmatter: newFm, added } = mergeMissingContentEnvIntoFrontmatter(fmMatch[1]);
      if (added > 0) {
        const newBlock = `---\n${newFm}\n---`;
        indexContent = newBlock + indexContent.slice(fmMatch[0].length);
        changed = true;
        console.log(`📄 Merged ${added} content env binding(s) into index.astro frontmatter`);
      }
    }

    // Replace common CTA href patterns with ctaHref (requires const ctaHref from merge above or template)
    if (/\bconst\s+ctaHref\s*=/.test(indexContent)
      && (indexContent.includes('href="/apply"') || indexContent.includes("href='/apply'") || indexContent.includes('href="#apply"'))) {
      indexContent = indexContent
        .replace(/href=["']\/apply["']/g, 'href={ctaHref}')
        .replace(/href=["']#apply["']/g, 'href={ctaHref}');
      changed = true;
      console.log('📄 Replaced CTA hrefs with ctaHref');
    }

    // Convert literal ${var} placeholders in Astro body into {var} expressions.
    const normalized = normalizeDollarPlaceholdersInAstroBody(indexContent);
    if (normalized.changed) {
      indexContent = normalized.content;
      changed = true;
      console.log('📄 Normalized ${...} placeholders to Astro expressions in index.astro');
    }

    if (changed) {
      fs.writeFileSync(indexAstro, indexContent);
    }

    const envCopy = loadDotEnv(templateDir);
    warnIfCopyEnvNotReferencedInTemplate(fs.readFileSync(indexAstro, 'utf8'), envCopy);
  }

  // Inject FORMSTARTLABEL / FORMSUBMITLABEL into Layout.astro if missing
  if (layoutAstro) {
    let layoutContent = fs.readFileSync(layoutAstro, 'utf8');
    if (!layoutContent.includes('PUBLIC_FORMSTARTLABEL')) {
      if (layoutContent.includes('---')) {
        const parts = layoutContent.split('---');
        if (parts.length >= 3) {
          parts[1] = parts[1].trimEnd() + `
const formStartLabel = import.meta.env.PUBLIC_FORMSTARTLABEL || 'Start Application';
const formSubmitLabel = import.meta.env.PUBLIC_FORMSUBMITLABEL || 'Submit Application';
`;
          layoutContent = parts.join('---');
        }
      }
      fs.writeFileSync(layoutAstro, layoutContent);
      console.log('📄 Injected FORMSTARTLABEL/FORMSUBMITLABEL into Layout.astro');
    }
  }

}
