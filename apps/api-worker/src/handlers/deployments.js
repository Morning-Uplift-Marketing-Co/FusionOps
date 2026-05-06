// ============================================================
// Ops deployments handler for FusionOps API Worker
// ============================================================
// Routes:
//   GET   /api/ops/deployments              List with domain/status/target filters
//   POST  /api/ops/deployments              Insert new deployment row + log
//   POST  /api/ops/deployments/git-push     Stage files into deploy/auto branch + dispatch CI workflow
//   PATCH /api/ops/deployments/:id          Patch status/url/error/duration
//   GET   /api/ops/deployments/stats        Aggregate (success/fail/avg duration/last 24h)
//   GET   /api/ops/deploy-configs           List per-domain deploy configs
//   POST  /api/ops/deploy-configs           Upsert per-domain target config
//
// git-push details:
//   - Reads token/repo settings from D1 (githubToken / githubRepoOwner / etc.)
//   - Stages files under sites/{siteId}/* on deploy/auto branch
//   - Writes deploy-manifest.json + the JSON Schema
//   - Dispatches GitHub Actions workflow (deploy-sites.yml by default)
//
// Extracted from worker.js (Phase 2: handler extraction).
// ============================================================

import { json, uid } from '../lib/http.js';
import { snakeToCamel, isMaskedSecret } from '../lib/case-utils.js';
import { ensureGithubBranch, upsertGithubFile, githubApi } from '../lib/github.js';

const DEPLOY_MANIFEST_SCHEMA = {
  '$schema': 'http://json-schema.org/draft-07/schema#',
  '$id': 'https://lp-factory.dev/schemas/deploy-manifest.schema.json',
  'title': 'DeployManifest',
  'type': 'object',
  'additionalProperties': false,
  'required': ['version', 'siteId', 'brand', 'templateId', 'environment', 'targets', 'build', 'tracking', 'meta'],
  'properties': {
    'version': { 'type': 'integer', 'minimum': 1 },
    'siteId': { 'type': 'string', 'minLength': 1 },
    'brand': { 'type': 'string' },
    'templateId': { 'type': 'string', 'minLength': 1 },
    'environment': { 'type': 'string', 'enum': ['dev', 'staging', 'production'] },
    'targets': {
      'type': 'array', 'minItems': 1,
      'items': {
        'type': 'object', 'additionalProperties': false, 'required': ['provider'],
        'properties': {
          'provider': { 'type': 'string', 'enum': ['github-actions', 'cloudflare-pages', 'netlify', 'vercel'] },
          'projectName': { 'type': 'string' },
          'siteId': { 'type': 'string' },
          'vercelProjectId': { 'type': 'string' },
          'customDomain': { 'type': 'string' },
          'branch': { 'type': 'string' },
        },
      },
    },
    'build': {
      'type': 'object', 'additionalProperties': false, 'required': ['entry', 'extraFiles'],
      'properties': {
        'entry': { 'type': 'string', 'enum': ['index.html', 'astro'] },
        'extraFiles': { 'type': 'array', 'items': { 'type': 'string' } },
      },
    },
    'tracking': {
      'type': 'object', 'additionalProperties': false, 'required': ['googleAdsId', 'pixelEndpoint', 'voluumDomain'],
      'properties': {
        'googleAdsId': { 'type': 'string' },
        'pixelEndpoint': { 'type': 'string' },
        'voluumDomain': { 'type': 'string' },
      },
    },
    'meta': {
      'type': 'object', 'additionalProperties': false, 'required': ['requestedBy', 'requestedAt', 'requestId', 'commitMessage'],
      'properties': {
        'requestedBy': { 'type': 'string' },
        'requestedAt': { 'type': 'string' },
        'requestId': { 'type': 'string' },
        'commitMessage': { 'type': 'string' },
        'deployRecordId': { 'type': 'string' },
      },
    },
  },
};

async function handleDeploymentsList({ db, url }) {
  const domain = url.searchParams.get('domain') || '';
  const status = url.searchParams.get('status') || '';
  const target = url.searchParams.get('target') || '';
  const limitRaw = url.searchParams.get('limit');
  const limit = Number.parseInt(limitRaw || '50', 10);
  let query = 'SELECT * FROM ops_deployments';
  const conditions = [];
  const params = [];

  if (domain) { conditions.push('domain = ?'); params.push(domain); }
  if (status) { conditions.push('status = ?'); params.push(status); }
  if (target) { conditions.push('target = ?'); params.push(target); }

  if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
  query += ' ORDER BY created_at DESC LIMIT ' + (Number.isFinite(limit) && limit > 0 ? limit : 50);

  try {
    const stmt = db.prepare(query);
    const { results } = await stmt.bind(...params).all();
    return json((results || []).map(snakeToCamel));
  } catch (e) {
    const msg = String(e?.message || e || '');
    if (msg.includes('no such table: ops_deployments')) return json([]);
    throw e;
  }
}

async function handleDeploymentsCreate({ request, db }) {
  const body = await request.json();
  const id = body.id || uid();
  const now = new Date().toISOString();

  try {
    await db.prepare(`
      INSERT INTO ops_deployments (id, domain_id, domain, target, environment, url, status, config, deployed_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id,
      body.domainId || '',
      body.domain || '',
      body.target || '',
      body.environment || 'production',
      body.url || '',
      body.status || 'pending',
      JSON.stringify(body.config || {}),
      body.deployedBy || '',
      now,
      now
    ).run();

    await db.prepare('INSERT INTO ops_logs (id, msg) VALUES (?, ?)')
      .bind(uid(), `Deployment started: ${body.domain} to ${body.target}`).run();

    return json({ id, success: true }, 201);
  } catch (e) {
    const msg = String(e?.message || e || '');
    if (msg.includes('no such table: ops_deployments')) {
      return json({ id: null, success: false, skipped: true, error: 'ops_deployments table not found' });
    }
    throw e;
  }
}

async function handleDeploymentsGitPush({ request, db }) {
  const body = await request.json();
  const siteId = body.siteId || body.domainId || uid();
  const deployRecordId = body.deployRecordId || '';
  const branch = body.branch || 'main';
  const environment = body.environment || 'production';
  const files = body.files && typeof body.files === 'object' ? body.files : null;
  if (!files) {
    return json({ success: false, error: 'Missing files payload' }, 400);
  }

  const hasIndexHtml = !!files['index.html'];
  const isAstroProject =
    (!!files['package.json'] && (!!files['astro.config.mjs'] || !!files['astro.config.ts']))
    || !!files['src/pages/index.astro'];

  if (!hasIndexHtml && !isAstroProject) {
    return json({
      success: false,
      error: 'Unsupported payload: provide index.html or an Astro project (package.json + astro.config.* or src/pages/index.astro)',
    }, 400);
  }

  const settingsRows = await db.prepare("SELECT key, value FROM settings WHERE key IN ('githubToken','githubRepoOwner','githubRepoName','githubRepoBranch','githubDeployWorkflow')").all();
  const settingsObj = {};
  (settingsRows?.results || []).forEach(r => { settingsObj[r.key] = r.value; });

  const requestToken = String(body.githubToken || '').trim();
  const token = String(
    (requestToken && !isMaskedSecret(requestToken))
      ? requestToken
      : (settingsObj.githubToken || '')
  ).trim();
  const repoOwner = String(body.repoOwner || settingsObj.githubRepoOwner || '').trim();
  const repoName = String(body.repoName || settingsObj.githubRepoName || '').trim();
  const sourceBranch = String(branch || settingsObj.githubRepoBranch || 'main').trim() || 'main';
  const deployBranch = 'deploy/auto';

  if (!token || !repoOwner || !repoName) {
    return json({
      success: false,
      error: 'GitHub pipeline not configured. Set githubToken/githubRepoOwner/githubRepoName in Settings.',
    }, 400);
  }

  const safeSiteFolder = String(siteId).replace(/[^a-zA-Z0-9_-]/g, '-');
  const basePath = `sites/${safeSiteFolder}`;
  const manifest = {
    version: 1,
    siteId,
    brand: body.brand || '',
    templateId: body.templateId || 'classic',
    environment,
    targets: Array.isArray(body.targets) && body.targets.length ? body.targets : [{ provider: 'github-actions' }],
    build: hasIndexHtml
      ? { entry: 'index.html', extraFiles: Object.keys(files).filter(name => name !== 'index.html') }
      : { entry: 'astro', extraFiles: Object.keys(files) },
    tracking: {
      googleAdsId: body.tracking?.googleAdsId || '',
      pixelEndpoint: body.tracking?.pixelEndpoint || '',
      voluumDomain: body.tracking?.voluumDomain || '',
    },
    meta: {
      requestedBy: body.requestedBy || 'unknown',
      requestedAt: new Date().toISOString(),
      requestId: body.requestId || uid(),
      commitMessage: body.commitMessage || `deploy(${siteId}): ${body.brand || body.domain || siteId}`,
      deployRecordId,
    },
  };

  const commitMessage = manifest.meta.commitMessage;
  const writeEntries = Object.entries(files).map(([name, content]) => {
    const cleanName = String(name || '').replace(/^\/+/, '');
    return [`${basePath}/${cleanName}`, String(content ?? '')];
  });
  writeEntries.push([`${basePath}/deploy-manifest.json`, JSON.stringify(manifest, null, 2)]);

  try {
    await ensureGithubBranch(token, repoOwner, repoName, deployBranch, sourceBranch);

    writeEntries.push(['schemas/deploy-manifest.schema.json', JSON.stringify(DEPLOY_MANIFEST_SCHEMA, null, 2)]);

    for (const [filePath, content] of writeEntries) {
      await upsertGithubFile({
        token,
        owner: repoOwner,
        repo: repoName,
        branch: deployBranch,
        filePath,
        content,
        message: commitMessage,
      });
    }

    const commitInfo = await githubApi(token, `/repos/${repoOwner}/${repoName}/commits/${encodeURIComponent(deployBranch)}`);
    const commitSha = commitInfo?.sha || '';
    const commitUrl = commitInfo?.html_url || `https://github.com/${repoOwner}/${repoName}/commit/${commitSha}`;
    const workflowFile = String(body.workflowFile || settingsObj.githubDeployWorkflow || 'deploy-sites.yml').trim() || 'deploy-sites.yml';
    const workflowUrl = `https://github.com/${repoOwner}/${repoName}/actions/workflows/${workflowFile}`;
    let workflowDispatched = false;
    let workflowDispatchError = '';

    try {
      await githubApi(token, `/repos/${repoOwner}/${repoName}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`, {
        method: 'POST',
        body: JSON.stringify({
          ref: deployBranch,
          inputs: {
            site_id: String(siteId),
            environment: String(environment),
            deploy_record_id: String(deployRecordId || ''),
          },
        }),
      });
      workflowDispatched = true;
    } catch (dispatchError) {
      workflowDispatchError = String(dispatchError?.message || dispatchError || '');
    }

    return json({
      success: true,
      queued: true,
      deployId: `git-${siteId}-${Date.now()}`,
      branch: deployBranch,
      commitSha,
      commitUrl,
      workflowUrl,
      workflowDispatched,
      workflowDispatchError,
      url: workflowUrl,
      message: 'Artifacts committed to GitHub. CI pipeline should deploy shortly.',
    });
  } catch (e) {
    return json({
      success: false,
      error: `Git push failed: ${e?.message || e}`,
    }, 500);
  }
}

async function handleDeploymentsPatch({ request, db, path }) {
  const id = path.split('/').pop();
  const body = await request.json();
  const sets = [];
  const vals = [];

  if (body.status !== undefined) { sets.push('status = ?'); vals.push(body.status); }
  if (body.url !== undefined) { sets.push('url = ?'); vals.push(body.url); }
  if (body.errorMessage !== undefined) { sets.push('error_message = ?'); vals.push(body.errorMessage); }
  if (body.durationMs !== undefined) { sets.push('duration_ms = ?'); vals.push(body.durationMs); }

  if (sets.length > 0) {
    sets.push('updated_at = ?');
    vals.push(new Date().toISOString());
    vals.push(id);
    await db.prepare(`UPDATE ops_deployments SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
  }

  return json({ success: true });
}

async function handleDeploymentsStats({ db, url }) {
  const domain = url.searchParams.get('domain') || '';
  const params = [];
  const baseConditions = [];
  if (domain) {
    baseConditions.push('domain = ?');
    params.push(domain);
  }
  const whereWith = (extra) => {
    const conditions = [...baseConditions];
    if (extra) conditions.push(extra);
    return conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  };

  try {
    const totalStmt = db.prepare(`SELECT COUNT(*) as count FROM ops_deployments ${whereWith('')}`);
    const successStmt = db.prepare(`SELECT COUNT(*) as count FROM ops_deployments ${whereWith("status = 'success'")}`);
    const failedStmt = db.prepare(`SELECT COUNT(*) as count FROM ops_deployments ${whereWith("status = 'failed'")}`);
    const avgDurationStmt = db.prepare(`SELECT AVG(duration_ms) as avg FROM ops_deployments ${whereWith("status = 'success' AND duration_ms > 0")}`);
    const last24hStmt = db.prepare(`SELECT COUNT(*) as count FROM ops_deployments ${whereWith("created_at >= datetime('now', '-24 hours')")}`);

    const [total, success, failed, avgDuration, last24h] = await Promise.all([
      totalStmt.bind(...params).first(),
      successStmt.bind(...params).first(),
      failedStmt.bind(...params).first(),
      avgDurationStmt.bind(...params).first(),
      last24hStmt.bind(...params).first(),
    ]);

    const totalCount = total?.count || 0;
    const successCount = success?.count || 0;
    const failedCount = failed?.count || 0;

    return json({
      total: totalCount,
      success: successCount,
      failed: failedCount,
      successRate: totalCount > 0 ? Math.round((successCount / totalCount) * 100) : 0,
      avgDurationMs: Math.round(avgDuration?.avg || 0),
      last24h: last24h?.count || 0,
    });
  } catch (e) {
    const msg = String(e?.message || e || '');
    if (msg.includes('no such table: ops_deployments')) {
      return json({ total: 0, success: 0, failed: 0, successRate: 0, avgDurationMs: 0, last24h: 0 });
    }
    throw e;
  }
}

async function handleDeployConfigsGet({ db, url }) {
  const domainId = url.searchParams.get('domainId');
  if (!domainId) return json({ error: 'Missing domainId' }, 400);

  let rows = [];
  try {
    const r = await db.prepare('SELECT * FROM ops_deploy_configs WHERE domain_id = ?').bind(domainId).all();
    rows = r?.results || [];
  } catch (e) {
    const msg = String(e?.message || e || '');
    if (!msg.includes('no such table: ops_deploy_configs')) throw e;
  }

  const configs = {};
  rows.forEach(r => {
    configs[r.target_key] = JSON.parse(r.config || '{}');
  });

  return json(configs);
}

async function handleDeployConfigsPost({ request, db }) {
  const body = await request.json();
  const { domainId, targetKey, config } = body;
  if (!domainId || !targetKey || !config) {
    return json({ error: 'Missing domainId, targetKey, or config' }, 400);
  }

  const id = uid();
  const now = new Date().toISOString();

  try {
    await db.prepare(`
      INSERT INTO ops_deploy_configs (id, domain_id, target_key, config, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(domain_id, target_key) DO UPDATE SET
        config = excluded.config,
        updated_at = excluded.updated_at
    `).bind(id, domainId, targetKey, JSON.stringify(config), now, now).run();

    return json({ success: true });
  } catch (e) {
    const msg = String(e?.message || e || '');
    if (msg.includes('no such table: ops_deploy_configs')) {
      return json({ success: false, skipped: true, error: 'ops_deploy_configs table not found' });
    }
    throw e;
  }
}

/**
 * Route entry. Returns Response if path matches; null otherwise.
 */
export async function handleDeploymentsRoute({ request, db, url, path, method }) {
  if (path === '/api/ops/deployments' && method === 'GET') return handleDeploymentsList({ db, url });
  if (path === '/api/ops/deployments' && method === 'POST') return handleDeploymentsCreate({ request, db });
  if (path === '/api/ops/deployments/git-push' && method === 'POST') return handleDeploymentsGitPush({ request, db });
  if (path === '/api/ops/deployments/stats' && method === 'GET') return handleDeploymentsStats({ db, url });
  if (path.match(/^\/api\/ops\/deployments\/[\w-]+$/) && method === 'PATCH') return handleDeploymentsPatch({ request, db, path });
  if (path === '/api/ops/deploy-configs' && method === 'GET') return handleDeployConfigsGet({ db, url });
  if (path === '/api/ops/deploy-configs' && method === 'POST') return handleDeployConfigsPost({ request, db });
  return null;
}
