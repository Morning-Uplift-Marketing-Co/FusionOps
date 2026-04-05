#!/usr/bin/env node
/**
 * Inject first-party pixel + click-id capture into a plain Vite/static index.html.
 * Aligns with scripts/inject-tracking.mjs: Voluum test params, sessionStorage, localhost skip.
 *
 * Usage: node scripts/inject-index-html-tracking.mjs [template-dir]
 * Default template-dir: cwd
 */
import fs from 'node:fs';
import path from 'node:path';

const templateDir = path.resolve(process.argv[2] || '.');
const indexHtmlPath = path.join(templateDir, 'index.html');

if (!fs.existsSync(indexHtmlPath)) {
  console.warn('No index.html found — skipped');
  process.exit(0);
}

let html = fs.readFileSync(indexHtmlPath, 'utf8');

if (html.includes('__fpPixel') || html.includes('inject-index-html-tracking')) {
  console.log('⚠ Tracking already present — skipped');
  process.exit(0);
}

const TRACKING_SNIPPET = `
<!-- Landing index.html tracking (inject-index-html-tracking.mjs) -->
<script data-cfasync="false">
(function(){
  function isLocalHost() {
    var h = (location.hostname || '').toLowerCase();
    if (h === 'localhost' || h === '127.0.0.1' || h === '::1') return true;
    if (/^(\\d{1,3}\\.){3}\\d{1,3}$/.test(h)) return true;
    return false;
  }

  function getCid() {
    try {
      var p = new URLSearchParams(location.search);
      var fromUrl =
        p.get('vltid') ||
        p.get('_vlt') ||
        p.get('gclid') ||
        p.get('vlcid') ||
        p.get('clickid') ||
        p.get('click_id') ||
        p.get('cid') ||
        p.get('cpid') ||
        '';
      if (fromUrl) {
        try {
          sessionStorage.setItem('clickid', fromUrl);
          var uv = p.get('_vlt'); if (uv) sessionStorage.setItem('_vlt', uv);
          var vt = p.get('vltid'); if (vt) sessionStorage.setItem('vltid', vt);
        } catch (e1) {}
      }
      var fromSs = '';
      try {
        fromSs =
          sessionStorage.getItem('clickid') ||
          sessionStorage.getItem('_vlt') ||
          sessionStorage.getItem('vltid') ||
          sessionStorage.getItem('vlcid') ||
          '';
      } catch (e2) {}
      var fromStore = '';
      try {
        fromStore = localStorage.getItem('_cid') || sessionStorage.getItem('_cid') || '';
      } catch (e3) {}
      var cid = fromUrl || fromSs || fromStore || '';
      if (cid) {
        try {
          localStorage.setItem('_cid', cid);
          sessionStorage.setItem('_cid', cid);
        } catch (e4) {}
      }
      try { window.__fpClickId = cid || ''; } catch (e5) {}
      return cid;
    } catch (e) {
      return '';
    }
  }

  var CID = getCid();

  function pixelEndpoint() {
    if (isLocalHost()) return '';
    return 'https://t.' + location.hostname + '/e';
  }

  function send(event, data) {
    var ep = pixelEndpoint();
    if (!ep) {
      if (window.__DEBUG_FP_PIXEL) console.debug('[__fpPixel]', event, data);
      return;
    }
    try {
      var payload = Object.assign({
        e: event,
        cid: CID,
        ts: Date.now(),
        url: location.pathname,
        ref: document.referrer || ''
      }, data || {});

      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          ep,
          new Blob([JSON.stringify(payload)], { type: 'application/json' })
        );
      } else {
        var q = new URLSearchParams();
        Object.keys(payload).forEach(function (k) {
          var v = payload[k];
          if (v !== undefined && v !== null) q.set(k, String(v));
        });
        new Image().src = ep + '?' + q.toString();
      }
    } catch (err) {}
  }

  window.__fpPixel = function (ev, extra) { send(ev, extra); };
  window.__pixel = window.__fpPixel;

  if (!window.__pv) {
    window.__pv = true;
    send('pv');
  }

  var fired = {};
  window.addEventListener('scroll', function () {
    try {
      var denom = Math.max(1, document.body.scrollHeight - window.innerHeight);
      var pct = Math.round((100 * window.scrollY) / denom);
      [25, 50, 75, 100].forEach(function (t) {
        if (pct >= t && !fired[t]) {
          fired[t] = true;
          send('scroll_' + t);
        }
      });
    } catch (e) {}
  }, { passive: true });

  setTimeout(function () { send('top_30s'); }, 30000);
  setTimeout(function () { send('top_60s'); }, 60000);
})();
</script>
`;

if (html.includes('</body>')) {
  html = html.replace('</body>', `${TRACKING_SNIPPET}\n</body>`);
} else {
  html += TRACKING_SNIPPET;
}

fs.writeFileSync(indexHtmlPath, html, 'utf8');
console.log('✅ Injected index.html tracking →', indexHtmlPath);
