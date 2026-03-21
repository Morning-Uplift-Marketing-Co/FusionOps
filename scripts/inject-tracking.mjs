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

// Voluum dtpCallback — works for both Astro and Vite
// For Astro: reads from import.meta.env.PUBLIC_VOLUUMDOMAIN
// For Vite: reads from window.__VOLUUM_DOMAIN__ (injected by runtime script)
const VOLUUM_HEAD_SNIPPET = `
<!-- Voluum Direct Tracking Pixel (auto-injected) -->
<script data-cfasync="false">
(function(){
  var vd = window.__VOLUUM_DOMAIN__;
  if (!vd) return;
  var s = document.createElement('style');
  s.textContent = '.dtpcnt{opacity:0;}';
  document.head.appendChild(s);
  var m = document.createElement('meta');
  m.httpEquiv = 'delegate-ch';
  m.content = ['sec-ch-ua','sec-ch-ua-mobile','sec-ch-ua-arch','sec-ch-ua-model','sec-ch-ua-platform','sec-ch-ua-platform-version','sec-ch-ua-bitness','sec-ch-ua-full-version-list','sec-ch-ua-full-version'].map(function(h){return h+' https://'+vd}).join('; ');
  document.head.appendChild(m);
  (function(e,d,k,n,u,v,g,w,C,f,p,x,D,c,q,r,h,t,y,G,z){function A(){for(var a=d.querySelectorAll(".dtpcnt"),b=0,l=a.length;b<l;b++)a[b][w]=a[b][w].replace(/(^|\\s+)dtpcnt($|\\s+)/g,"")}function E(a,b,l,F){var m=new Date;m.setTime(m.getTime()+(F||864E5));d.cookie=a+"="+b+"; "+l+"samesite=Strict; expires="+m.toGMTString()+"; path=/";k.setItem(a,b);k.setItem(a+"-expires",m.getTime())}function B(a){var b=d.cookie.match(new RegExp("(^| )"+a+"=([^;]+)"));return b?b.pop():k.getItem(a+"-expires")&&+k.getItem(a+"-expires")>(new Date).getTime()?k.getItem(a):null}z="https:"===e.location.protocol?"secure; ":"";e[f]||(e[f]=function(){(e[f].q=e[f].q||[]).push(arguments)},r=d[u],d[u]=function(){r&&r.apply(this,arguments);if(e[f]&&!e[f].hasOwnProperty("params")&&/loaded|interactive|complete/.test(d.readyState))for(;c=d[v][p++];)/\\/?click\\/?($|(\\/[0-9]+)?$)/.test(c.pathname)&&(c[g]="javascrip"+e.postMessage.toString().slice(4,5)+":"+f+'.l="'+c[g]+'",void 0')},setTimeout(function(){(t=RegExp("[?&]cpid(=([^&#]*)|&|#|$)").exec(e.location.href))&&t[2]&&(h=t[2],y=B("vl-"+h));var a=B("vl-cep"),b=location[g];if("savedCep"===D&&a&&(!h||"undefined"===typeof h)&&0>b.indexOf("cep=")){var l=-1<b.indexOf("?")?"&":"?";b+=l+a}c=d.createElement("script");q=d.scripts[0];c.defer=1;c.src="https://"+vd+"/d/.js?lpref="+n(d.referrer)+"&lpurl="+n(b)+"&lpt="+n(d.title)+"&vtm="+(new Date).getTime()+(y?"&uw=no":"");c[C]=function(){for(p=0;c=d[v][p++];)/dtpCallback\\.l/.test(c[g])&&(c[g]=decodeURIComponent(c[g]).match(/dtpCallback\\.l="([^"]+)/)[1]);A()};q.parentNode.insertBefore(c,q);h&&E("vl-"+h,"1",z)},0),setTimeout(A,7E3))})(window,document,localStorage,encodeURIComponent,"onreadystatechange","links","href","className","onerror","dtpCallback",0,0,"savedCep");
})();
</script>
<noscript><link id="vlnoscript" rel="stylesheet"/></noscript>
`;

// GCLID capture + URL parameter handling (auto-injected)
// Captures gclid, vlcid, clickid, click_id, cid, cpid from URL and stores in window.__fpClickId
const GCLID_CAPTURE_SNIPPET = `
<!-- GCLID/Click ID capture (auto-injected) -->
<script data-cfasync="false">
(function(){
  var p = new URLSearchParams(window.location.search);
  var cid = p.get('gclid') || p.get('vlcid') || p.get('clickid') || p.get('click_id') || p.get('cid') || p.get('cpid') || '';
  window.__fpClickId = cid || '';
  if (cid) {
    try {
      sessionStorage.setItem('__fpClickId', cid);
    } catch(_) {}
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
  return /dtpCallback|__fpPixel|fpPixel\(|auto-injected/.test(content);
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

  // Inject runtime config + voluum before </head>
  const runtimeConfig = isVite ? RUNTIME_CONFIG_VITE : '';
  const headInject = runtimeConfig + VOLUUM_HEAD_SNIPPET;

  if (html.includes('</head>')) {
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

  // Inject into </head>
  if (content.includes('</head>')) {
    content = content.replace('</head>', astroRuntime + '\n' + VOLUUM_HEAD_SNIPPET + '\n</head>');
  }

  // Inject GCLID capture before </body> if missing
  if (!hasGclIdCapture(content) && content.includes('</body>')) {
    content = content.replace('</body>', GCLID_CAPTURE_SNIPPET + '\n</body>');
  }

  // Inject pixel + gtag before </body>
  if (content.includes('</body>')) {
    content = content.replace('</body>', PIXEL_BODY_SNIPPET + '\n</body>');
  }

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

  // Inject ctaHref into index.astro if missing
  const indexAstro = path.join(templateDir, 'src', 'pages', 'index.astro');
  if (fs.existsSync(indexAstro)) {
    let indexContent = fs.readFileSync(indexAstro, 'utf8');
    if (!indexContent.includes('const ctaHref')) {
      // Add ctaHref declaration in frontmatter
      if (indexContent.includes('---')) {
        const parts = indexContent.split('---');
        if (parts.length >= 3) {
          parts[1] = parts[1].trimEnd() + `\nconst ctaHref = import.meta.env.PUBLIC_VOLUUMURL || '/apply';\n`;
          indexContent = parts.join('---');
        }
      }
      // Replace common CTA href patterns with ctaHref
      indexContent = indexContent
        .replace(/href=["']\/apply["']/g, 'href={ctaHref}')
        .replace(/href=["']#apply["']/g, 'href={ctaHref}');
      fs.writeFileSync(indexAstro, indexContent);
      console.log('📄 Injected ctaHref into index.astro');
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
}
