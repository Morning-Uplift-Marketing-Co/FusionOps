/**
 * Push local files to GitHub via Contents API (no git push needed)
 * Usage: node scripts/push-to-github.mjs
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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
      env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
    }
    return env;
  } catch { return {}; }
}

const env = loadEnv();
const token = env.VITE_GITHUB_TOKEN || env.GITHUB_TOKEN || env.GH_TOKEN || '';
if (!token) {
  console.error('No GitHub token found. Add GITHUB_TOKEN=... to .env');
  process.exit(1);
}

const repo = 'Morning-Uplift-Marketing-Co/FusionOps';
const branch = 'main';
const headers = {
  Authorization: `Bearer ${token}`,
  Accept: 'application/vnd.github+json',
  'Content-Type': 'application/json',
  'X-GitHub-Api-Version': '2022-11-28',
};

async function pushFile(filePath, localPath, message) {
  const content = readFileSync(path.join(root, localPath), 'utf8');
  const url = `https://api.github.com/repos/${repo}/contents/${filePath}`;

  // Get existing SHA if file exists
  let sha;
  const existing = await fetch(`${url}?ref=${branch}`, { headers });
  if (existing.ok) {
    sha = (await existing.json()).sha;
  }

  const body = {
    message,
    content: Buffer.from(content).toString('base64'),
    branch,
    ...(sha ? { sha } : {}),
  };

  const res = await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) {
    console.error(`❌ ${filePath}: ${res.status} ${data.message}`);
  } else {
    console.log(`✅ ${filePath}: ${data.commit?.sha?.slice(0, 7)}`);
  }
}

console.log(`Pushing to ${repo}@${branch}...`);

await pushFile(
  '.github/workflows/deploy-lp.yml',
  '.github/workflows/deploy-lp.yml',
  'fix: use shell fallback for CF credentials (multi-account support)'
);

await pushFile(
  'templates/installment-bear/tsconfig.json',
  'templates/installment-bear/tsconfig.json',
  'fix: add tsconfig.json to installment-bear'
);

console.log('Done. Now redeploy scratchvetloans from UI to trigger workflow.');
