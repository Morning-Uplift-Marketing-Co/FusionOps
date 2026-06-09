#!/usr/bin/env node
/** Run all D1 heal verification scripts (unit + browser boot heal). */
import { spawn, spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const BASE = process.env.BASE_URL || 'http://localhost:4321';

async function isServerUp() {
  try {
    const r = await fetch(`${BASE}/`, { signal: AbortSignal.timeout(3000) });
    return r.status === 200;
  } catch {
    return false;
  }
}

async function waitForServer(maxMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    if (await isServerUp()) return true;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

async function main() {
  let devProc = null;
  let startedDev = false;

  if (!(await isServerUp())) {
    console.log(`Dev server not up at ${BASE} — starting npm run dev…`);
    devProc = spawn('npm run dev', {
      cwd: root,
      stdio: 'ignore',
      shell: true,
      env: process.env,
    });
    startedDev = true;
    const ready = await waitForServer();
    if (!ready) {
      console.error(`✗ Dev server did not become ready at ${BASE} within 90s`);
      devProc?.kill();
      process.exit(1);
    }
    console.log('Dev server ready.');
  }

  const steps = [
    ['verify-d1-heal.mjs', 'Unit/worker heal logic'],
    ['debug-d1-ui-verify.mjs', 'Browser boot heal'],
  ];

  let failed = false;
  for (const [script, label] of steps) {
    console.log(`\n— ${label} (${script}) —`);
    const r = spawnSync(process.execPath, [path.join(__dirname, script)], {
      cwd: root,
      stdio: 'inherit',
      env: { ...process.env, BASE_URL: BASE },
    });
    if (r.status !== 0) failed = true;
  }

  if (startedDev && devProc) {
    devProc.kill();
  }

  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
