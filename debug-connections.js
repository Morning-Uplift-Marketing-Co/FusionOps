#!/usr/bin/env node
/**
 * FusionOps Connection Debug Script
 * ตรวจสอบว่าทุกอย่างเชื่อมต่อกันถูกต้องหรือไม่
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { neon } from '@neondatabase/serverless';

// Load .env.local file
function loadEnvFile() {
  try {
    const envPath = resolve('.env.local');
    const envContent = readFileSync(envPath, 'utf-8');

    for (const line of envContent.split('\n')) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=').trim();
        if (key && value) {
          process.env[key] = value;
        }
      }
    }
    console.log('✅ Loaded .env.local\n');
  } catch (e) {
    console.log('⚠️  Could not load .env.local:', e.message, '\n');
  }
}

loadEnvFile();

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(type, message) {
  const icons = {
    ok: '✅',
    error: '❌',
    warn: '⚠️',
    info: 'ℹ️',
    section: '📋',
  };
  console.log(`${icons[type]} ${message}`);
}

function section(title) {
  console.log(`\n${colors.cyan}${'═'.repeat(50)}${colors.reset}`);
  console.log(`${colors.cyan}  ${title}${colors.reset}`);
  console.log(`${colors.cyan}${'═'.repeat(50)}${colors.reset}\n`);
}

// ═══════════════════════════════════════════════════════════════
// CHECK 1: Environment Variables
// ═══════════════════════════════════════════════════════════════
section('CHECK 1: Environment Variables');

const envVars = {
  'VITE_API_BASE': process.env.VITE_API_BASE,
  'NEON_DATABASE_URL': process.env.NEON_DATABASE_URL,
};

let envScore = 0;
let envTotal = Object.keys(envVars).length;

for (const [key, value] of Object.entries(envVars)) {
  if (value && value !== '' && !value.includes('***')) {
    log('ok', `${key} = ${value}`);
    envScore++;
  } else if (value && value.includes('***')) {
    log('warn', `${key} = *** (ถูก mask, ดูได้ใน .env.local)`);
    envScore++;
  } else {
    log('error', `${key} = ไม่ได้ตั้งค่า`);
  }
}

console.log(`\nEnvironment: ${envScore}/${envTotal} passed`);

// ═══════════════════════════════════════════════════════════════
// CHECK 2: Neon Database Connection
// ═══════════════════════════════════════════════════════════════
section('CHECK 2: Neon Database Connection');

const neonUrl = process.env.NEON_DATABASE_URL;
let neonOk = false;

if (neonUrl && !neonUrl.includes('***')) {
  try {
    const sql = neon(neonUrl);
    const result = await sql`SELECT 1 as ok`;

    if (result && result[0]?.ok === 1) {
      log('ok', 'Neon database connected');

      // Check tables
      const tables = await sql`
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        ORDER BY table_name
      `;

      console.log('\n  Tables found:');
      tables.forEach(t => {
        console.log(`    • ${t.table_name}`);
      });

      neonOk = true;
    } else {
      log('error', 'Neon query failed');
    }
  } catch (e) {
    log('error', `Neon connection failed: ${e.message}`);
  }
} else {
  log('warn', 'NEON_DATABASE_URL not set or masked');
}

// ═══════════════════════════════════════════════════════════════
// CHECK 3: API Worker Endpoint
// ═══════════════════════════════════════════════════════════════
section('CHECK 3: API Worker Endpoint');

const apiBase = process.env.VITE_API_BASE || 'https://lp-factory-api.misty-feather-556e.workers.dev/api';

async function checkApi() {
  try {
    // Try /settings endpoint since /health doesn't exist
    const response = await fetch(`${apiBase}/settings`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const data = await response.json();
      log('ok', `API Worker responding! Settings keys: ${Object.keys(data).join(', ')}`);
      return true;
    } else {
      log('warn', `API returned status: ${response.status}`);
      return false;
    }
  } catch (e) {
    log('error', `API connection failed: ${e.message}`);
    return false;
  }
}

const apiOk = await checkApi();

// ═══════════════════════════════════════════════════════════════
// CHECK 4: D1 Databases (via Wrangler)
// ═══════════════════════════════════════════════════════════════
section('CHECK 4: Cloudflare D1 Databases');

const { execSync } = await import('child_process');

function runWrangler(cmd) {
  try {
    const output = execSync(cmd, { encoding: 'utf-8' });
    return { ok: true, output };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

const d1List = runWrangler('wrangler d1 list --json');
let d1Ok = false;

if (d1List.ok) {
  try {
    const databases = JSON.parse(d1List.output);
    console.log('\n  D1 Databases:');
    databases.forEach(db => {
      console.log(`    • ${db.name} (${db.database_id})`);
    });

    // Check if our databases exist
    const requiredDbs = [
      'fusionops-main-new-v2',
      'fusionops-pixel-new-v2',
      'fusionops-callback-new-v2',
    ];

    console.log('\n  Required databases:');
    for (const name of requiredDbs) {
      const exists = databases.some(db => db.name === name);
      if (exists) {
        log('ok', `  ${name} - found`);
      } else {
        log('error', `  ${name} - NOT FOUND`);
      }
    }

    d1Ok = requiredDbs.every(name => databases.some(db => db.name === name));
  } catch (e) {
    log('error', `Failed to parse D1 list: ${e.message}`);
  }
} else {
  log('error', 'Failed to list D1 databases - wrangler not configured?');
}

// ═══════════════════════════════════════════════════════════════
// CHECK 5: Workers
// ═══════════════════════════════════════════════════════════════
section('CHECK 5: Cloudflare Workers');

// Test each worker directly by trying to fetch them
const workers = [
  { name: 'lp-factory-api', url: 'https://lp-factory-api.misty-feather-556e.workers.dev' },
  { name: 'lp-factory-pixel', url: 'https://lp-factory-pixel.misty-feather-556e.workers.dev' },
  { name: 'fusionops-callback-worker', url: null }, // No direct URL to test
];

let workersOk = true;

for (const worker of workers) {
  if (worker.url) {
    try {
      const res = await fetch(worker.url);
      if (res.ok || res.status === 404) {
        // 404 is ok - means worker exists, just no route for root
        log('ok', `${worker.name} - deployed and responding`);
      } else {
        log('warn', `${worker.name} - status ${res.status}`);
      }
    } catch (e) {
      log('error', `${worker.name} - not accessible: ${e.message}`);
      workersOk = false;
    }
  } else {
    // For callback worker, just mark as checked
    log('info', `${worker.name} - skip (no direct URL)`);
  }
}

// ═══════════════════════════════════════════════════════════════
// CHECK 6: Frontend Configuration
// ═══════════════════════════════════════════════════════════════
section('CHECK 6: Frontend Configuration');

const apiServicePath = resolve('src/services/api.js');
try {
  const apiService = readFileSync(apiServicePath, 'utf-8');

  // Extract default API base
  const match = apiService.match(/PROD_API_BASE\s*=\s*["']([^"']+)["']/);
  if (match) {
    log('ok', `Default API Base: ${match[1]}`);

    if (match[1] === apiBase) {
      log('ok', 'API Base matches environment');
    } else {
      log('warn', `API Base mismatch! Code=${match[1]}, Env=${apiBase}`);
    }
  }
} catch (e) {
  log('error', `Failed to read api.js: ${e.message}`);
}

// ═══════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════
section('SUMMARY');

const results = [
  { name: 'Environment Variables', pass: envScore === envTotal },
  { name: 'Neon Database', pass: neonOk },
  { name: 'API Worker', pass: apiOk },
  { name: 'D1 Databases', pass: d1Ok },
  { name: 'Workers', pass: workersOk },
];

let passCount = 0;
results.forEach(r => {
  if (r.pass) {
    log('ok', r.name);
    passCount++;
  } else {
    log('error', r.name);
  }
});

console.log(`\n${colors.cyan}${'═'.repeat(50)}${colors.reset}`);
console.log(`  ${colors.cyan}Overall: ${passCount}/${results.length} checks passed${colors.reset}`);
console.log(`${colors.cyan}${'═'.repeat(50)}${colors.reset}\n`);

if (passCount === results.length) {
  console.log(`${colors.green}✅ All systems connected correctly!${colors.reset}`);
  process.exit(0);
} else {
  console.log(`${colors.red}❌ Some connections failed. See details above.${colors.reset}`);
  process.exit(1);
}
