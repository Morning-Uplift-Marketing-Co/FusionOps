/**
 * Direct deploy script for scratchvetloans to CF Workers
 * Uses the fixed src/utils/template-router.js (ensureTrackingBaselineHtml strips CSS vars)
 */
import { readFileSync, readdirSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// Load env
function loadEnv() {
  try {
    const envPath = path.join(root, '.env');
    const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
    const env = {};
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
    }
    return env;
  } catch { return {}; }
}

const env = loadEnv();
const CF_ACCOUNT_ID = env.VITE_CF_ACCOUNT_ID || process.env.VITE_CF_ACCOUNT_ID;
const CF_API_TOKEN = env.VITE_CF_API_TOKEN || process.env.VITE_CF_API_TOKEN;
const WORKER_NAME = 'lp-worker-scratchvetloans-com-ccbe3e';

// Site config for scratchvetloans
const site = {
  id: 'ccbe3e3e28cd434',
  brand: 'scratchvetloans',
  domain: 'scratchvetloans.com',
  templateId: 'installment-bear-004',
  niche: 'pet-care',
  colorId: 'midnight-blue',
  amountMin: 100,
  amountMax: 5000,
  h1: "Quick Loans for Your Pet's Urgent Vet Care",
  sub: "Simple online application. Get funds for your pet's treatment with flexible installment plans.",
  headline: "Quick Loans for Your Pet's Urgent Vet Care",
  subheadline: "Simple online application. Get funds for your pet's treatment with flexible installment plans.",
  cta: 'Apply for a Vet Loan Now',
  phone: '1-855-504-2063',
  email: 'support@scratchvetloans.com',
  address: '123 Main St, New York, NY 10001',
};

// Import template router and registry
const { generateDeployAssetsByTemplate } = await import('../utils/template-router.js');
const { setCustomTemplatesCache } = await import('../utils/template-registry.js');

// Load installment-bear template files from local disk
// installment-bear-004 is the imported version of templates/installment-bear
console.log('[deploy] Loading installment-bear template files from local disk...');
function loadTemplateFiles(dirPath, prefix = '') {
  const files = {};
  try {
    for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        Object.assign(files, loadTemplateFiles(`${dirPath}/${entry.name}`, rel));
      } else {
        files[rel] = readFileSync(`${dirPath}/${entry.name}`, 'utf8');
      }
    }
  } catch (e) {
    console.warn('[deploy] Could not read template dir:', e.message);
  }
  return files;
}

const templateDir = path.join(root, 'templates', 'installment-bear');
const templateFiles = loadTemplateFiles(templateDir);
console.log('[deploy] Template files loaded:', Object.keys(templateFiles).filter(k => k.endsWith('.astro')));

// Inject into cache as installment-bear-004 so router can find it
setCustomTemplatesCache([{
  id: 'installment-bear-004',
  dbId: 'installment-bear-004',
  name: 'installment-bear-004',
  source: 'api',
  files: templateFiles,
}]);

console.log('[deploy] Generating HTML for scratchvetloans...');
const result = await Promise.resolve(generateDeployAssetsByTemplate(site));
// Result can be a string (fallback) or an assets map object
const indexHtml = typeof result === 'string' ? result : (result?.['/index.html'] || result?.['/']);

if (!indexHtml || indexHtml.length < 100) {
  console.error('[deploy] Failed to generate HTML, result:', typeof result, String(result).slice(0, 200));
  process.exit(1);
}

// Force-strip ALL hsl(var(--...)) from the entire HTML (they only appear in tailwind config)
let finalHtml = indexHtml.replace(/hsl\(var\(--[^)]+\)\)/g, '#000000');

const hasCssVars = finalHtml.includes('hsl(var(--');
const hasTailwindCdn = finalHtml.includes('cdn.tailwindcss.com');
console.log(`[deploy] HTML length: ${finalHtml.length}`);
console.log(`[deploy] Has CSS vars after strip: ${hasCssVars}`);
console.log(`[deploy] Has Tailwind CDN: ${hasTailwindCdn}`);

// Build CF Workers script
const applyHtml = typeof result === 'object' ? (result?.['/apply.html'] || result?.['/apply'] || null) : null;

const workerScript = `
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    if (path === '/' || path === '/index.html' || path === '') {
      return new Response(${JSON.stringify(finalHtml)}, {
        headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'public,max-age=300' }
      });
    }
    ${applyHtml ? `if (path === '/apply' || path === '/apply.html') {
      return new Response(${JSON.stringify(applyHtml)}, {
        headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'no-store' }
      });
    }` : ''}
    return new Response('Not Found', { status: 404 });
  }
};
`.trim();

// Deploy to CF Pages (scratchvetloans.com points here)
const PAGES_PROJECT = 'lp-scratchvetloans-com-ccbe3e';
const pagesDir = path.join(root, '.deploy-scratchvetloans-pages');
console.log(`[deploy] Deploying to CF Pages: ${PAGES_PROJECT}...`);
try {
  rmSync(pagesDir, { recursive: true, force: true });
  mkdirSync(pagesDir, { recursive: true });
  writeFileSync(path.join(pagesDir, 'index.html'), finalHtml, 'utf8');
  if (applyHtml) writeFileSync(path.join(pagesDir, 'apply.html'), applyHtml, 'utf8');

  // Capture wrangler output to get new deployment URL
  const wranglerOut = execSync(
    `npx wrangler pages deploy "${pagesDir}" --project-name ${PAGES_PROJECT} --branch=main --commit-dirty=true`,
    { cwd: root, encoding: 'utf8', env: { ...process.env, CLOUDFLARE_API_TOKEN: CF_API_TOKEN, CLOUDFLARE_ACCOUNT_ID: CF_ACCOUNT_ID } }
  );
  console.log(wranglerOut);

  console.log(`[deploy] New pages deployment complete`);

  console.log(`[deploy] ✅ CF Pages deployed! https://scratchvetloans.com`);
} catch (e) {
  console.warn('[deploy] ⚠️ CF Pages deploy failed:', e.message);
} finally {
  rmSync(pagesDir, { recursive: true, force: true });
}

// Deploy to CF Workers via API
console.log(`[deploy] Deploying to ${WORKER_NAME}...`);

const formData = new FormData();
formData.append('metadata', JSON.stringify({
  main_module: 'worker.js',
  compatibility_date: '2024-01-01',
  usage_model: 'standard',
}));
formData.append('worker.js', new Blob([workerScript], { type: 'application/javascript+module' }), 'worker.js');

const res = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/workers/scripts/${WORKER_NAME}`,
  {
    method: 'PUT',
    headers: { Authorization: `Bearer ${CF_API_TOKEN}` },
    body: formData,
  }
);

const cfResult = await res.json();
if (cfResult.success) {
  console.log(`[deploy] ✅ Deployed successfully!`);
  console.log(`[deploy] URL: https://lp-worker-scratchvetloans-com-ccbe3e.misty-feather-556e.workers.dev/`);
} else {
  console.error('[deploy] ❌ Deploy failed:', JSON.stringify(cfResult.errors, null, 2));
  process.exit(1);
}
