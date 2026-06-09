#!/usr/bin/env node
/**
 * One-shot heal for stale D1 database IDs in Worker D1 settings (+ optional API/Neon).
 *
 * Usage:
 *   npm run heal:d1
 *   node scripts/heal-d1-settings.mjs
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const logPath = path.resolve(root, 'debug-1c6fbd.log');
const LEGACY_MAIN_ID = '7d31d941-f863-46f5-99c2-2179de821573';
const PRODUCTION_MAIN_ID = '4eaee76d-10fb-42a7-bb9d-50737c3da785';
const API_BASE = (process.env.API_BASE || 'https://lp-factory-api.misty-feather-556e.workers.dev/api').replace(/\/+$/, '');

function appendLog(entry) {
  fs.appendFileSync(logPath, `${JSON.stringify({ sessionId: '1c6fbd', timestamp: Date.now(), ...entry })}\n`);
}

function wranglerD1(sql) {
  const cmd = `npx wrangler d1 execute fusionops-main-new-v2 --remote --json --command "${sql.replace(/"/g, '\\"')}"`;
  const r = spawnSync(cmd, {
    cwd: path.join(root, 'apps/api-worker'),
    encoding: 'utf8',
    shell: true,
  });
  if (r.status !== 0) {
    throw new Error(r.stderr || r.stdout || 'wrangler d1 execute failed');
  }
  try {
    const parsed = JSON.parse(r.stdout);
    return parsed?.[0]?.results ?? [];
  } catch {
    return [];
  }
}

async function healViaApi() {
  const getRes = await fetch(`${API_BASE}/settings`);
  if (!getRes.ok) return { ok: false, status: getRes.status };
  const current = await getRes.json();
  const postRes = await fetch(`${API_BASE}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      d1DatabaseId: PRODUCTION_MAIN_ID,
      cfD1DatabaseId: PRODUCTION_MAIN_ID,
    }),
  });
  return { ok: postRes.ok, status: postRes.status, before: current };
}

async function main() {
  console.log('Heal D1 settings (production main DB UUID)');

  const before = wranglerD1(
    "SELECT key, value FROM settings WHERE key IN ('d1DatabaseId', 'cfD1DatabaseId')"
  );
  const beforeMap = Object.fromEntries(before.map((r) => [r.key, r.value]));
  console.log('D1 before:', beforeMap);

  appendLog({
    runId: 'heal-prod-v1',
    hypothesisId: 'B,M',
    location: 'heal-d1-settings.mjs:before',
    message: 'Production D1 settings before heal',
    data: { before: beforeMap },
  });

  const needsHeal =
    beforeMap.cfD1DatabaseId === LEGACY_MAIN_ID ||
    beforeMap.d1DatabaseId === LEGACY_MAIN_ID ||
    beforeMap.cfD1DatabaseId !== PRODUCTION_MAIN_ID ||
    beforeMap.d1DatabaseId !== PRODUCTION_MAIN_ID;

  if (!needsHeal) {
    console.log('✓ D1 settings already correct');
  } else {
    wranglerD1(`
      INSERT INTO settings (key, value, updated_at) VALUES
        ('d1DatabaseId', '${PRODUCTION_MAIN_ID}', datetime('now')),
        ('cfD1DatabaseId', '${PRODUCTION_MAIN_ID}', datetime('now'))
      ON CONFLICT(key) DO UPDATE SET
        value = excluded.value,
        updated_at = datetime('now')
    `);

    const after = wranglerD1(
      "SELECT key, value FROM settings WHERE key IN ('d1DatabaseId', 'cfD1DatabaseId')"
    );
    const afterMap = Object.fromEntries(after.map((r) => [r.key, r.value]));
    console.log('D1 after:', afterMap);

    const pass =
      afterMap.d1DatabaseId === PRODUCTION_MAIN_ID &&
      afterMap.cfD1DatabaseId === PRODUCTION_MAIN_ID;

    appendLog({
      runId: 'heal-prod-v1',
      hypothesisId: 'B,M',
      location: 'heal-d1-settings.mjs:after',
      message: pass ? 'Production D1 heal PASS' : 'Production D1 heal FAIL',
      data: { after: afterMap, pass },
    });

    if (!pass) throw new Error('D1 heal verification failed');
  }

  appendLog({
    runId: 'heal-prod-v1',
    location: 'heal-d1-settings.mjs:d1Ok',
    message: 'D1 settings OK',
    data: { before: beforeMap, pass: true },
  });

  const api = await healViaApi().catch(() => ({ ok: false, status: 'error' }));
  if (api.ok) {
    console.log('✓ API /settings mirror updated (Neon sync if configured)');
  } else {
    console.warn(`⚠ API /settings skipped (HTTP ${api.status})`);
  }

  console.log('\n— Neon settings —');
  const neonHeal = spawnSync(process.execPath, [path.join(__dirname, 'heal-d1-neon-check.mjs')], {
    cwd: root,
    stdio: 'inherit',
  });
  if (neonHeal.status !== 0) {
    throw new Error('Neon heal step failed');
  }

  console.log('\n✓ D1 + Neon heal complete. Reload FusionOps Settings and press Test.');
}

main().catch((err) => {
  console.error('✗', err.message || err);
  process.exit(1);
});
