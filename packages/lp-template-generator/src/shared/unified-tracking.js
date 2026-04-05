/**
 * FUSIONOPS UNIFIED TRACKING (FIXED VERSION)
 * ==========================================
 * - Single click ID: _cid
 * - JSON sendBeacon only
 * - Stable across pages / domains
 * - Dedup conversion
 */

// ─────────────────────────────────────────────
// GLOBAL CLICK ID MANAGER
// ─────────────────────────────────────────────

function getClickId() {
  try {
    const p = new URLSearchParams(location.search);

    let cid =
      p.get('gclid') ||
      p.get('clickid') ||
      p.get('vlcid') ||
      p.get('click_id') ||
      p.get('cid') ||
      p.get('cpid') ||
      localStorage.getItem('_cid') ||
      sessionStorage.getItem('_cid') ||
      sessionStorage.getItem('clickid') ||
      '';

    // Also try cookie fallback (index page stores clickid as cookie)
    if (!cid) {
      try { var m = document.cookie.match(/(?:^|; )clickid=([^;]*)/); if (m) cid = decodeURIComponent(m[1]); } catch(_) {}
    }

    if (cid) {
      localStorage.setItem('_cid', cid);
      sessionStorage.setItem('_cid', cid);
    }

    return cid;
  } catch {
    return '';
  }
}

// ─────────────────────────────────────────────
// LAYER 2: PIXEL (FIXED)
// ─────────────────────────────────────────────

export function getPixelHeadScript() {
  return `<script>
(function(){

  const cid = (${getClickId.toString()})();

  window.__fpPixel = function(event, data){
    try {
      const payload = {
        e: event,
        cid: cid,
        ts: Date.now(),
        url: location.pathname,
        ref: document.referrer,
        ...(data || {})
      };

      const endpoint = 'https://t.' + location.hostname.replace(/^www\./, '') + '/e';

      navigator.sendBeacon?.(
        endpoint,
        new Blob([JSON.stringify(payload)], {
          type: 'application/json'
        })
      );

    } catch(e){}
  };

  // page view
  window.__fpPixel('pv');

  // scroll tracking
  let fired = {};
  window.addEventListener('scroll', function(){
    try {
      const pct = Math.round(
        100 * window.scrollY /
        (document.body.scrollHeight - window.innerHeight)
      );

      [25,50,75,100].forEach(t=>{
        if(pct >= t && !fired[t]){
          fired[t] = true;
          window.__fpPixel('scroll_'+t);
        }
      });
    } catch(e){}
  }, { passive:true });

  // time on page
  setTimeout(()=>window.__fpPixel('top_30s'),30000);
  setTimeout(()=>window.__fpPixel('top_60s'),60000);

})();
</script>`;
}

// ─────────────────────────────────────────────
// GOOGLE ADS (unchanged, safe)
// ─────────────────────────────────────────────

export function getGtagHeadScript(conversionId) {
  if (!conversionId) return '';

  return `<script async src="https://www.googletagmanager.com/gtag/js?id=${conversionId}"></script>
<script>
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${conversionId}');
</script>`;
}

// ─────────────────────────────────────────────
// LEADSGATE APPLY SCRIPT (FIXED)
// ─────────────────────────────────────────────

export function getApplyPageScript(aid) {
  if (aid == null || String(aid).trim() === '') return '';

  // Inline JSON string so the browser never evaluates a bare `aid` variable (avoids ReferenceError).
  const aidJson = JSON.stringify(String(aid));

  return `<script>

(function(){

  const seen = new Set();

  function getClickId(){
    try {
      var p = new URLSearchParams(location.search);
      var u = p.get('clickid')||p.get('vlcid')||p.get('click_id')||p.get('cid')||p.get('cpid')||p.get('gclid')||'';
      if (u) return u;
      return localStorage.getItem('_cid') || sessionStorage.getItem('_cid') || sessionStorage.getItem('clickid') || '';
    } catch {
      return '';
    }
  }

  function pixel(e,data){
    try {
      navigator.sendBeacon(
        'https://t.' + location.hostname.replace(/^www\./, '') + '/e',
        new Blob([JSON.stringify({
          e,
          cid:getClickId(),
          ts:Date.now(),
          ...(data||{})
        })],{type:'application/json'})
      );
    } catch(e){}
  }

  window._lg_form_init_ = {
    aid: ${aidJson},
    template: "fresh",

    get click_id() {
      return getClickId();
    },

    hooks: {
      onFormLoad(){
        pixel('form_start');
        if (window.__gtagConversionId && window.__formStartLabel && !window.__gtagFormStartFired) {
          window.__gtagFormStartFired = true;
          if (typeof gtag === 'function') gtag('event','conversion',{send_to: window.__gtagConversionId + '/' + window.__formStartLabel});
        }
      },

      onStepChange(step){
        var s = (step && typeof step === 'object') ? step.step || step : step;
        pixel('step_change', {step: s});
        if (Number(s) >= 8 && !window.__formSubmitFired) {
          window.__formSubmitFired = true;
          pixel('form_submit', {source: 'step_fallback'});
          if (window.__gtagConversionId && window.__formSubmitLabel && typeof gtag === 'function') {
            gtag('event','conversion',{send_to: window.__gtagConversionId + '/' + window.__formSubmitLabel});
          }
        }
      },

      onSubmit(){
        if (!window.__formSubmitFired) {
          window.__formSubmitFired = true;
          pixel('form_submit');
          if (window.__gtagConversionId && window.__formSubmitLabel && typeof gtag === 'function') {
            gtag('event','conversion',{send_to: window.__gtagConversionId + '/' + window.__formSubmitLabel});
          }
        }
      },

      onSuccess(data){
        try{
          if(!data) return;

          const id = data.lead_id;
          if(!id || seen.has(id)) return;

          seen.add(id);

          pixel('conversion',{
            lead_id:id,
            payout:data.price || 0,
            status:data.type || 'unknown'
          });

        }catch(e){}
      }
    }
  };

  const s = document.createElement('script');
  s.async = true;
  s.src = 'https://apikeep.com/form/applicationInit.js';
  document.body.appendChild(s);

})();
</script>`;
}

// ─────────────────────────────────────────────
// FULL APPLY PAGE
// ─────────────────────────────────────────────

export function generateApplyHtml(aid, brand, { conversionId, formStartLabel, formSubmitLabel } = {}) {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Apply | ${brand || ''}</title>
<link rel="icon" href="/favicon.ico" sizes="any" />
<link rel="icon" href="/vite.svg" type="image/svg+xml" />
${getGtagHeadScript(conversionId)}
</head>

<body>
${conversionId ? `<script>window.__gtagConversionId='${conversionId}';window.__formStartLabel='${formStartLabel || ''}';window.__formSubmitLabel='${formSubmitLabel || ''}';</script>` : ''}

${getPixelHeadScript()}
${getApplyPageScript(aid)}

<div id="_lg_form_"></div>

</body>
</html>`;
}

// ─────────────────────────────────────────────
// ALL HEAD
// ─────────────────────────────────────────────

export function getAllHeadTracking({ conversionId } = {}) {
  return [
    getPixelHeadScript(),
    getGtagHeadScript(conversionId)
  ].join('\\n');
}