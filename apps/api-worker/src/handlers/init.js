// ============================================================
// Bootstrap + stats handler for FusionOps API Worker
// ============================================================
// Routes:
//   GET /api/init-legacy   legacy bootstrap (settings + sites + ops)
//   GET /api/init          full bootstrap (sites/deploys/variants/ops/cf/registrar/settings/stats)
//   GET /api/stats         lightweight stats only (count + spend + revenue + 7-day series)
//
// /api/init returns redacted settings (SECRET_KEYS masked) but no
// per-row access control — see TODO in PR description.
//
// Extracted from worker.js (Phase 2: handler extraction).
// ============================================================

import { json } from '../lib/http.js';
import { snakeToCamel, redactSettings } from '../lib/case-utils.js';

// Credential fields that must never appear in /api/init responses.
// These rows are returned to the browser and their plaintext tokens must be masked.
const CF_ACCOUNT_SECRET_FIELDS = new Set(['api_key', 'api_token', 'apiKey', 'apiToken']);
const REGISTRAR_SECRET_FIELDS = new Set(['api_key', 'secret_key', 'apiKey', 'secretKey']);

function redactCfAccount(row) {
  const obj = snakeToCamel(row);
  for (const k of Object.keys(obj)) {
    if (CF_ACCOUNT_SECRET_FIELDS.has(k)) obj[k] = obj[k] ? '••••' : '';
  }
  return obj;
}

function redactRegistrarAccount(row) {
  const obj = snakeToCamel(row);
  for (const k of Object.keys(obj)) {
    if (REGISTRAR_SECRET_FIELDS.has(k)) obj[k] = obj[k] ? '••••' : '';
  }
  return obj;
}

async function handleInitLegacy(db) {
  const [settingsRows, sitesRows, deploysRows] = await Promise.all([
    db.prepare('SELECT key, value FROM settings').all(),
    db.prepare('SELECT * FROM sites ORDER BY updated_at DESC').all(),
    db.prepare('SELECT * FROM deploy_history ORDER BY deploy_time DESC LIMIT 100').all(),
  ]);

  const settingsRaw = {};
  settingsRows.results.forEach(r => { settingsRaw[r.key] = r.value; });

  // Ops data
  const [domains, accounts, profiles, payments, logs] = await Promise.all([
    db.prepare('SELECT * FROM ops_domains ORDER BY created_at DESC').all(),
    db.prepare('SELECT * FROM ops_accounts ORDER BY created_at DESC').all(),
    db.prepare('SELECT * FROM ops_profiles ORDER BY created_at DESC').all(),
    db.prepare('SELECT * FROM ops_payments ORDER BY created_at DESC').all(),
    db.prepare('SELECT * FROM ops_logs ORDER BY created_at DESC LIMIT 50').all(),
  ]);

  return json({
    settings: redactSettings(settingsRaw),
    sites: sitesRows.results || [],
    deploys: deploysRows.results || [],
    stats: {
      builds: sitesRows.results?.length || 0,
      spend: (sitesRows.results || []).reduce((a, s) => a + (Number(s.cost) || 0), 0),
    },
    ops: {
      domains: domains.results || [],
      accounts: accounts.results || [],
      profiles: profiles.results || [],
      payments: payments.results || [],
      logs: logs.results || [],
    },
  });
}

async function handleStats(db) {
  const sites = await db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(cost),0) as spend FROM sites').first();
  const deploys = await db.prepare('SELECT COUNT(*) as count FROM deploys').first();
  const domains = await db.prepare('SELECT COUNT(*) as count FROM ops_domains').first();
  const postbacksTotal = await db.prepare('SELECT COALESCE(SUM(payout),0) as revenue FROM voluum_postbacks').first().catch(() => ({ revenue: 0 }));
  const revenueSeriesRows = await db.prepare(
    `SELECT strftime('%Y-%m-%d', datetime(ts, 'unixepoch')) as date, COALESCE(SUM(payout),0) as revenue
     FROM voluum_postbacks
     WHERE ts >= unixepoch('now', '-7 days')
     GROUP BY date
     ORDER BY date ASC`
  ).all().catch(() => ({ results: [] }));

  const revenueSeries = (revenueSeriesRows?.results || []).map((r) => ({
    date: r.date,
    revenue: Number(r.revenue || 0),
    v: Number(r.revenue || 0),
  }));

  return json({
    builds: sites.count,
    spend: sites.spend,
    revenue: Number(postbacksTotal?.revenue || 0),
    revenueSeries,
    deployed: deploys.count,
    domains: domains.count,
  });
}

async function handleInit(db) {
  const safeAll = async (sql, fallback = []) => {
    try {
      const r = await db.prepare(sql).all();
      return r?.results || fallback;
    } catch (e) {
      console.warn('[init] safeAll failed:', sql, e?.message || e);
      return fallback;
    }
  };

  const safeFirst = async (sql, fallback = {}) => {
    try {
      return (await db.prepare(sql).first()) || fallback;
    } catch (e) {
      console.warn('[init] safeFirst failed:', sql, e?.message || e);
      return fallback;
    }
  };

  const [
    sites, deploys, variants, domains, accounts, profiles, payments, logs,
    settingsRows, stats, revenueTotals, revenueSeriesRows,
    cfAccountsResults, registrarAccountsResults, deploymentsResults,
  ] = await Promise.all([
    safeAll('SELECT * FROM sites ORDER BY created_at DESC'),
    safeAll('SELECT * FROM deploys ORDER BY created_at DESC LIMIT 100'),
    safeAll('SELECT * FROM variants ORDER BY created_at DESC'),
    safeAll('SELECT * FROM ops_domains ORDER BY created_at DESC'),
    safeAll('SELECT * FROM ops_accounts ORDER BY created_at DESC'),
    safeAll('SELECT * FROM ops_profiles ORDER BY created_at DESC'),
    safeAll('SELECT * FROM ops_payments ORDER BY created_at DESC'),
    safeAll('SELECT * FROM ops_logs ORDER BY created_at DESC LIMIT 200'),
    safeAll('SELECT * FROM settings'),
    safeFirst('SELECT COUNT(*) as builds, COALESCE(SUM(cost),0) as spend FROM sites', { builds: 0, spend: 0 }),
    safeFirst('SELECT COALESCE(SUM(payout),0) as revenue FROM voluum_postbacks', { revenue: 0 }),
    safeAll(
      `SELECT strftime('%Y-%m-%d', datetime(ts, 'unixepoch')) as date, COALESCE(SUM(payout),0) as revenue
       FROM voluum_postbacks
       WHERE ts >= unixepoch('now', '-7 days')
       GROUP BY date
       ORDER BY date ASC`
    ),
    safeAll('SELECT * FROM cf_accounts ORDER BY label ASC'),
    safeAll('SELECT * FROM registrar_accounts ORDER BY provider ASC, label ASC'),
    safeAll('SELECT * FROM ops_deployments ORDER BY created_at DESC LIMIT 50'),
  ]);

  const settingsObj = {};
  settingsRows.forEach(r => { settingsObj[r.key] = r.value; });

  const revenueSeries = (revenueSeriesRows || []).map((r) => ({
    date: r.date,
    revenue: Number(r.revenue || 0),
    v: Number(r.revenue || 0),
  }));

  return json({
    sites: sites.map(snakeToCamel),
    deploys: deploys.map(snakeToCamel),
    variants: variants.map(snakeToCamel),
    ops: {
      domains: domains.map(snakeToCamel),
      accounts: accounts.map(snakeToCamel),
      profiles: profiles.map(snakeToCamel),
      payments: payments.map(snakeToCamel),
      logs: logs.map(snakeToCamel),
      deployments: deploymentsResults.map(snakeToCamel),
    },
    cfAccounts: cfAccountsResults.map(redactCfAccount),
    registrarAccounts: registrarAccountsResults.map(redactRegistrarAccount),
    settings: redactSettings(settingsObj),
    stats: {
      builds: stats.builds || 0,
      spend: stats.spend || 0,
      revenue: Number(revenueTotals?.revenue || 0),
      revenueSeries,
    },
    integrations: {
      lcConfigured: !!settingsObj.lcToken,
      mlConfigured: !!settingsObj.mlToken,
      netlifyConfigured: !!settingsObj.netlifyToken,
    },
  });
}

/**
 * Route entry. Returns Response for /api/init, /api/init-legacy, /api/stats; null otherwise.
 */
export async function handleInitRoute({ db, path, method }) {
  if (path === '/api/init-legacy' && method === 'GET') return handleInitLegacy(db);
  if (path === '/api/stats' && method === 'GET') return handleStats(db);
  if (path === '/api/init' && method === 'GET') return handleInit(db);
  return null;
}
