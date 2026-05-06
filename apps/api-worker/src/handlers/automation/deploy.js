// ============================================================
// Deploy adapter automation for FusionOps API Worker
// ============================================================
// Routes (POST):
//   /api/automation/deploy/vercel     check Vercel project linkage
//   /api/automation/deploy/netlify    check Netlify site linkage
//   /api/automation/deploy/cf-pages   check Cloudflare Pages project
//   /api/automation/deploy/cf-workers check Cloudflare Workers script
//
// Each endpoint validates by calling the platform's API; tokens are
// either passed in body (Vercel/Netlify) or resolved from D1 cf_accounts
// (Cloudflare).
//
// Extracted from worker.js (Phase 2: handler extraction).
// ============================================================

import { json } from '../../lib/http.js';

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

async function handleVercel({ request }) {
  const body = await request.json();
  const { projectName, accessToken, teamId } = body;
  if (!projectName || !accessToken) return json({ error: 'Missing projectName or accessToken' }, 400);

  const apiUrl = teamId
    ? `https://api.vercel.com/v9/projects/${encodeURIComponent(projectName)}?teamId=${teamId}`
    : `https://api.vercel.com/v9/projects/${encodeURIComponent(projectName)}`;

  const res = await fetch(apiUrl, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  return json({
    success: res.ok,
    linked: !!data.id,
    project: data,
  });
}

async function handleNetlify({ request }) {
  const body = await request.json();
  const { siteName, accessToken } = body;
  if (!siteName || !accessToken) return json({ error: 'Missing siteName or accessToken' }, 400);

  const res = await fetch('https://api.netlify.com/api/v1/sites', {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  const site = data.find(s => s.name === siteName || s.id === siteName);
  return json({
    success: true,
    linked: !!site,
    site: site || null,
  });
}

async function handleCfPages({ request, db }) {
  const body = await request.json();
  const { projectName, cfAccountId } = body;
  if (!projectName || !cfAccountId) return json({ error: 'Missing projectName or cfAccountId' }, 400);

  const acctRow = await db.prepare('SELECT api_token, account_id FROM cf_accounts WHERE id = ? OR account_id = ? LIMIT 1')
    .bind(cfAccountId, cfAccountId).first();
  if (!acctRow) return json({ error: 'Cloudflare account not found' }, 404);

  const resolvedAccountId = acctRow.account_id || cfAccountId;

  const res = await fetch(`${CF_API_BASE}/accounts/${resolvedAccountId}/pages/projects/${encodeURIComponent(projectName)}`, {
    headers: { 'Authorization': `Bearer ${acctRow.api_token}`, 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  return json({
    success: data.success || res.status === 404,
    linked: data.success ? !!data.result : false,
    project: data.result || null,
  });
}

async function handleCfWorkers({ request, db }) {
  const body = await request.json();
  const { scriptName, cfAccountId } = body;
  if (!scriptName || !cfAccountId) return json({ error: 'Missing scriptName or cfAccountId' }, 400);

  const acctRow = await db.prepare('SELECT api_token, account_id FROM cf_accounts WHERE id = ? OR account_id = ? LIMIT 1')
    .bind(cfAccountId, cfAccountId).first();
  if (!acctRow) return json({ error: 'Cloudflare account not found' }, 404);

  const resolvedAccountId = acctRow.account_id || cfAccountId;

  const res = await fetch(`${CF_API_BASE}/accounts/${resolvedAccountId}/workers/scripts/${encodeURIComponent(scriptName)}`, {
    headers: { 'Authorization': `Bearer ${acctRow.api_token}`, 'Content-Type': 'application/json' },
  });
  return json({
    success: res.ok,
    linked: res.ok,
    script: res.ok ? { name: scriptName } : null,
  });
}

/**
 * Route entry. Returns Response if path matches `/api/automation/deploy/*`; null otherwise.
 */
export async function handleDeployAutomationRoute({ request, db, path, method }) {
  if (method !== 'POST') return null;
  if (path === '/api/automation/deploy/vercel') return handleVercel({ request });
  if (path === '/api/automation/deploy/netlify') return handleNetlify({ request });
  if (path === '/api/automation/deploy/cf-pages') return handleCfPages({ request, db });
  if (path === '/api/automation/deploy/cf-workers') return handleCfWorkers({ request, db });
  return null;
}
