#!/usr/bin/env node
/**
 * ============================================================
 * FusionOps - Full Deployment Script
 * ============================================================
 * Builds and deploys all components to Cloudflare
 *
 * Usage:
 *   node scripts/deploy-all.js
 *   node scripts/deploy-all.js --workers-only
 *   node scripts/deploy-all.js --web-only
 * ============================================================
 */

import { execSync } from 'child_process';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '..');

// ============================================================
// Configuration
// ============================================================

const CONFIG = {
  workers: ['api-worker', 'cf-proxy', 'pixel-worker', 'worker'],
  apps: {
    web: {
      name: 'lander',
      buildCmd: 'npm run build',
      distDir: 'dist'
    }
  }
};

// ============================================================
// Utilities
// ============================================================

const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}[WARNING]${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`),
  step: (msg) => {
    console.log('');
    console.log(`${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.cyan}  ${msg}${colors.reset}`);
    console.log(`${colors.blue}═══════════════════════════════════════════════════════${colors.reset}`);
    console.log('');
  }
};

function exec(command, options = {}) {
  const opts = {
    cwd: rootDir,
    stdio: 'inherit',
    ...options
  };
  try {
    execSync(command, opts);
    return true;
  } catch (err) {
    return false;
  }
}

function execQuiet(command) {
  try {
    return execSync(command, { cwd: rootDir, stdio: 'pipe' }).toString().trim();
  } catch (err) {
    return null;
  }
}

// ============================================================
// Pre-flight Checks
// ============================================================

function preflightCheck() {
  log.step('Pre-flight Checks');

  // Check Node.js
  const nodeVersion = process.version;
  log.success(`Node.js: ${nodeVersion}`);

  // Check npm
  const npmVersion = execQuiet('npm -v');
  log.success(`npm: ${npmVersion}`);

  // Check Wrangler
  const wranglerVersion = execQuiet('wrangler --version');
  if (wranglerVersion) {
    log.success(`Wrangler: ${wranglerVersion}`);
  } else {
    log.warning('Wrangler not found. Installing...');
    exec('npm install -g wrangler');
    log.success('Wrangler installed');
  }

  // Check Cloudflare auth
  try {
    execQuiet('wrangler whoami');
    log.success('Cloudflare: Authenticated');
  } catch (err) {
    log.error('Not logged in to Cloudflare. Run: wrangler login');
    throw new Error('Cloudflare authentication required');
  }

  // Check dependencies
  log.info('Checking dependencies...');
  if (!existsSync(join(rootDir, 'node_modules'))) {
    log.info('Installing root dependencies...');
    exec('npm install');
  }
  log.success('Dependencies OK');

  log.success('Pre-flight checks complete!');
}

// ============================================================
// Build Web App
// ============================================================

function buildWebApp() {
  log.step('Building Web Application');

  const appDir = join(rootDir, 'apps', CONFIG.apps.web.name);

  // Install app dependencies
  log.info('Installing dependencies...');
  exec('npm install', { cwd: appDir });

  // Build
  log.info('Building application...');
  const success = exec('npm run build', { cwd: appDir });

  if (!success) {
    log.error('Build failed');
    throw new Error('Build failed');
  }

  // Check dist directory
  const distDir = join(appDir, CONFIG.apps.web.distDir);
  if (!existsSync(distDir)) {
    log.error(`Dist directory not found: ${distDir}`);
    throw new Error('Dist directory missing');
  }

  log.success('Web application built successfully');
}

// ============================================================
// Deploy Workers
// ============================================================

function deployWorkers() {
  log.step('Deploying Cloudflare Workers');

  const results = [];

  for (const workerName of CONFIG.workers) {
    const workerDir = join(rootDir, 'apps', workerName);

    if (!existsSync(workerDir)) {
      log.warning(`Worker not found: ${workerName}`);
      continue;
    }

    log.info(`Deploying ${workerName}...`);

    // Install dependencies if package.json exists
    const packageJson = join(workerDir, 'package.json');
    if (existsSync(packageJson)) {
      log.info('  Installing dependencies...');
      exec('npm install --silent', { cwd: workerDir, stdio: 'pipe' });
    }

    // Deploy
    log.info(`  Running: npx -y wrangler@latest deploy`);
    const success = exec('npx -y wrangler@latest deploy', { cwd: workerDir, stdio: 'inherit' });

    if (success) {
      log.success(`✓ ${workerName} deployed`);
      results.push({ worker: workerName, status: 'success' });
    } else {
      log.error(`✗ ${workerName} failed`);
      results.push({ worker: workerName, status: 'failed' });
    }
  }

  const failed = results.filter(r => r.status === 'failed');
  if (failed.length > 0) {
    log.warning(`${failed.length} worker(s) failed to deploy`);
  } else {
    log.success('All workers deployed successfully');
  }

  return results;
}

// ============================================================
// Deploy Web to Cloudflare Pages
// ============================================================

function deployWebToCloudflare() {
  log.step('Deploying Web to Cloudflare Pages');

  const appDir = join(rootDir, 'apps', CONFIG.apps.web.name);
  const projectName = 'fusionops-web';

  // Using wrangler pages deploy
  const distDir = join(appDir, CONFIG.apps.web.distDir);

  log.info(`Deploying ${distDir} to Cloudflare Pages...`);

  const success = exec(`npx wrangler pages deploy "${distDir}" --project-name=${projectName}`, {
    cwd: rootDir,
    stdio: 'inherit'
  });

  if (success) {
    log.success(`Web deployed to: https://${projectName}.pages.dev`);
  } else {
    log.error('Web deployment failed');
  }

  return success;
}

// ============================================================
// Get Deployment URLs
// ============================================================

function getDeploymentUrls() {
  log.step('Deployment URLs');

  const urls = [];

  // Get worker URLs
  for (const workerName of CONFIG.workers) {
    const workerDir = join(rootDir, 'apps', workerName);
    const tomlPath = join(workerDir, 'wrangler.toml');

    if (existsSync(tomlPath)) {
      const toml = readFileSync(tomlPath, 'utf-8');
      const match = toml.match(/name\s*=\s*"([^"]+)"/);
      if (match) {
        urls.push({
          name: workerName,
          url: `https://${match[1]}.${workerName.includes('api') || workerName.includes('callback') ? 'workers' : 'workers'}.dev`
        });
      }
    }
  }

  console.log('');
  console.log('Worker URLs:');
  urls.forEach(u => console.log(`  ${u.name}: ${u.url}`));
  console.log('');
  console.log('Web App:');
  console.log(`  fusionops-web: https://fusionops-web.pages.dev`);
  console.log('');
}

// ============================================================
// Summary
// ============================================================

function printSummary(results) {
  log.step('Deployment Complete!');

  const successCount = results.filter(r => r.status === 'success').length;
  const failCount = results.filter(r => r.status === 'failed').length;

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║              Deployment Summary 📊                         ║
╠═══════════════════════════════════════════════════════════╣
║  Workers Deployed:     ${successCount.toString().padStart(20)} ║
║  Workers Failed:       ${failCount.toString().padStart(20)} ║
╚═══════════════════════════════════════════════════════════╝

Next steps:
1. Visit your deployed URLs above
2. Test the application
3. Set up custom domains
4. Configure monitoring

For troubleshooting, check Cloudflare Dashboard:
https://dash.cloudflare.com
`);
}

// ============================================================
// Main Deployment Flow
// ============================================================

async function fullDeploy() {
  log.step('FusionOps Deployment');

  preflightCheck();
  buildWebApp();
  const workerResults = deployWorkers();
  deployWebToCloudflare();
  getDeploymentUrls();
  printSummary(workerResults);
}

// ============================================================
// CLI Interface
// ============================================================

async function main() {
  const arg = process.argv[2];

  try {
    switch (arg) {
      case '--workers-only':
        preflightCheck();
        const workerResults = deployWorkers();
        getDeploymentUrls();
        printSummary(workerResults);
        break;

      case '--web-only':
        preflightCheck();
        buildWebApp();
        deployWebToCloudflare();
        break;

      case '--build-only':
        preflightCheck();
        buildWebApp();
        log.success('Build complete');
        break;

      case '--help':
      case '-h':
        console.log(`
FusionOps Deployment Script

Usage: node scripts/deploy-all.js [OPTION]

Options:
  --workers-only    Deploy only Cloudflare Workers
  --web-only        Deploy only web application
  --build-only      Build without deploying
  --help, -h        Show this help message

Without options, runs full deployment (workers + web).
`);
        break;

      default:
        await fullDeploy();
    }
  } catch (err) {
    log.error(`Deployment failed: ${err.message}`);
    process.exit(1);
  }
}

main();
