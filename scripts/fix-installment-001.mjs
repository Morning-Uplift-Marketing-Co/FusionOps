/**
 * Fix installment-001 template in D1:
 * 1. Normalize tier labels: "6 Months" → "Pay in 6", etc.
 * 2. Fix slider default value: value="5000" → value="${amountMax}"
 * 3. Add active class + selectCalcTier JS
 * 4. Reset active tier on slider change
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, readdirSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

function loadEnv() {
  try {
    const lines = readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/);
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
const API_BASE = 'https://lp-factory-api.misty-feather-556e.workers.dev';
const TEMPLATE_ROW_ID = '928ea6ba7e9c';
const TEMPLATE_DIR = path.join(root, 'templates', 'installment-bear');

// Load files from local disk (already fixed with amountMinRaw/amountMaxRaw)
console.log('[fix] Loading fixed files from local disk:', TEMPLATE_DIR);
function loadFiles(dir, prefix = '') {
  const result = {};
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      Object.assign(result, loadFiles(`${dir}/${entry.name}`, rel));
    } else {
      result[rel] = readFileSync(`${dir}/${entry.name}`, 'utf8');
    }
  }
  return result;
}

const files = loadFiles(TEMPLATE_DIR);
console.log('[fix] Files keys:', Object.keys(files));

// Verify fix is present
const indexContent = files['src/pages/index.astro'] || '';
console.log('[fix] Has amountMinRaw:', indexContent.includes('amountMinRaw'));
console.log('[fix] Has amountMaxRaw:', indexContent.includes('amountMaxRaw'));
console.log('[fix] Has Pay in 12:', indexContent.includes('Pay in 12'));
console.log('[fix] Has selectTier:', indexContent.includes('selectTier'));

// Push updated files back via PUT
console.log('[fix] Updating template in DB...');
const putRes = await fetch(`${API_BASE}/api/templates/${TEMPLATE_ROW_ID}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost' },
  body: JSON.stringify({ files, note: 'Fix tier labels + slider default + active state' })
});

if (!putRes.ok) {
  console.error('[fix] PUT failed:', putRes.status, await putRes.text());
  process.exit(1);
}

const result = await putRes.json();
console.log('[fix] ✅ Done:', result);
