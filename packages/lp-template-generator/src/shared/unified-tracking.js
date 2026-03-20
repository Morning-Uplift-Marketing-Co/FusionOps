/**
 * Unified Tracking Module
 * =======================
 * Single source of truth for ALL tracking code across every template type.
 *
 * Architecture (NO GTM / NO GA4):
 *   Layer 1: gtag.js (AW-only) — micro-conv to train Google Ads AI
 *   Layer 2: First-Party Pixel — sendBeacon → t.{domain}/e → CF Worker → D1
 *   Layer 3: Voluum — dtpCallback lander tracking script
 *
 * Used by:
 *   - scripts/inject-tracking.mjs (CI build-time injection)
 *   - templates/*/src/layouts/Layout.astro (Astro templates)
 *   - packages/lp-template-generator (module templates)
 *   - src/utils/template-router.js (preview)
 *
 * IMPORTANT: Every function returns an HTML string snippet ready to inject.
 * All click_id handling uses:
 *   - gclid as FIRST priority (Google Ads direct traffic)
 *   - 3 sessionStorage keys: voluum_cpid, voluum_cid, vlcid
 *   - getter pattern for LeadsGate (not static value)
 *   - try/catch on every callback
 */

// ─── Layer 2: First-Party Pixel + Click ID Capture ────────────────────────
// Inject in <head> — runs before anything else to capture click IDs early

export function getPixelHeadScript() {
  return `<script data-cfasync="false">
(function(){
  var p = new URLSearchParams(window.location.search);
  var _c = function(v) { return (v && /^\\{.*\\}$/.test(v)) ? '' : (v || ''); };
  var cid = _c(p.get('gclid')) || _c(p.get('vlcid')) || _c(p.get('clickid')) || _c(p.get('click_id')) || _c(p.get('cid')) || _c(p.get('cpid')) || '';

  if (cid) {
    window.__fpClickId = cid;
    try {
      sessionStorage.setItem('voluum_cpid', cid);
      sessionStorage.setItem('voluum_cid', cid);
      sessionStorage.setItem('vlcid', cid);
    } catch(_){}
  }

  var gclid = _c(p.get('gclid'));
  if (gclid) { try { sessionStorage.setItem('google_gclid', gclid); } catch(_){} }

  // Store UTM + Google Ads params
  ['utm_source','utm_medium','utm_campaign','utm_term','utm_content',
   'gbraid','wbraid','campaignid','adgroupid','matchtype','network',
   'creative','keyword','placement','targetid','lpid'].forEach(function(k){
    var v = p.get(k);
    if (v) { try { sessionStorage.setItem(k, v); } catch(_){} }
  });

  // Session ID
  var sid;
  try { sid = sessionStorage.getItem('_sid'); } catch(_){}
  if (!sid) {
    sid = 's_' + Date.now() + '_' + Math.random().toString(36).slice(2,8);
    try { sessionStorage.setItem('_sid', sid); } catch(_){}
  }

  window.__fpPixel = function(eventName, extra) {
    try {
      var endpoint = 'https://t.' + window.location.hostname + '/e';
      var payload = Object.assign({
        e: eventName, d: window.location.hostname,
        ts: Math.floor(Date.now()/1000), sid: sid,
        cid: cid, gid: gclid || '',
        url: window.location.pathname, ref: document.referrer
      }, extra || {});
      if (navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, JSON.stringify(payload));
      } else {
        var i = new Image(1,1);
        var q = new URLSearchParams();
        Object.keys(payload).forEach(function(k){ if (payload[k] != null) q.set(k, String(payload[k])); });
        i.src = endpoint + '?' + q.toString();
      }
    } catch(_) {}
  };

  window.__fpPixel('pv', cid ? { click_id: cid } : {});

  // Scroll tracking (25/50/75/100%)
  var scrollFired = {};
  window.addEventListener('scroll', function(){
    try {
      var pct = Math.round(100 * window.scrollY / Math.max(1, document.body.scrollHeight - window.innerHeight));
      [25,50,75,100].forEach(function(t){
        if (pct >= t && !scrollFired[t]) { scrollFired[t] = true; window.__fpPixel('scroll_' + t); }
      });
    } catch(_){}
  }, {passive: true});

  // Time on page (30s, 60s)
  setTimeout(function(){ window.__fpPixel('top_30s'); }, 30000);
  setTimeout(function(){ window.__fpPixel('top_60s'); }, 60000);
})();
</script>`;
}


// ─── Layer 1: Google Ads gtag.js ──────────────────────────────────────────
// Inject in <head> after pixel script

export function getGtagHeadScript(conversionId, formStartLabel, formSubmitLabel) {
  if (!conversionId) return '';

  return `<script data-cfasync="false" async src="https://www.googletagmanager.com/gtag/js?id=${conversionId}"></script>
<script data-cfasync="false">
(function(){
  window.dataLayer = window.dataLayer || [];
  function gtag(){window.dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', '${conversionId}');
  window.__gtag = gtag;
  window.__gtagConversionId = '${conversionId}';
  window.__formStartLabel = '${formStartLabel || ''}';
  window.__formSubmitLabel = '${formSubmitLabel || ''}';
})();
</script>`;
}


// ─── Layer 3: Voluum dtpCallback ──────────────────────────────────────────
// Inject in <head> after gtag

export function getVoluumHeadScript(voluumDomain) {
  if (!voluumDomain) return '';

  return `<meta http-equiv="delegate-ch" content="${[
    'sec-ch-ua','sec-ch-ua-mobile','sec-ch-ua-arch','sec-ch-ua-model',
    'sec-ch-ua-platform','sec-ch-ua-platform-version','sec-ch-ua-bitness',
    'sec-ch-ua-full-version-list','sec-ch-ua-full-version'
  ].map(function(h){ return h + ' https://' + voluumDomain; }).join('; ')}">
<style>.dtpcnt{opacity:0;}</style>
<script data-cfasync="false">
(function(e,d,k,n,u,v,g,w,C,f,p,x,D,c,q,r,h,t,y,G,z){function A(){for(var a=d.querySelectorAll(".dtpcnt"),b=0,l=a.length;b<l;b++)a[b][w]=a[b][w].replace(/(^|\\s+)dtpcnt($|\\s+)/g,"")}function E(a,b,l,F){var m=new Date;m.setTime(m.getTime()+(F||864E5));d.cookie=a+"="+b+"; "+l+"samesite=Strict; expires="+m.toGMTString()+"; path=/";k.setItem(a,b);k.setItem(a+"-expires",m.getTime())}function B(a){var b=d.cookie.match(new RegExp("(^| )"+a+"=([^;]+)"));return b?b.pop():k.getItem(a+"-expires")&&+k.getItem(a+"-expires")>(new Date).getTime()?k.getItem(a):null}z="https:"===e.location.protocol?"secure; ":"";e[f]||(e[f]=function(){(e[f].q=e[f].q||[]).push(arguments)},r=d[u],d[u]=function(){r&&r.apply(this,arguments);if(e[f]&&!e[f].hasOwnProperty("params")&&/loaded|interactive|complete/.test(d.readyState))for(;c=d[v][p++];)/\\/?click\\/?($|(\\/[0-9]+)?$)/.test(c.pathname)&&(c[g]="javascrip"+e.postMessage.toString().slice(4,5)+":"+f+'.l="'+c[g]+'",void 0')},setTimeout(function(){(t=RegExp("[?&]cpid(=([^&#]*)|&|#|$)").exec(e.location.href))&&t[2]&&(h=t[2],y=B("vl-"+h));var a=B("vl-cep"),b=location[g];if("savedCep"===D&&a&&(!h||"undefined"===typeof h)&&0>b.indexOf("cep=")){var l=-1<b.indexOf("?")?"&":"?";b+=l+a}c=d.createElement("script");q=d.scripts[0];c.defer=1;c.src=x+(-1===x.indexOf("?")?"?":"&")+"lpref="+n(d.referrer)+"&lpurl="+n(b)+"&lpt="+n(d.title)+"&vtm="+(new Date).getTime()+(y?"&uw=no":"");c[C]=function(){for(p=0;c=d[v][p++];)/dtpCallback\\.l/.test(c[g])&&(c[g]=decodeURIComponent(c[g]).match(/dtpCallback\\.l="([^"]+)/)[1]);A()};q.parentNode.insertBefore(c,q);h&&E("vl-"+h,"1",z)},0),setTimeout(A,7E3))})(window,document,localStorage,encodeURIComponent,"onreadystatechange","links","href","className","onerror","dtpCallback",0,"https://${voluumDomain}/d/.js","savedCep");
</script>
<noscript><link href="https://${voluumDomain}/d/.js?noscript=true&lpurl=" rel="stylesheet"/></noscript>`;
}


// ─── LeadsGate Apply Page Script ──────────────────────────────────────────
// Complete script for /apply page with all fixes:
//   - gclid as first priority
//   - sessionStorage key consistency (voluum_cpid, voluum_cid, vlcid)
//   - getter for click_id (not static)
//   - try/catch on every callback
//   - null-check on data before accessing properties

export function getApplyPageScript(aid) {
  if (!aid) return '';

  return `<script data-cfasync="false">
window.dataLayer = window.dataLayer || [];

function fpPixel(eventName, extra) {
  try {
    var endpoint = 'https://t.' + window.location.hostname + '/e';
    var payload = Object.assign({ e: eventName, d: window.location.hostname, ts: Math.floor(Date.now()/1000) }, extra || {});
    navigator.sendBeacon(endpoint, JSON.stringify(payload));
  } catch(_) {}
}

var SafeStorage = {
  _mem: {},
  set: function(k, v) { try { sessionStorage.setItem(k, v); } catch(e) { this._mem[k] = v; } },
  get: function(k) { try { return sessionStorage.getItem(k); } catch(e) { return this._mem[k] || null; } }
};

function getVoluumClickId() {
  var urlParams = new URLSearchParams(window.location.search);
  var fromUrl = urlParams.get('gclid') || urlParams.get('vlcid') || urlParams.get('clickid') || urlParams.get('cid') || urlParams.get('click_id') || urlParams.get('cpid') || '';
  var fromStorage = SafeStorage.get('voluum_cpid') || SafeStorage.get('voluum_cid') || SafeStorage.get('vlcid') || '';
  return fromUrl || fromStorage || '';
}

(function() {
  var p = new URLSearchParams(window.location.search);
  var cid = p.get('gclid') || p.get('vlcid') || p.get('clickid') || p.get('click_id') || p.get('cid') || p.get('cpid') || '';
  fpPixel('pv', cid ? { click_id: cid } : {});
})();

var _lg_form_init_ = {
  aid: "${aid}",
  template: "fresh",
  ref: window.location.hostname,
  get click_id() { return getVoluumClickId(); },

  onFormLoad: function() {
    try {
      var cid = getVoluumClickId();
      fpPixel('lg_form_load', { click_id: cid });
      window.dataLayer.push({ 'event': 'leadsgate_form_start', 'clickId': cid, 'timestamp': new Date().toISOString() });
    } catch(_) {}
  },

  onStepChange: function(step) {
    try {
      var cid = getVoluumClickId();
      var s = (step && typeof step === 'object') ? step.step || step : step;
      window.dataLayer.push({ 'event': 'leadsgate_form_progress', 'step': s, 'clickId': cid });
    } catch(_) {}
  },

  onSubmit: function() {
    try {
      var cid = getVoluumClickId();
      fpPixel('lg_submit', { click_id: cid });
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
};

var script = document.createElement('script');
script.setAttribute('data-cfasync', 'false');
script.type = 'text/javascript';
script.async = true;
script.src = 'https://apikeep.com/form/applicationInit.js';
document.body.appendChild(script);
</script>`;
}


// ─── Complete Apply Page HTML ─────────────────────────────────────────────
// Returns a full standalone HTML page for /apply

export function generateApplyHtml(aid, brand) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
  <title>Apply | ${brand || 'Apply'}</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html, body { height: 100%; min-height: 100vh; background: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    body { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 24px 16px 48px; }
    #_lg_form_ { width: 100%; max-width: 640px; }
  </style>
</head>
<body>
${getApplyPageScript(aid)}
<div id="_lg_form_"></div>
</body>
</html>`;
}


// ─── Convenience: All head tracking combined ──────────────────────────────

export function getAllHeadTracking({ conversionId, formStartLabel, formSubmitLabel, voluumDomain } = {}) {
  return [
    getPixelHeadScript(),
    getGtagHeadScript(conversionId, formStartLabel, formSubmitLabel),
    getVoluumHeadScript(voluumDomain),
  ].filter(Boolean).join('\n');
}
