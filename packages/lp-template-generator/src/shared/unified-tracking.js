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
      p.get('cid') ||
      localStorage.getItem('_cid') ||
      sessionStorage.getItem('_cid') ||
      '';

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

      const endpoint = 'https://t.joracreditz.com/e';

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
      return localStorage.getItem('_cid') || sessionStorage.getItem('_cid') || '';
    } catch {
      return '';
    }
  }

  function pixel(e,data){
    try {
      navigator.sendBeacon(
        'https://t.joracreditz.com/e',
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

    onFormLoad(){
      pixel('form_start');
    },

    onSubmit(){
      pixel('form_submit');
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

export function generateApplyHtml(aid, brand) {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Apply | ${brand || ''}</title>
</head>

<body>

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