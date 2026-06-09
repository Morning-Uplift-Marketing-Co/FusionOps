#!/usr/bin/env node
/**
 * Verification harness — writes NDJSON runtime evidence to debug-1c6fbd.log
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logPath = path.resolve(__dirname, '../debug-1c6fbd.log');
const legacyId = '7d31d941-f863-46f5-99c2-2179de821573';
const productionId = '4eaee76d-10fb-42a7-bb9d-50737c3da785';

function appendLog(entry) {
  fs.appendFileSync(logPath, `${JSON.stringify({ sessionId: '1c6fbd', ...entry, timestamp: Date.now() })}\n`);
}

const workerHeal = await import(
  pathToFileURL(path.resolve(__dirname, '../apps/api-worker/src/lib/d1-settings-heal.js')).href
);

const staleNeon = {
  d1DatabaseId: legacyId,
  cfD1DatabaseId: legacyId,
};

appendLog({
  runId: 'verify-v4',
  hypothesisId: 'A,B,D,H',
  location: 'scripts/verify-d1-heal.mjs:entry',
  message: 'Stale Neon settings snapshot',
  data: { before: staleNeon },
});

const workerCopy = { ...staleNeon };
const workerChanged = workerHeal.healD1SettingsInPlace(workerCopy);
const workerPass =
  workerChanged &&
  workerCopy.d1DatabaseId === productionId &&
  workerCopy.cfD1DatabaseId === productionId;

appendLog({
  runId: 'verify-v4',
  hypothesisId: 'H',
  location: 'scripts/verify-d1-heal.mjs:worker:after',
  message: 'Worker heal result',
  data: {
    changed: workerChanged,
    after: { d1: workerCopy.d1DatabaseId, cf: workerCopy.cfD1DatabaseId },
    pass: workerPass,
  },
});

const resolved = workerHeal.resolveD1DatabaseIds(staleNeon);
const resolvePass =
  resolved.d1DatabaseId === productionId && resolved.cfD1DatabaseId === productionId;

appendLog({
  runId: 'verify-v4',
  hypothesisId: 'A,B',
  location: 'scripts/verify-d1-heal.mjs:resolve',
  message: 'resolveD1DatabaseIds on stale snapshot',
  data: { resolved, pass: resolvePass },
});

const pass = workerPass && resolvePass;
console.log(pass ? '✓ verify-d1-heal PASS' : '✗ verify-d1-heal FAIL');
console.log('Log written:', logPath);
process.exit(pass ? 0 : 1);
