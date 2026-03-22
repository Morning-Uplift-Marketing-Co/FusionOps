#!/usr/bin/env node
/**
 * Auto-inject tracking stack into any template (Astro or Vite/Loveable/HTML)
 *
 * Injects:
 *   1. Voluum dtpCallback (Direct Tracking Pixel) — reads VOLUUM_DOMAIN from env
 *   2. First-party pixel (fpPixel) — sends to t.{domain}/e
 *   3. Google Ads gtag — reads CONVERSION_ID from env
 *
 * Usage: node scripts/inject-tracking.mjs <template-dir>
 *
 * Supports:
 *   - Astro templates  (src/layouts/Layout.astro)
 *   - Vite/React/Loveable templates (index.html)
 *   - HTML-first templates (index.html or dist/index.html)
 */
import fs from 'node:fs';
import path from 'node:path';

const templateDir = path.resolve(process.argv[2] || '.');

// ─── Detect template type ───
const layoutAstro = findLayoutAstro(templateDir);
const indexHtml = path.join(templateDir, 'index.html');
const hasViteConfig = fs.existsSync(path.join(templateDir, 'vite.config.ts'))
  || fs.existsSync(path.join(templateDir, 'vite.config.js'));
const hasAstroConfig = fs.existsSync(path.join(templateDir, 'astro.config.mjs'))
  || fs.existsSync(path.join(templateDir, 'astro.config.ts'));

let type = 'unknown';
if (layoutAstro) type = 'astro';
else if (hasViteConfig && fs.existsSync(indexHtml)) type = 'vite';
else if (fs.existsSync(indexHtml)) type = 'html';

console.log(`Template type: ${type}`);
console.log(`Template dir: ${templateDir}`);

if (type === 'unknown') {
  console.warn('⚠ Could not detect template type — skipping tracking injection');
  process.exit(0);
}

// ─── Tracking snippets ───

// Voluum dtpCallback
const VOLUUM_HEAD_SNIPPET = `
<!-- Voluum Direct Tracking Pixel (v2) -->
<script data-cfasync="false">
(function(){
  var vd = window.__VOLUUM_DOMAIN__ || 'link.scratchpayeasy.com';
  if (!vd) return;
  var s = document.createElement('style');
  s.textContent = '.dtpcnt{opacity:0;}';
  document.head.appendChild(s);
  var m = document.createElement('meta');
  m.httpEquiv = 'delegate-ch';
  m.content = ['sec-ch-ua','sec-ch-ua-mobile','sec-ch-ua-arch','sec-ch-ua-model','sec-ch-ua-platform','sec-ch-ua-platform-version','sec-ch-ua-bitness','sec-ch-ua-full-version-list','sec-ch-ua-full-version'].map(function(h){return h+' https://'+vd}).join('; ');
  document.head.appendChild(m);
  (function(e,d,k,n,u,v,g,w,C,f,p,x,D,c,q,r,h,t,y,G,z){function A(){for(var a=d.querySelectorAll(".dtpcnt"),b=0,l=a.length;b<l;b++)a[b][w]=a[b][w].replace(/(^|\\s+)dtpcnt($|\\s+)/g,"")}function E(a,b,l,F){var m=new Date;m.setTime(m.getTime()+(F||864E5));d.cookie=a+"="+b+"; "+l+"samesite=Strict; expires="+m.toGMTString()+"; path=/; domain=."+window.location.hostname;k.setItem(a,b);k.setItem(a+"-expires",m.getTime())}function B(a){var b=d.cookie.match(new RegExp("(^| )"+a+"=([^;]+)"));return b?b.pop():k.getItem(a+"-expires")&&+k.getItem(a+"-expires")>(new Date).getTime()?k.getItem(a):null}z="https:"===e.location.protocol?"secure; ":"";e[f]||(e[f]=function(){(e[f].q=e[f].q||[]).push(arguments)},r=d[u],d[u]=function(){r&&r.apply(this,arguments);if(e[f]&&!e[f].hasOwnProperty("params")&&/loaded|interactive|complete/.test(d.readyState))for(;c=d[v][p++];)/\\/?click\\/?($|(\\/[0-9]+)?$)/.test(c.pathname)&&(c[g]="javascrip"+e.postMessage.toString().slice(4,5)+":"+f+'.l="'+c[g]+'",void 0')},setTimeout(function(){(t=RegExp("[?&]cpid(=([^&#]*)|&|#|$)").exec(e.location.href))&&t[2]&&(h=t[2],y=B("vl-"+h));var a=B("vl-cep"),b=location[g];if("savedCep"===D&&a&&(!h||"undefined"===typeof h)&&0>b.indexOf("cep=")){var l=-1<b.indexOf("?")?"&":"?";b+=l+a}c=d.createElement("script");q=d.scripts[0];c.defer=1;c.src="https://"+vd+"/d/.js?lpref="+n(d.referrer)+"&lpurl="+n(b)+"&lpt="+n(d.title)+"&vtm="+(new Date).getTime()+(y?"&uw=no":"");c[C]=function(){for(p=0;c=d[v][p++];)/dtpCallback\\.l/.test(c[g])&&(c[g]=decodeURIComponent(c[g]).match(/dtpCallback\\.l="([^"]+)/)[1]);A()};q.parentNode.insertBefore(c,q);h&&E("vl-"+h,"1",z)},0),setTimeout(A,7E3))})(window,document,localStorage,encodeURIComponent,"onreadystatechange","links","href","className","onerror","dtpCallback",0,0,"savedCep");
})();
</script>
<noscript><link id="vlnoscript" rel="stylesheet"/></noscript>
`;

// GCLID capture + URL parameter handling (auto-injected)
// Captures gclid, vlcid, clickid, click_id, cid, cpid from URL and stores in window.__fpClickId
const GCLID_CAPTURE_SNIPPET = `
<!-- GCLID/Click ID capture (v2) -->
<script data-cfasync="false">
(function(){
  var SafeStorage = {
    set: function(k, v) {
      if(!v) return;
      var d = new Date(); d.setTime(d.getTime() + (30*24*60*60*1000));
      document.cookie = k + "=" + v + "; expires=" + d.toUTCString() + "; path=/; domain=." + window.location.hostname.replace(/^www\\./, '');
    }
  };
  var p = new URLSearchParams(window.location.search);
  var cid = p.get('gclid') || p.get('vlcid') || p.get('clickid') || p.get('click_id') || p.get('cid') || p.get('cpid') || '';
  window.__fpClickId = cid || '';
  if (cid) {
    SafeStorage.set('clickid', cid);
  }
})();
</script>
`;

const PIXEL_BODY_SNIPPET = `
<!-- First-party pixel + Google Ads gtag (auto-injected) -->
<script data-cfasync="false">
(function(){
  var PX_ENDPOINT = 'https://t.' + window.location.hostname + '/e';
  function sendPixelBeacon(payload) {
    try {
      var q = new URLSearchParams();
      Object.keys(payload || {}).forEach(function(k){
        var v = payload[k];
        if (v !== undefined && v !== null) q.set(k, String(v));
      });
      var i = new Image(1, 1);
      i.src = PX_ENDPOINT + '?' + q.toString();
    } catch(_) {}
  }
  function fpPixel(eventName, extra) {
    var payload = Object.assign({ e: eventName, d: window.location.hostname, ts: Date.now() }, extra || {});
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

  // Amount slider tracking
  document.addEventListener('DOMContentLoaded', function(){
    var slider = document.querySelector('input[type="range"][id*="amount"], input[type="range"][name*="amount"], .amountSlider, [data-amt]');
    if (slider) {
      var debounce;
      slider.addEventListener('input', function(){ clearTimeout(debounce); debounce = setTimeout(function(){ fpPixel('amt', {amount: slider.value}); }, 400); });
    }
    // ZIP input tracking
    var zip = document.querySelector('input[id*="zip"], input[name*="zip"], input[placeholder*="ZIP"], .zipCode, input[type="text"][maxlength="5"]');
    if (zip) {
      var zfired = false;
      zip.addEventListener('focus', function(){ if (!zfired) { zfired = true; fpPixel('ze', {source:'focus'}); } });
      zip.addEventListener('input', function(){ if (zip.value.length === 5) fpPixel('ze', {zip: zip.value}); });
    }
  });
})();
</script>
<script data-cfasync="false">
(function(){
  var cid = window.__CONVERSION_ID__;
  if (!cid) return;
  var s = document.createElement('script');
  s.async = true;
  s.src = 'https://www.googletagmanager.com/gtag/js?id=' + cid;
  document.head.appendChild(s);
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', cid);
  window.__gtag = gtag;
  window.__gtagConversionId = cid;
  // form_start / form_submit labels
  window.__formStartLabel = window.__FORM_START_LABEL__ || '';
  window.__formSubmitLabel = window.__FORM_SUBMIT_LABEL__ || '';
})();
</script>
<script data-cfasync="false">
(function(){
  var SafeStorage = {
    set: function(k, v) {
      if(!v) return;
      var d = new Date(); d.setTime(d.getTime() + (30*24*60*60*1000));
      document.cookie = k + "=" + v + "; expires=" + d.toUTCString() + "; path=/; domain=." + window.location.hostname.replace(/^www\\./, '');
    }
  };
  try {
    var p = new URLSearchParams(window.location.search);
    var gclid = p.get('gclid');
    var clickid = p.get('clickid') || p.get('vlcid') || p.get('click_id') || p.get('cid');
    if (gclid) SafeStorage.set('google_gclid', gclid);
    if (clickid) { SafeStorage.set('clickid', clickid); SafeStorage.set('vlcid', clickid); }
    ['utm_source','utm_medium','utm_campaign'].forEach(function(k){ var v=p.get(k); if(v) SafeStorage.set(k,v); });
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
  // Set noscript link for Voluum
  var ns = document.getElementById('vlnoscript');
  if (ns && window.__VOLUUM_DOMAIN__) ns.href = 'https://' + window.__VOLUUM_DOMAIN__ + '/d/.js?noscript=true&lpurl=';
</script>
`;

const RUNTIME_CONFIG_ASTRO = `
<!-- Runtime config (auto-injected) -->
<script is:inline>
  window.__VOLUUM_DOMAIN__ = '%%PUBLIC_VOLUUMDOMAIN%%';
  window.__CONVERSION_ID__ = '%%PUBLIC_CONVERSIONID%%';
  window.__VOLUUM_CLICK_URL__ = '%%PUBLIC_VOLUUM_CLICK_URL%%';
  var ns = document.getElementById('vlnoscript');
  if (ns && window.__VOLUUM_DOMAIN__) ns.href = 'https://' + window.__VOLUUM_DOMAIN__ + '/d/.js?noscript=true&lpurl=';
</script>
`;

// ─── Injection logic ───

function findLayoutAstro(dir) {
  const candidates = [
    path.join(dir, 'src', 'layouts', 'Layout.astro'),
    path.join(dir, 'src', 'layouts', 'BaseLayout.astro'),
    path.join(dir, 'src', 'layouts', 'MainLayout.astro'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  // Search for any .astro layout file
  const layoutsDir = path.join(dir, 'src', 'layouts');
  if (fs.existsSync(layoutsDir)) {
    const files = fs.readdirSync(layoutsDir).filter(f => f.endsWith('.astro'));
    if (files.length > 0) return path.join(layoutsDir, files[0]);
  }
  return null;
}

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
}

function hasGclIdCapture(content) {
  return /window\.__fpClickId|gclid.*sessionStorage|sessionStorage.*gclid|__fpClickId/.test(content);
}

function injectIntoHtmlOrVite(filePath, isVite) {
  let html = fs.readFileSync(filePath, 'utf8');

  if (hasTracking(html)) {
    console.log(`  ✓ ${path.basename(filePath)} already has tracking — skipping`);
    return false;
  }

  // Idempotently clean old tracking to prevent duplicates
  html = cleanExistingTracking(html);

  // Inject runtime config + voluum before </head>
  const runtimeConfig = isVite ? RUNTIME_CONFIG_VITE : '';
  const headInject = runtimeConfig + VOLUUM_HEAD_SNIPPET;

  // We enforce that Voluum snippet fires absolute first in <head>
  if (html.includes('<head>')) {
    html = html.replace('<head>', '<head>\n' + headInject);
  } else if (html.includes('</head>')) {
    html = html.replace('</head>', headInject + '\n</head>');
  } else {
    // No </head> tag — prepend
    html = headInject + '\n' + html;
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

function injectIntoAstro(filePath) {
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
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    if (fmMatch) {
      const additions = `
const __voluumDomain = import.meta.env.PUBLIC_VOLUUMDOMAIN || '';
const __conversionId = import.meta.env.PUBLIC_CONVERSIONID || '';
const __voluumClickUrl = import.meta.env.PUBLIC_VOLUUM_CLICK_URL || '';`;
      content = content.replace(fmMatch[0], fmMatch[0].replace('\n---', additions + '\n---'));
    }
  }

  // Replace Astro runtime config placeholders
  const astroRuntime = RUNTIME_CONFIG_ASTRO
    .replace("'%%PUBLIC_VOLUUMDOMAIN%%'", hasVoluumVar ? 'voluumDomain' : '__voluumDomain')
    .replace("'%%PUBLIC_CONVERSIONID%%'", hasVoluumVar ? 'conversionId || ""' : '__conversionId')
    .replace("'%%PUBLIC_VOLUUM_CLICK_URL%%'", hasVoluumVar ? 'voluumClickUrl || ""' : '__voluumClickUrl')
    // For Astro, use define:vars or template literals
    .replace('<script is:inline>', () => {
      const varName = hasVoluumVar ? 'voluumDomain' : '__voluumDomain';
      const cidName = hasVoluumVar ? 'conversionId' : '__conversionId';
      const clickName = hasVoluumVar ? 'voluumClickUrl' : '__voluumClickUrl';
      return `<script is:inline define:vars={{ ${varName}, ${cidName}, ${clickName} }}>`;
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
    });

  // Idempotently clean old tracking to prevent duplicates
  content = cleanExistingTracking(content);

  // Inject into <head> at the top for priority
  const headInject = astroRuntime + '\n' + VOLUUM_HEAD_SNIPPET;
  if (content.includes('<head>')) {
    content = content.replace('<head>', '<head>\n' + headInject);
  } else if (content.includes('</head>')) {
    content = content.replace('</head>', headInject + '\n</head>');
  }

  // Inject GCLID capture before </body> if missing
  if (!hasGclIdCapture(content) && content.includes('</body>')) {
    content = content.replace('</body>', GCLID_CAPTURE_SNIPPET + '\n</body>');
  }

  // Inject pixel + gtag before </body>
  if (content.includes('</body>')) {
    content = content.replace('</body>', PIXEL_BODY_SNIPPET + '\n</body>');
  }

  // Astro requires is:inline for scripts to render as-is (not bundled)
  content = content.replace(/<script data-cfasync="false">/g, '<script is:inline data-cfasync="false">');
  content = content.replace(/<script is:inline data-cfasync="false" is:inline>/g, '<script is:inline data-cfasync="false">');

  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`  ✓ Injected tracking into ${path.basename(filePath)}`);
  return true;
}

// ─── Main ───

let injected = false;

if (type === 'astro' && layoutAstro) {
  console.log(`Injecting tracking into Astro layout: ${layoutAstro}`);
  injected = injectIntoAstro(layoutAstro);
} else if (type === 'vite') {
  console.log(`Injecting tracking into Vite index.html`);
  injected = injectIntoHtmlOrVite(indexHtml, true);
} else if (type === 'html') {
  console.log(`Injecting tracking into HTML index.html`);
  injected = injectIntoHtmlOrVite(indexHtml, false);
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
const aid = import.meta.env.PUBLIC_AID || '14881';
---
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Apply</title>
  <link rel="dns-prefetch" href="//apikeep.com" />
  <style>html,body{height:100%;min-height:100vh;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;}body{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding:24px 16px 48px;}#_lg_form_{width:100%;max-width:640px;}</style>
</head>
<body>
<script data-cfasync="false">
window.dataLayer = window.dataLayer || [];

var SafeStorage = {
  _mem: {},
  set: function(k, v) {
    if(!v) return;
    try {
      var d = new Date(); d.setTime(d.getTime() + (30*24*60*60*1000));
      document.cookie = k + "=" + v + "; expires=" + d.toUTCString() + "; path=/; domain=." + window.location.hostname.replace(/^www\\./, '');
    } catch (e) { this._mem[k] = v; }
  },
  get: function(k) {
    try {
      var m = document.cookie.match(new RegExp('(^| )' + k + '=([^;]+)'));
      return m ? m.pop() : (this._mem[k] || null);
    } catch (e) { return this._mem[k] || null; }
  }
};

function getCookie(name) {
  var match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? match.pop() : null;
}

function getVoluumClickId() {
  var urlParams = new URLSearchParams(window.location.search);
  var cid = urlParams.get('cid') || urlParams.get('click_id') || urlParams.get('clickid') || urlParams.get('vlcid') || urlParams.get('gclid');
  return cid || SafeStorage.get('clickid') || SafeStorage.get('vlcid') || getCookie('clickid') || getCookie('vlcid') || '';
}

function fpPixel(eventName, extra) {
  try {
    var endpoint = 'https://t.' + window.location.hostname + '/e';
    var payload = Object.assign({ e: eventName, d: window.location.hostname, ts: Math.floor(Date.now()/1000) }, extra || {});
    var q = new URLSearchParams();
    Object.keys(payload || {}).forEach(function(k){
      var v = payload[k];
      if (v !== undefined && v !== null) q.set(k, String(v));
    });
    var i = new Image(1, 1);
    i.src = endpoint + '?' + q.toString();
  } catch(_) {}
}

var _lg_form_init_ = {
  aid: \`\${aid}\`,
  template: "fresh",
  ref: window.location.hostname,
  get click_id() { return getVoluumClickId(); },
  
  hooks: {
    onFormLoad: function() {
      console.log('📋 LeadsGate form loaded');
      window.dataLayer.push({
        'event': 'leadsgate_form_start',
        'clickId': getVoluumClickId(),
        'gclid': SafeStorage.get('google_gclid'),
        'timestamp': new Date().toISOString()
      });
      fpPixel('lg_form_load', { click_id: getVoluumClickId() });
    },
    
    onStepChange: function(data) {
      var step = data && data.step ? data.step : data;
      console.log('📊 Form step:', step);
      window.dataLayer.push({
        'event': 'leadsgate_form_progress',
        'step': step,
        'clickId': getVoluumClickId()
      });
      fpPixel('lg_step', { step: step, click_id: getVoluumClickId() });
    },
    
    onSubmit: function() {
      console.log('📤 Form submitted');
      window.dataLayer.push({
        'event': 'leadsgate_form_submit',
        'clickId': getVoluumClickId(),
        'timestamp': new Date().toISOString()
      });
      fpPixel('lg_submit', { click_id: getVoluumClickId() });
    },
    
    onSuccess: function(data) {
      console.log('✅ LeadsGate Response:', data);
      var voluumCid = getVoluumClickId();
      var googleGclid = SafeStorage.get('google_gclid');
      
      var type = data.type;
      var leadId = data.lead_id;
      var payout = data.price || 0;
      
      var status = 'pending';
      if (type === 'soldLead') status = 'approved';
      else if (type === 'rejectLead') status = 'declined';
      
      var finalPayout = payout > 0 ? payout : (status === 'declined' ? 5.00 : 50.00);
      
      var conversionData = {
        transaction_id: leadId,
        value: finalPayout,
        currency: 'USD',
        status: status,
        type: type,
        click_id: voluumCid,
        gclid: googleGclid,
        created: data.created || new Date().toISOString()
      };
      
      window.dataLayer.push({
        'event': 'lead_conversion_all',
        'leadData': conversionData,
        'conversionValue': finalPayout,
        'leadStatus': status,
        'leadType': type,
        'transactionId': leadId,
        'clickId': voluumCid,
        'gclid': googleGclid
      });
      fpPixel('lg_success_all', { click_id: voluumCid, status: status, payout: finalPayout });
      
      if (type === 'soldLead') {
        window.dataLayer.push({
          'event': 'lead_conversion_approved', 'leadData': conversionData, 'conversionValue': finalPayout, 'transactionId': leadId, 'clickId': voluumCid, 'gclid': googleGclid
        });
        fpPixel('lg_success', { click_id: voluumCid, status: 'approved', payout: finalPayout });
      }
      
      if (type === 'rejectLead') {
        window.dataLayer.push({
          'event': 'lead_declined', 'leadData': conversionData, 'conversionValue': finalPayout, 'transactionId': leadId, 'clickId': voluumCid, 'gclid': googleGclid
        });
      }
      
      if (type === 'newLead') {
        window.dataLayer.push({
           'event': 'lead_pending', 'leadData': conversionData, 'conversionValue': finalPayout, 'transactionId': leadId, 'clickId': voluumCid, 'gclid': googleGclid
        });
      }
    }
  }
};

(function() {
  var p = new URLSearchParams(window.location.search);
  var cid = p.get('clickid') || p.get('vlcid') || p.get('click_id') || p.get('cid') || p.get('cpid') || '';
  fpPixel('pv', cid ? { click_id: cid } : {});

  // Fallback observer just in case form takes a while to inject
  var formLoadFired = false;
  var lgDiv = document.getElementById('_lg_form_');
  if (lgDiv) {
    var obs = new MutationObserver(function() {
      if (!formLoadFired && lgDiv.children.length > 0) {
         formLoadFired = true; obs.disconnect();
      }
    });
    obs.observe(lgDiv, { childList: true, subtree: true });
  }
})();

var script = document.createElement('script');
script.setAttribute('data-cfasync', 'false');
script.type = 'text/javascript';
script.async = true;
script.src = 'https://apikeep.com/form/applicationInit.js';
document.body.appendChild(script);
</script>

<div id="_lg_form_"></div>
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
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content);
      console.log(`📄 Scaffolded missing file: ${relPath}`);
    }
  }

  // Inject env var declarations into index.astro if missing
  const indexAstro = path.join(templateDir, 'src', 'pages', 'index.astro');
  if (fs.existsSync(indexAstro)) {
    let indexContent = fs.readFileSync(indexAstro, 'utf8');
    let changed = false;

    // Add content env vars if not present
    if (!indexContent.includes('PUBLIC_BRAND') && indexContent.includes('---')) {
      const parts = indexContent.split('---');
      if (parts.length >= 3) {
        parts[1] = parts[1].trimEnd() + `
const brand     = import.meta.env.PUBLIC_BRAND     || 'Your Brand';
const domain    = import.meta.env.PUBLIC_DOMAIN    || 'example.com';
const h1        = import.meta.env.PUBLIC_H1        || '';
const sub       = import.meta.env.PUBLIC_SUB       || '';
const cta       = import.meta.env.PUBLIC_CTA       || 'Apply Now';
const phone     = import.meta.env.PUBLIC_PHONE     || '';
const email     = import.meta.env.PUBLIC_EMAIL     || '';
const aprMin    = import.meta.env.PUBLIC_APRMIN    || '5.99';
const aprMax    = import.meta.env.PUBLIC_APRMAX    || '35.99';
const amountMin = import.meta.env.PUBLIC_AMOUNTMIN || '500';
const amountMax = import.meta.env.PUBLIC_AMOUNTMAX || '10000';
const ctaHref   = import.meta.env.PUBLIC_VOLUUM_CLICK_URL || '/apply';
`;
        indexContent = parts.join('---');
        changed = true;
        console.log('📄 Injected content env vars into index.astro');
      }
    }

    // Add ctaHref if not present (for templates that already have other env vars)
    if (!indexContent.includes('const ctaHref') && !indexContent.includes('ctaHref')) {
      if (indexContent.includes('---')) {
        const parts = indexContent.split('---');
        if (parts.length >= 3) {
          parts[1] = parts[1].trimEnd() + `\nconst ctaHref = import.meta.env.PUBLIC_VOLUUM_CLICK_URL || '/apply';\n`;
          indexContent = parts.join('---');
          changed = true;
        }
      }
    }

    // Replace common CTA href patterns with ctaHref
    if (indexContent.includes('href="/apply"') || indexContent.includes("href='/apply'") || indexContent.includes('href="#apply"')) {
      indexContent = indexContent
        .replace(/href=["']\/apply["']/g, 'href={ctaHref}')
        .replace(/href=["']#apply["']/g, 'href={ctaHref}');
      changed = true;
      console.log('📄 Replaced CTA hrefs with ctaHref');
    }

    if (changed) {
      fs.writeFileSync(indexAstro, indexContent);
    }
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

  // ─── Inject COLOR_MAP + design tokens into Layout.astro ───
  // This enables color switching via PUBLIC_COLORID env var
  if (layoutAstro) {
    let layoutContent = fs.readFileSync(layoutAstro, 'utf8');
    if (!layoutContent.includes('COLOR_MAP')) {
      // Add COLOR_MAP + FONT_MAP + RADIUS_MAP to frontmatter
      if (layoutContent.includes('---')) {
        const parts = layoutContent.split('---');
        if (parts.length >= 3) {
          parts[1] = parts[1].trimEnd() + `
const colorId = import.meta.env.PUBLIC_COLORID || 'ocean';
const fontId = import.meta.env.PUBLIC_FONTID || 'dm-sans';
const radiusId = import.meta.env.PUBLIC_RADIUS || 'rounded';
const primaryColor = import.meta.env.PUBLIC_PRIMARYCOLOR || '#3b5bdb';
const accentColor = import.meta.env.PUBLIC_ACCENTCOLOR || '#f97316';
const COLOR_MAP = {
  ocean:{p:[217,91,35],s:[158,64,42],a:[15,92,62],bg:[210,40,98],fg:[222,47,11]},
  forest:{p:[152,68,28],s:[45,93,47],a:[350,80,55],bg:[140,20,97],fg:[150,40,10]},
  midnight:{p:[235,70,42],s:[170,60,45],a:[25,95,58],bg:[230,25,97],fg:[235,50,12]},
  ruby:{p:[350,75,38],s:[200,70,45],a:[40,90,55],bg:[350,15,97],fg:[350,40,12]},
  slate:{p:[215,25,35],s:[160,50,42],a:[15,85,55],bg:[210,15,97],fg:[215,30,12]},
  coral:{p:[12,76,42],s:[185,60,40],a:[265,65,55],bg:[20,30,97],fg:[15,40,12]},
  teal:{p:[180,65,30],s:[280,55,55],a:[35,90,55],bg:[175,20,97],fg:[180,40,10]},
  plum:{p:[270,55,40],s:[150,55,42],a:[20,88,58],bg:[270,15,97],fg:[270,40,12]},
};
const FONT_MAP = {
  'dm-sans':{import:'DM+Sans:opsz,wght@9..40,400;9..40,600;9..40,700',family:'"DM Sans",system-ui,sans-serif'},
  'plus-jakarta':{import:'Plus+Jakarta+Sans:wght@400;600;700',family:'"Plus Jakarta Sans",system-ui,sans-serif'},
  'outfit':{import:'Outfit:wght@400;500;600;700',family:'"Outfit",system-ui,sans-serif'},
  'manrope':{import:'Manrope:wght@400;500;600;700',family:'"Manrope",system-ui,sans-serif'},
  'inter':{import:'Inter:wght@400;500;600;700',family:'"Inter",system-ui,sans-serif'},
  'sora':{import:'Sora:wght@400;500;600;700',family:'"Sora",system-ui,sans-serif'},
  'figtree':{import:'Figtree:wght@400;500;600;700',family:'"Figtree",system-ui,sans-serif'},
  'space-grotesk':{import:'Space+Grotesk:wght@400;500;600;700',family:'"Space Grotesk",system-ui,sans-serif'},
};
const RADIUS_MAP = {sharp:'0rem',subtle:'0.375rem',rounded:'0.75rem',pill:'1.5rem'};
const __pal = colorId === 'custom' ? null : (COLOR_MAP[colorId] || COLOR_MAP['ocean']);
const __hsl = (h,s,l) => h+' '+s+'%'+' '+l+'%';
const __rad = RADIUS_MAP[radiusId] || '0.75rem';
const __font = FONT_MAP[fontId] || FONT_MAP['dm-sans'];
const __cssVars = __pal
  ? '--primary:'+__hsl(...__pal.p)+';--secondary:'+__hsl(...__pal.s)+';--accent:'+__hsl(...__pal.a)+';--background:'+__hsl(...__pal.bg)+';--foreground:'+__hsl(...__pal.fg)+';--radius:'+__rad+';'
  : '--primary:'+primaryColor+';--accent:'+accentColor+';--radius:'+__rad+';';
`;
          layoutContent = parts.join('---');
        }
      }

      // Inject <style> and <link> into <head>
      if (layoutContent.includes('</head>')) {
        const colorStyle = `
<link href={\`https://fonts.googleapis.com/css2?family=\${__font.import}&display=swap\`} rel="stylesheet" media="print" onload="this.media='all'" />
<style is:inline set:html={\`:root { \${__cssVars} } body { font-family: \${__font.family}; }\`}></style>
`;
        layoutContent = layoutContent.replace('</head>', colorStyle + '</head>');
      }

      fs.writeFileSync(layoutAstro, layoutContent);
      console.log('🎨 Injected COLOR_MAP + design tokens into Layout.astro');
    }
  }
}
