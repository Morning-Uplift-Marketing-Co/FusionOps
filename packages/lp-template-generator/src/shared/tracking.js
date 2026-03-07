/**
 * Shared Tracking Module v2
 * =========================
 * Matches Art's Tracking & Conversion spec exactly.
 * 
 * Architecture: NO GTM / NO GA4
 *   Layer 1: gtag.js (AW-only) — micro-conv to train Google Ads AI
 *   Layer 2: Custom First-Party Pixel — sendBeacon → t.{domain}/e → D1
 *   Layer 3: Voluum — Lander tracking script + click URL
 *
 * Only 3 Conversion Actions:
 *   form_start  (secondary) — onFormLoad OR amount/zip interact on front page
 *   form_submit (primary)   — LeadsGate onSubmit
 *   sold_lead   (primary)   — Voluum s2s postback (server-side, not in LP)
 *
 * USAGE:
 *   import { trackingHeadTags, trackingBodyScript, formSubmitJS, leadsGateEmbed } from '../../shared/tracking.js';
 *
 *   <head>:         ${trackingHeadTags(c)}
 *   Before </body>: ${trackingBodyScript(c)}
 *   Hero <script>:  ${formSubmitJS(c)}
 *   /apply page:    ${leadsGateEmbed(c)}
 */


// ─────────────────────────────────────────────────────────────
// HEAD TAGS
// - gtag.js (AW-only, no GA4)
// - Voluum Lander Tracking Script (delegate-ch + dtpCallback)
// ─────────────────────────────────────────────────────────────

export function trackingHeadTags(c) {
  const parts = [];

  // Layer 1: Google Ads gtag.js — AW conversion ID only
  if (c.conversionId) {
    parts.push(`
    <script async src="https://www.googletagmanager.com/gtag/js?id=${c.conversionId}"></script>
    <script>
      window.dataLayer=window.dataLayer||[];
      function gtag(){dataLayer.push(arguments);}
      gtag('js',new Date());
      gtag('config','${c.conversionId}');
    </script>`);
  }

  // Layer 3: Voluum Lander Tracking Script
  if (c.voluumDomain) {
    parts.push(`
    <meta http-equiv="delegate-ch" content="sec-ch-ua https://${c.voluumDomain}; sec-ch-ua-mobile https://${c.voluumDomain}; sec-ch-ua-arch https://${c.voluumDomain}; sec-ch-ua-model https://${c.voluumDomain}; sec-ch-ua-platform https://${c.voluumDomain}; sec-ch-ua-platform-version https://${c.voluumDomain}; sec-ch-ua-bitness https://${c.voluumDomain}; sec-ch-ua-full-version-list https://${c.voluumDomain}; sec-ch-ua-full-version https://${c.voluumDomain}">
    <style>.dtpcnt{opacity:0;}</style>
    <script>
    (function(e,d,k,n,u,v,g,w,C,f,p,x,D,c,q,r,h,t,y,G,z){function A(){for(var a=d.querySelectorAll(".dtpcnt"),b=0,l=a.length;b<l;b++)a[b][w]=a[b][w].replace(/(^|\\s+)dtpcnt($|\\s+)/g,"")}function E(a,b,l,F){var m=new Date;m.setTime(m.getTime()+(F||864E5));d.cookie=a+"="+b+"; "+l+"samesite=Strict; expires="+m.toGMTString()+"; path=/";k.setItem(a,b);k.setItem(a+"-expires",m.getTime())}function B(a){var b=d.cookie.match(new RegExp("(^| )"+a+"=([^;]+)"));return b?b.pop():k.getItem(a+"-expires")&&+k.getItem(a+"-expires")>(new Date).getTime()?k.getItem(a):null}z="https:"===e.location.protocol?"secure; ":"";e[f]||(e[f]=function(){(e[f].q=e[f].q||[]).push(arguments)},r=d[u],d[u]=function(){r&&r.apply(this,arguments);if(e[f]&&!e[f].hasOwnProperty("params")&&/loaded|interactive|complete/.test(d.readyState))for(;c=d[v][p++];)/\\/?click\\/?($|(\\/[0-9]+)?$)/.test(c.pathname)&&(c[g]="javascrip"+e.postMessage.toString().slice(4,5)+":"+f+'.l="'+c[g]+'",void 0')},setTimeout(function(){(t=RegExp("[?&]cpid(=([^&#]*)|&|#|$)").exec(e.location.href))&&t[2]&&(h=t[2],y=B("vl-"+h));var a=B("vl-cep"),b=location[g];if("savedCep"===D&&a&&(!h||"undefined"===typeof h)&&0>b.indexOf("cep=")){var l=-1<b.indexOf("?")?"&":"?";b+=l+a}c=d.createElement("script");q=d.scripts[0];c.defer=1;c.src=x+(-1===x.indexOf("?")?"?":"&")+"lpref="+n(d.referrer)+"&lpurl="+n(b)+"&lpt="+n(d.title)+"&vtm="+(new Date).getTime()+(y?"&uw=no":"");c[C]=function(){for(p=0;c=d[v][p++];)/dtpCallback\\.l/.test(c[g])&&(c[g]=decodeURIComponent(c[g]).match(/dtpCallback\\.l="([^"]+)/)[1]);A()};q.parentNode.insertBefore(c,q);h&&E("vl-"+h,"1",z)},0),setTimeout(A,7E3))})(window,document,localStorage,encodeURIComponent,"onreadystatechange","links","href","className","onerror","dtpCallback",0,"https://${c.voluumDomain}/d/.js","savedCep");
    </script>
    <noscript><link href="https://${c.voluumDomain}/d/.js?noscript=true&lpurl=" rel="stylesheet"/></noscript>`);
  }

  return parts.join('\n');
}


// ─────────────────────────────────────────────────────────────
// BODY SCRIPT — First-Party Pixel + GCLID + Scroll/Time events
// Inject right before </body>
// ─────────────────────────────────────────────────────────────

export function trackingBodyScript(c) {
  return `
  <script>
  (function(){
    /* ── GCLID + Click ID Capture ── */
    var up = new URLSearchParams(window.location.search);
    var gid = up.get('gclid') || sessionStorage.getItem('gclid') || '';
    var cid = up.get('clickid') || up.get('click_id') || sessionStorage.getItem('click_id') || '';
    var sid = sessionStorage.getItem('_sid') || ('s_' + Date.now() + '_' + Math.random().toString(36).slice(2,8));
    sessionStorage.setItem('_sid', sid);
    if (gid) sessionStorage.setItem('gclid', gid);
    if (cid) sessionStorage.setItem('click_id', cid);

    /* Store UTM + Google Ads params */
    ['utm_source','utm_medium','utm_campaign','utm_term','utm_content',
     'gbraid','wbraid','campaignid','adgroupid','matchtype','network',
     'creative','keyword','placement','targetid','cpid','lpid'].forEach(function(k){
      var v = up.get(k);
      if (v) sessionStorage.setItem(k, v);
    });

    /* ── First-Party Pixel (Layer 2) ── */
    var PX = 'https://t.${c.domain}/e';
    function pixel(e, d) {
      var p = new URLSearchParams({
        e: e, sid: sid, cid: cid, gid: gid,
        ts: Date.now(), url: window.location.pathname,
        ref: document.referrer
      });
      if (d) for (var k in d) p.set(k, d[k]);
      if (navigator.sendBeacon) {
        navigator.sendBeacon(PX, p);
      } else {
        new Image(1,1).src = PX + '?' + p.toString();
      }
    }
    window.pixel = pixel;
    window.__pixel = pixel; /* backward compat */

    /* page_view */
    pixel('pv');

    /* ── Scroll Tracking (25/50/75/100%) ── */
    var scrollFired = {};
    window.addEventListener('scroll', function(){
      var pct = Math.round(100 * window.scrollY / (document.body.scrollHeight - window.innerHeight));
      [25,50,75,100].forEach(function(t){
        if (pct >= t && !scrollFired[t]) {
          scrollFired[t] = true;
          pixel('scroll_' + t);
        }
      });
    }, {passive: true});

    /* ── Time on Page (30s, 60s) ── */
    setTimeout(function(){ pixel('top_30s'); }, 30000);
    setTimeout(function(){ pixel('top_60s'); }, 60000);

    /* ── Expose config ── */
    window.__TRK = {
      conversionId: '${c.conversionId || ''}',
      formStartLabel: '${c.formStartLabel || ''}',
      formSubmitLabel: '${c.formSubmitLabel || ''}',
      aid: '${c.aid || ''}',
      voluumDomain: '${c.voluumDomain || ''}',
      clickId: cid, gclid: gid, sid: sid
    };
  })();
  </script>`;
}


// ─────────────────────────────────────────────────────────────
// FORM SUBMIT JS — Front Page Micro-Conversions
// Amount slider change + ZIP focus → fire form_start ONCE
// CTA click → Voluum click URL (trk.domain/click)
// ─────────────────────────────────────────────────────────────

export function formSubmitJS(c) {
  // CTA destination: Voluum click URL if configured, else /apply
  const ctaUrl = c.voluumDomain
    ? `https://${c.voluumDomain}/click`
    : '/apply';

  return `
    /* ── Micro-Conversions: form_start fires ONCE ── */
    var _formStarted = false;
    function fireFormStart() {
      if (_formStarted) return;
      _formStarted = true;
      ${c.conversionId && c.formStartLabel ? `
      if (typeof gtag === 'function') gtag('event', 'conversion', { send_to: '${c.conversionId}/${c.formStartLabel}' });` : ''}
      if (window.pixel) window.pixel('fs');
    }

    /* Amount slider → micro-conv + pixel */
    if (slider) {
      slider.addEventListener('input', function() {
        fireFormStart();
        if (window.pixel) window.pixel('amt', { amount: slider.value });
      });
    }

    /* ZIP field → micro-conv + pixel */
    var zipField = document.querySelector('input[maxlength="5"]');
    if (zipField) {
      zipField.addEventListener('focus', fireFormStart);
      zipField.addEventListener('input', function() {
        if (this.value.length === 5 && window.pixel) window.pixel('ze', { zip: this.value });
      });
    }

    /* ── Hero form submit → CTA click ── */
    function handleFormSubmit(e) {
      e.preventDefault();
      var amount = document.getElementById('amountSlider').value;
      if (window.pixel) window.pixel('cta', { amount: amount });
      sessionStorage.setItem('amount', amount);
      ${c.voluumDomain ? `
      /* Voluum click URL — Voluum handles redirect to offer */
      window.location.href = '${ctaUrl}';` : `
      /* Direct to apply page */
      window.location.href = '/apply?amount=' + amount;`}
    }`;
}


// ─────────────────────────────────────────────────────────────
// LEADSGATE FORM EMBED — /apply page
// Callbacks match spec exactly:
//   onFormLoad → gtag form_start + pixel
//   onStepChange → pixel
//   onSubmit → gtag form_submit + pixel
//   onSuccess → pixel ONLY (no redirect, LG auto-redirects)
// ─────────────────────────────────────────────────────────────

export function leadsGateEmbed(c) {
  if (!c.aid) return '';

  // If custom formEmbed provided, use raw
  if (c.formEmbed && c.formEmbed.trim()) {
    return c.formEmbed;
  }

  return `
  <div id="_lg_form_"></div>
  <script>
  (function(){
    var t = window.__TRK || {};
    var clickid = t.clickId || new URLSearchParams(window.location.search).get('clickid') || '';

    var _lg_form_init_ = {
      aid: "${c.aid}",
      template: "fresh",
      ref: window.location.hostname,
      click_id: clickid,

      onFormLoad: function() {
        ${c.conversionId && c.formStartLabel ? `
        if (typeof gtag === 'function') gtag('event', 'conversion', { send_to: '${c.conversionId}/${c.formStartLabel}' });` : ''}
        if (window.pixel) window.pixel('fl');
      },

      onStepChange: function(step) {
        if (window.pixel) window.pixel('step', { step: step });
      },

      onSubmit: function() {
        ${c.conversionId && c.formSubmitLabel ? `
        if (typeof gtag === 'function') gtag('event', 'conversion', { send_to: '${c.conversionId}/${c.formSubmitLabel}' });` : ''}
        if (window.pixel) window.pixel('fs', { clickid: clickid });
      },

      onSuccess: function(response) {
        /* Pixel only — NO redirect, LeadsGate auto-redirects to offer page */
        if (window.pixel) window.pixel('success', { clickid: clickid, lead_id: response && response.lead_id || '' });
      }
    };

    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.async = true;
    script.src = 'https://apikeep.com/form/applicationInit.js';
    document.body.appendChild(script);
  })();
  </script>`;
}
