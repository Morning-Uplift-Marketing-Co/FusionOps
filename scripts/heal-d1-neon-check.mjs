#!/usr/bin/env node
/** Query Neon settings for D1 IDs (uses neonUrl from production D1 — no secrets logged). */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const logPath = path.resolve(root, 'debug-1c6fbd.log');
const LEGACY = '7d31d941-f863-46f5-99c2-2179de821573';
const PRODUCTION = '4eaee76d-10fb-42a7-bb9d-50737c3da785';

function appendLog(entry) {
  fs.appendFileSync(logPath, `${JSON.stringify({ sessionId: '1c6fbd', timestamp: Date.now(), ...entry })}\n`);
}

function wranglerD1(sql) {
  const cmd = `npx wrangler d1 execute fusionops-main-new-v2 --remote --json --command "${sql.replace(/"/g, '\\"')}"`;
  const r = spawnSync(cmd, { cwd: path.join(root, 'apps/api-worker'), encoding: 'utf8', shell: true });
  if (r.status !== 0) throw new Error('wrangler query failed');
  const parsed = JSON.parse(r.stdout);
  return parsed?.[0]?.results ?? [];
}

async function main() {
  const neonRow = wranglerD1("SELECT value FROM settings WHERE key = 'neonUrl' LIMIT 1");
  const neonUrl = neonRow[0]?.value;
  if (!neonUrl || !String(neonUrl).includes('@')) {
    console.log('No neonUrl in D1 — skip Neon check');
    return;
  }

  const sql = neon(String(neonUrl));
  const rows = await sql`SELECT key, value FROM settings WHERE key IN ('d1DatabaseId', 'cfD1DatabaseId')`;
  const map = {};
  for (const row of rows) {
    let v = row.value;
    if (typeof v === 'string') {
      try { v = JSON.parse(v); } catch { /* keep string */ }
    }
    map[row.key] = String(v ?? '').replace(/^"|"$/g, '');
  }

  console.log('Neon before:', { d1DatabaseId: map.d1DatabaseId || '(empty)', cfD1DatabaseId: map.cfD1DatabaseId || '(empty)' });
  appendLog({
    runId: 'neon-check-v1',
    hypothesisId: 'M',
    location: 'heal-d1-neon-check.mjs:before',
    message: 'Neon D1 settings',
    data: { d1DatabaseId: map.d1DatabaseId || '', cfD1DatabaseId: map.cfD1DatabaseId || '' },
  });

  const needsHeal =
    map.cfD1DatabaseId === LEGACY ||
    map.d1DatabaseId === LEGACY ||
    (map.cfD1DatabaseId && map.cfD1DatabaseId !== PRODUCTION) ||
    (map.d1DatabaseId && map.d1DatabaseId !== PRODUCTION);

  if (!needsHeal) {
    console.log('✓ Neon settings already correct');
    appendLog({ runId: 'neon-check-v1', location: 'heal-d1-neon-check.mjs:ok', message: 'Neon OK', data: { pass: true } });
    return;
  }

  for (const key of ['d1DatabaseId', 'cfD1DatabaseId']) {
    await sql`
      INSERT INTO settings (key, value, updated_at)
      VALUES (${key}, ${JSON.stringify(PRODUCTION)}, now())
      ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(PRODUCTION)}, updated_at = now()
    `;
  }

  console.log('✓ Patched Neon d1DatabaseId + cfD1DatabaseId → production main D1');
  appendLog({
    runId: 'neon-check-v1',
    hypothesisId: 'M',
    location: 'heal-d1-neon-check.mjs:patched',
    message: 'Neon heal PASS',
    data: { pass: true, after: PRODUCTION },
  });
}

main().catch((e) => {
  console.error('✗', e.message || e);
  appendLog({ runId: 'neon-check-v1', location: 'heal-d1-neon-check.mjs:error', message: String(e.message || e) });
  process.exit(1);
});
