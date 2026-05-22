// ============================================================
// Neon Postgres mirror for FusionOps API Worker
// ============================================================
// Best-effort sync of settings/sites/deploys to a Neon serverless
// Postgres instance for analytics/reporting. D1 remains primary.
// All functions silently no-op when env.NEON_DATABASE_URL is unset.
//
// Extracted from worker.js (Phase 1: utility extraction).
// ============================================================

import { neon } from '@neondatabase/serverless';
import { snakeToCamel } from './case-utils.js';

export function getNeonSql(env) {
  const connStr = env?.NEON_DATABASE_URL;
  if (!connStr || typeof connStr !== 'string') return null;
  if (!connStr.includes('@')) return null;
  try {
    return neon(connStr);
  } catch (_e) {
    return null;
  }
}

export async function ensureNeonTables(sql) {
  if (!sql) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value JSONB,
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `;

    await sql`
      ALTER TABLE settings
      ALTER COLUMN value TYPE JSONB
      USING (
        CASE
          WHEN value IS NULL THEN NULL
          WHEN pg_typeof(value) = 'jsonb'::regtype THEN value
          ELSE to_jsonb(value)
        END
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS sites (
        id TEXT PRIMARY KEY,
        data JSONB,
        created_at TIMESTAMPTZ DEFAULT now(),
        updated_at TIMESTAMPTZ DEFAULT now()
      )
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS deploy_history (
        id TEXT PRIMARY KEY,
        site_id TEXT,
        target TEXT,
        url TEXT,
        status TEXT,
        brand TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;
  } catch (_e) {
    // Best-effort only; D1 remains primary.
  }
}

export async function neonUpsertSettings(sql, obj) {
  if (!sql || !obj) return;
  for (const [key, value] of Object.entries(obj)) {
    await sql`
      INSERT INTO settings (key, value, updated_at)
      VALUES (${key}, ${JSON.stringify(value)}, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `;
  }
}

export async function neonUpsertSite(sql, id, body) {
  if (!sql) return;
  await sql`
    INSERT INTO sites (id, data, created_at, updated_at)
    VALUES (${id}, ${JSON.stringify(body || {})}, now(), now())
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
  `;
}

export async function neonDeleteSite(sql, id) {
  if (!sql) return;
  await sql`DELETE FROM sites WHERE id = ${id}`;
}

export async function neonUpsertDeploy(sql, id, body) {
  if (!sql) return;
  await sql`
    INSERT INTO deploy_history (id, site_id, target, url, status, brand, created_at)
    VALUES (
      ${id},
      ${body?.siteId || ''},
      ${body?.target || body?.type || 'netlify'},
      ${body?.url || ''},
      ${body?.status || 'success'},
      ${body?.brand || ''},
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      site_id = EXCLUDED.site_id,
      target = EXCLUDED.target,
      url = EXCLUDED.url,
      status = EXCLUDED.status,
      brand = EXCLUDED.brand
  `;
}

export async function neonDeleteDeploy(sql, id) {
  if (!sql) return;
  await sql`DELETE FROM deploy_history WHERE id = ${id}`;
}

export function buildNeonSitePayloadFromD1Row(row) {
  if (!row) return null;
  const site = snakeToCamel(row);
  delete site.createdAt;
  delete site.updatedAt;
  return site;
}

export function buildNeonDeployPayloadFromD1Row(row) {
  if (!row) return null;
  const deploy = snakeToCamel(row);
  return {
    id: deploy.id,
    siteId: deploy.siteId || '',
    target: deploy.target || deploy.type || 'netlify',
    status: deploy.status || 'success',
    brand: deploy.brand || '',
    url: deploy.url || '',
  };
}

function coerceD1SettingValue(value) {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed) return value;
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      return JSON.parse(trimmed);
    } catch (_e) {
      return value;
    }
  }
  return value;
}

export async function syncD1ToNeon(db, sql) {
  if (!db || !sql) {
    return {
      settings: 0,
      sites: 0,
      deploys: 0,
    };
  }

  await ensureNeonTables(sql);

  const [settingsRows, sitesRows, deployRows] = await Promise.all([
    db.prepare('SELECT key, value FROM settings').all(),
    db.prepare('SELECT * FROM sites ORDER BY created_at DESC').all(),
    db.prepare('SELECT * FROM deploys ORDER BY created_at DESC LIMIT 100').all(),
  ]);

  const settings = {};
  for (const row of settingsRows?.results || []) {
    settings[row.key] = coerceD1SettingValue(row.value);
  }

  if (Object.keys(settings).length > 0) {
    await neonUpsertSettings(sql, settings);
  }

  for (const row of sitesRows?.results || []) {
    const payload = buildNeonSitePayloadFromD1Row(row);
    await neonUpsertSite(sql, row.id, payload);
  }

  for (const row of deployRows?.results || []) {
    const payload = buildNeonDeployPayloadFromD1Row(row);
    await neonUpsertDeploy(sql, row.id, payload);
  }

  return {
    settings: settingsRows?.results?.length || 0,
    sites: sitesRows?.results?.length || 0,
    deploys: deployRows?.results?.length || 0,
  };
}
