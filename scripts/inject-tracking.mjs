#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const templateDir = path.resolve(process.argv[2] || '.');

// ─────────────────────────────────────────────
// DETECT TEMPLATE
// ─────────────────────────────────────────────

const indexHtml = path.join(templateDir, 'index.html');

if (!fs.existsSync(indexHtml)) {
  console.warn('No index.html found');
  process.exit(0);
}

let html = fs.readFileSync(indexHtml, 'utf8');

// ─────────────────────────────────────────────
// FIXED TRACKING SNIPPET (CORE PATCH)
// ─────────────────────────────────────────────

const TRACKING_SNIPPET = `
<!-- FusionOps Tracking (FIXED) -->
<script data-cfasync="false">
(function(){

  function getCid(){
    try {
      const p = new URLSearchParams(location.search);

      let cid =
        p.get('gclid') ||
        p.get('vlcid') ||
        p.get('clickid') ||
        p.get('click_id') ||
        p.get('cid') ||
        p.get('cpid') ||
        localStorage.getItem('_cid') ||
        sessionStorage.getItem('_cid') ||
        '';

      if(cid){
        localStorage.setItem('_cid', cid);
        sessionStorage.setItem('_cid', cid);
      }

      return cid;
    } catch {
      return '';
    }
  }

  const CID = getCid();
  const ENDPOINT = 'https://t.' + location.hostname + '/e';

  function send(event, data){
    try {
      const payload = {
        e: event,
        cid: CID,
        ts: Date.now(),
        url: location.pathname,
        ref: document.referrer,
        ...(data || {})
      };

      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          ENDPOINT,
          new Blob([JSON.stringify(payload)], { type:'application/json' })
        );
      } else {
        const q = new URLSearchParams(payload);
        new Image().src = ENDPOINT + '?' + q.toString();
      }

    } catch(e){}
  }

  window.__fpPixel = send;
  window.__pixel = send;

  if(!window.__pv){
    window.__pv = true;
    send('pv');
  }

  let fired = {};
  window.addEventListener('scroll', function(){
    try{
      const pct = Math.round(
        100 * window.scrollY /
        Math.max(1, document.body.scrollHeight - window.innerHeight)
      );

      [25,50,75,100].forEach(t=>{
        if(pct >= t && !fired[t]){
          fired[t] = true;
          send('scroll_'+t);
        }
      });
    }catch(e){}
  }, {passive:true});

  setTimeout(()=>send('top_30s'),30000);
  setTimeout(()=>send('top_60s'),60000);

})();
</script>
`;

// ─────────────────────────────────────────────
// INJECT
// ─────────────────────────────────────────────

if (!html.includes('__fpPixel')) {

  if (html.includes('</body>')) {
    html = html.replace('</body>', TRACKING_SNIPPET + '\\n</body>');
  } else {
    html += TRACKING_SNIPPET;
  }

  fs.writeFileSync(indexHtml, html, 'utf8');
  console.log('✅ Injected FIXED tracking');

} else {
  console.log('⚠ Tracking already exists — skipped');
}
