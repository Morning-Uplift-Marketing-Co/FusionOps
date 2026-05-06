// ============================================================
// Sites + Deploys + Variants + Ops handler for FusionOps API Worker
// ============================================================
// Routes:
//   /api/sites           CRUD (sites table) + version snapshot + Internet.bs auto-sync
//   /api/deploys         CRUD (deploys table)
//   /api/variants        CRUD + batch insert (variants table)
//   /api/ops/domains     CRUD (ops_domains)
//   /api/ops/accounts    CRUD (ops_accounts)
//   /api/ops/profiles    CRUD (ops_profiles)
//   /api/ops/payments    CRUD (ops_payments)
//   /api/ops/logs        GET (ops_logs)
//
// Shared helpers (module-private):
//   createVersionSnapshot — append site_versions row with SHA-256 hash
//   autoSyncInternetBsNameserversForSite — best-effort CF zone + IBS NS update
//
// Extracted from worker.js (Phase 2: handler extraction).
// ============================================================

import { json, uid } from '../lib/http.js';
import { camelToSnake } from '../lib/case-utils.js';
import {
  neonUpsertSite,
  neonDeleteSite,
  neonUpsertDeploy,
  neonDeleteDeploy,
} from '../lib/neon-sync.js';
import {
  resolveCloudflareAccount,
  ensureCloudflareZoneAndNameservers,
} from '../lib/cloudflare.js';
import { updateInternetBsNameservers } from '../lib/internetbs.js';

// Column whitelists for PUT endpoints (SQL injection protection)
const ALLOWED_COLS = {
  domains: new Set(['domain', 'registrar', 'accountId', 'profileId', 'cfAccountId', 'zoneId', 'nameservers', 'status', 'registrarAccountId']),
  accounts: new Set(['label', 'email', 'paymentId', 'budget', 'status', 'cardUuid', 'cardLast4', 'cardStatus', 'profileId', 'proxyIp', 'monthlySpend']),
  profiles: new Set(['name', 'proxyIp', 'browserType', 'os', 'status', 'mlProfileId', 'mlFolderId', 'proxyHost', 'proxyPort', 'proxyUser', 'fingerprintOs']),
  payments: new Set(['label', 'type', 'last4', 'bankName', 'status', 'lcCardUuid', 'lcBinUuid', 'cardLimit', 'cardExpiry', 'totalSpend']),
};

async function createVersionSnapshot(db, siteId, config) {
  try {
    const jsonStr = JSON.stringify(config);

    const { results } = await db.prepare(`
      SELECT COALESCE(MAX(version_number), 0) as v
      FROM site_versions
      WHERE site_id = ?
    `).bind(siteId).all();

    const nextVersion = (results[0]?.v || 0) + 1;

    const hashBuffer = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(jsonStr)
    );

    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    await db.prepare(`
      INSERT INTO site_versions
      (id, site_id, version_number, config_json, config_hash)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      siteId,
      nextVersion,
      jsonStr,
      hashHex
    ).run();
  } catch (err) {
    console.error('Version snapshot failed:', err);
    // DO NOT throw
  }
}

async function autoSyncInternetBsNameserversForSite(db, body) {
  try {
    const domain = String(body?.domain || '').trim().toLowerCase();
    const registrarAccountId = body?.internetbsAccountId || body?.registrarAccountId || body?.accountId;
    const cfAccountRef = body?.cfAccountId;

    if (!domain || !registrarAccountId || !cfAccountRef) {
      return { attempted: false, reason: 'missing_domain_or_account_selection' };
    }

    const cfAccount = await resolveCloudflareAccount(db, cfAccountRef);
    if (!cfAccount) {
      return { attempted: true, success: false, reason: 'cloudflare_account_not_found' };
    }

    const zoneResult = await ensureCloudflareZoneAndNameservers(cfAccount.account_id, cfAccount.api_token, domain);
    if (!zoneResult.success) {
      return { attempted: true, success: false, reason: 'zone_prepare_failed', message: zoneResult.error };
    }

    const registrarResult = await updateInternetBsNameservers(db, registrarAccountId, domain, zoneResult.nameservers);
    if (!registrarResult.success) {
      return { attempted: true, success: false, reason: 'registrar_update_failed', message: registrarResult.message };
    }

    return {
      attempted: true,
      success: true,
      zoneId: zoneResult.zoneId,
      nameservers: zoneResult.nameservers,
      message: registrarResult.message,
    };
  } catch (e) {
    return { attempted: true, success: false, reason: 'exception', message: e?.message || 'Unknown error' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SITES
// ═══════════════════════════════════════════════════════════════════════════

async function sitesRoute({ request, db, neonSql, path, method }) {
  if (path === '/api/sites' && method === 'GET') {
    const { results } = await db.prepare('SELECT * FROM sites ORDER BY created_at DESC').all();
    return json(results);
  }

  if (path === '/api/sites' && method === 'POST') {
    const body = await request.json();
    const id = body.id || uid();
    await db.prepare(`
      INSERT INTO sites (id, brand, domain, tagline, email, loan_type, amount_min, amount_max,
        apr_min, apr_max, color_id, font_id, layout, radius, h1, badge, cta, sub,
        gtm_id, network, redirect_url, conversion_id, conversion_label,
        copy_id, sections, compliance, status, cost, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, body.brand || '', body.domain || '', body.tagline || '', body.email || '',
      body.loanType || 'personal', body.amountMin || 100, body.amountMax || 5000,
      body.aprMin || 5.99, body.aprMax || 35.99,
      body.colorId || 'ocean', body.fontId || 'dm-sans', body.layout || 'hero-left',
      body.radius || 'rounded', body.h1 || '', body.badge || '', body.cta || '', body.sub || '',
      body.gtmId || '', body.network || 'LeadsGate', body.redirectUrl || '',
      body.conversionId || '', body.conversionLabel || '',
      body.copyId || '', body.sections || 'default', body.compliance || 'standard',
      body.status || 'completed', body.cost || 0, body.createdBy || ''
    ).run();

    if (neonSql) neonUpsertSite(neonSql, id, body).catch(() => {});
    await createVersionSnapshot(db, id, body);
    const internetBsSync = await autoSyncInternetBsNameserversForSite(db, body);
    return json({ id, success: true, internetBsSync }, 201);
  }

  if (path.match(/^\/api\/sites\/[\w-]+$/) && method === 'DELETE') {
    const id = path.split('/').pop();
    await db.prepare('DELETE FROM sites WHERE id = ?').bind(id).run();
    if (neonSql) neonDeleteSite(neonSql, id).catch(() => {});
    return json({ success: true });
  }

  if (path.match(/^\/api\/sites\/[\w-]+$/) && method === 'PUT') {
    const id = path.split('/').pop();
    const body = await request.json();

    const fields = [];
    const values = [];
    const map = [
      ['brand', 'brand'],
      ['domain', 'domain'],
      ['tagline', 'tagline'],
      ['email', 'email'],
      ['loanType', 'loan_type'],
      ['amountMin', 'amount_min'],
      ['amountMax', 'amount_max'],
      ['aprMin', 'apr_min'],
      ['aprMax', 'apr_max'],
      ['colorId', 'color_id'],
      ['fontId', 'font_id'],
      ['layout', 'layout'],
      ['radius', 'radius'],
      ['h1', 'h1'],
      ['badge', 'badge'],
      ['cta', 'cta'],
      ['sub', 'sub'],
      ['gtmId', 'gtm_id'],
      ['network', 'network'],
      ['redirectUrl', 'redirect_url'],
      ['conversionId', 'conversion_id'],
      ['conversionLabel', 'conversion_label'],
      ['copyId', 'copy_id'],
      ['sections', 'sections'],
      ['compliance', 'compliance'],
      ['status', 'status'],
      ['cost', 'cost'],
    ];

    for (const [from, to] of map) {
      if (Object.prototype.hasOwnProperty.call(body, from)) {
        fields.push(`${to} = ?`);
        values.push(body[from]);
      }
    }

    if (fields.length === 0) {
      return json({ error: 'No updatable fields provided' }, 400);
    }

    values.push(id);
    await db.prepare(`UPDATE sites SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();

    if (neonSql) {
      const merged = { ...body, id };
      neonUpsertSite(neonSql, id, merged).catch(() => {});
    }
    await createVersionSnapshot(db, id, body);
    const internetBsSync = await autoSyncInternetBsNameserversForSite(db, body);
    return json({ success: true, internetBsSync });
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// DEPLOYS
// ═══════════════════════════════════════════════════════════════════════════

async function deploysRoute({ request, db, neonSql, path, method }) {
  if (path === '/api/deploys' && method === 'GET') {
    const { results } = await db.prepare('SELECT * FROM deploys ORDER BY created_at DESC LIMIT 100').all();
    return json(results);
  }

  if (path === '/api/deploys' && method === 'POST') {
    const body = await request.json();
    const id = body.id || uid();
    await db.prepare(`
      INSERT INTO deploys (id, site_id, brand, url, type, deployed_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(id, body.siteId || '', body.brand || '', body.url || '', body.type || 'new', body.deployedBy || '').run();

    if (neonSql) neonUpsertDeploy(neonSql, id, body).catch(() => {});
    return json({ id, success: true }, 201);
  }

  if (path.startsWith('/api/deploys/') && method === 'DELETE') {
    const id = path.split('/')[3];
    await db.prepare('DELETE FROM deploys WHERE id = ?').bind(id).run();
    if (neonSql) neonDeleteDeploy(neonSql, id).catch(() => {});
    return json({ success: true });
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// VARIANTS
// ═══════════════════════════════════════════════════════════════════════════

async function variantsRoute({ request, db, path, method }) {
  if (path === '/api/variants' && method === 'GET') {
    const { results } = await db.prepare('SELECT * FROM variants ORDER BY created_at DESC').all();
    return json(results);
  }

  if (path === '/api/variants' && method === 'POST') {
    const body = await request.json();
    const id = body.id || uid();
    await db.prepare(`
      INSERT INTO variants (id, color_id, font_id, layout, radius, copy_id, sections, compliance, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(id, body.colorId || 'ocean', body.fontId || 'dm-sans', body.layout || 'hero-left',
      body.radius || 'rounded', body.copyId || 'smart', body.sections || 'default',
      body.compliance || 'standard', body.createdBy || ''
    ).run();
    return json({ id, success: true }, 201);
  }

  if (path === '/api/variants/batch' && method === 'POST') {
    const body = await request.json();
    const items = body.variants || [];
    const stmt = db.prepare(`
      INSERT INTO variants (id, color_id, font_id, layout, radius, copy_id, sections, compliance, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const batch = items.map(v => stmt.bind(
      v.id || uid(), v.colorId, v.fontId, v.layout, v.radius, v.copyId, v.sections, v.compliance, v.createdBy || ''
    ));
    await db.batch(batch);
    return json({ success: true, count: items.length }, 201);
  }

  if (path.match(/^\/api\/variants\/[\w-]+$/) && method === 'DELETE') {
    const id = path.split('/').pop();
    await db.prepare('DELETE FROM variants WHERE id = ?').bind(id).run();
    return json({ success: true });
  }

  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// OPS — Domains / Accounts / Profiles / Payments / Logs
// ═══════════════════════════════════════════════════════════════════════════

async function opsRoute({ request, db, path, method }) {
  // ═══ OPS: DOMAINS ═══
  if (path === '/api/ops/domains' && method === 'GET') {
    const { results } = await db.prepare('SELECT * FROM ops_domains ORDER BY created_at DESC').all();
    return json(results);
  }
  if (path === '/api/ops/domains' && method === 'POST') {
    const body = await request.json();
    const id = body.id || uid();
    await db.prepare('INSERT INTO ops_domains (id, domain, registrar, account_id, profile_id, cf_account_id, status) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .bind(id, body.domain || '', body.registrar || '', body.accountId || '', body.profileId || '', body.cfAccountId || '', body.status || 'active').run();
    await db.prepare('INSERT INTO ops_logs (id, msg) VALUES (?, ?)').bind(uid(), `Added domain: ${body.domain}`).run();
    return json({ id, success: true }, 201);
  }
  if (path.match(/^\/api\/ops\/domains\/[\w-]+$/) && method === 'DELETE') {
    const id = path.split('/').pop();
    const item = await db.prepare('SELECT domain FROM ops_domains WHERE id = ?').bind(id).first();
    await db.prepare('DELETE FROM ops_domains WHERE id = ?').bind(id).run();
    await db.prepare('INSERT INTO ops_logs (id, msg) VALUES (?, ?)').bind(uid(), `Deleted domain: ${item?.domain || id}`).run();
    return json({ success: true });
  }
  if (path.match(/^\/api\/ops\/domains\/[\w-]+$/) && method === 'PUT') {
    const id = path.split('/').pop();
    const body = await request.json();
    const sets = [];
    const vals = [];
    for (const [key, value] of Object.entries(body)) {
      if (key === 'id' || key === 'createdAt') continue;
      if (!ALLOWED_COLS.domains.has(key)) continue;
      if (key === 'nameservers') {
        const nsValue = Array.isArray(value) ? JSON.stringify(value) : String(value || '');
        sets.push('nameservers = ?');
        vals.push(nsValue);
        continue;
      }
      sets.push(`${camelToSnake(key)} = ?`);
      vals.push(value);
    }
    if (sets.length === 0) return json({ error: 'No fields to update' }, 400);
    vals.push(id);
    await db.prepare(`UPDATE ops_domains SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
    await db.prepare('INSERT INTO ops_logs (id, msg) VALUES (?, ?)').bind(uid(), `Updated domain: ${id}`).run();
    return json({ success: true });
  }

  // ═══ OPS: ACCOUNTS ═══
  if (path === '/api/ops/accounts' && method === 'GET') {
    const { results } = await db.prepare('SELECT * FROM ops_accounts ORDER BY created_at DESC').all();
    return json(results);
  }
  if (path === '/api/ops/accounts' && method === 'POST') {
    const body = await request.json();
    const id = body.id || uid();
    await db.prepare('INSERT INTO ops_accounts (id, label, email, payment_id, budget, status, card_uuid, card_last4, card_status, profile_id, proxy_ip, monthly_spend) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, body.label || '', body.email || '', body.paymentId || '', body.budget || '', body.status || 'active',
        body.cardUuid || '', body.cardLast4 || '', body.cardStatus || '', body.profileId || '', body.proxyIp || '', body.monthlySpend || 0).run();
    await db.prepare('INSERT INTO ops_logs (id, msg) VALUES (?, ?)').bind(uid(), `Added account: ${body.label}`).run();
    return json({ id, success: true }, 201);
  }
  if (path.match(/^\/api\/ops\/accounts\/[\w-]+$/) && method === 'DELETE') {
    const id = path.split('/').pop();
    const item = await db.prepare('SELECT label FROM ops_accounts WHERE id = ?').bind(id).first();
    await db.prepare('DELETE FROM ops_accounts WHERE id = ?').bind(id).run();
    await db.prepare('INSERT INTO ops_logs (id, msg) VALUES (?, ?)').bind(uid(), `Deleted account: ${item?.label || id}`).run();
    return json({ success: true });
  }
  if (path.match(/^\/api\/ops\/accounts\/[\w-]+$/) && method === 'PUT') {
    const id = path.split('/').pop();
    const body = await request.json();
    const sets = [];
    const vals = [];
    for (const [key, value] of Object.entries(body)) {
      if (key === 'id' || key === 'createdAt') continue;
      if (!ALLOWED_COLS.accounts.has(key)) continue;
      sets.push(`${camelToSnake(key)} = ?`);
      vals.push(value);
    }
    if (sets.length === 0) return json({ error: 'No fields to update' }, 400);
    vals.push(id);
    await db.prepare(`UPDATE ops_accounts SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
    await db.prepare('INSERT INTO ops_logs (id, msg) VALUES (?, ?)').bind(uid(), `Updated account: ${id}`).run();
    return json({ success: true });
  }

  // ═══ OPS: PROFILES ═══
  if (path === '/api/ops/profiles' && method === 'GET') {
    const { results } = await db.prepare('SELECT * FROM ops_profiles ORDER BY created_at DESC').all();
    return json(results);
  }
  if (path === '/api/ops/profiles' && method === 'POST') {
    const body = await request.json();
    const id = body.id || uid();
    await db.prepare('INSERT INTO ops_profiles (id, name, proxy_ip, browser_type, os, status, ml_profile_id, ml_folder_id, proxy_host, proxy_port, proxy_user, fingerprint_os) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, body.name || '', body.proxyIp || '', body.browserType || '', body.os || '', body.status || 'active',
        body.mlProfileId || '', body.mlFolderId || '', body.proxyHost || '', body.proxyPort || '', body.proxyUser || '', body.fingerprintOs || '').run();
    await db.prepare('INSERT INTO ops_logs (id, msg) VALUES (?, ?)').bind(uid(), `Added profile: ${body.name}`).run();
    return json({ id, success: true }, 201);
  }
  if (path.match(/^\/api\/ops\/profiles\/[\w-]+$/) && method === 'DELETE') {
    const id = path.split('/').pop();
    const item = await db.prepare('SELECT name FROM ops_profiles WHERE id = ?').bind(id).first();
    await db.prepare('DELETE FROM ops_profiles WHERE id = ?').bind(id).run();
    await db.prepare('INSERT INTO ops_logs (id, msg) VALUES (?, ?)').bind(uid(), `Deleted profile: ${item?.name || id}`).run();
    return json({ success: true });
  }
  if (path.match(/^\/api\/ops\/profiles\/[\w-]+$/) && method === 'PUT') {
    const id = path.split('/').pop();
    const body = await request.json();
    const sets = [];
    const vals = [];
    for (const [key, value] of Object.entries(body)) {
      if (key === 'id' || key === 'createdAt') continue;
      if (!ALLOWED_COLS.profiles.has(key)) continue;
      sets.push(`${camelToSnake(key)} = ?`);
      vals.push(value);
    }
    if (sets.length === 0) return json({ error: 'No fields to update' }, 400);
    vals.push(id);
    await db.prepare(`UPDATE ops_profiles SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
    await db.prepare('INSERT INTO ops_logs (id, msg) VALUES (?, ?)').bind(uid(), `Updated profile: ${id}`).run();
    return json({ success: true });
  }

  // ═══ OPS: PAYMENTS ═══
  if (path === '/api/ops/payments' && method === 'GET') {
    const { results } = await db.prepare('SELECT * FROM ops_payments ORDER BY created_at DESC').all();
    return json(results);
  }
  if (path === '/api/ops/payments' && method === 'POST') {
    const body = await request.json();
    const id = body.id || uid();
    await db.prepare('INSERT INTO ops_payments (id, label, type, last4, bank_name, status, lc_card_uuid, lc_bin_uuid, card_limit, card_expiry, total_spend) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .bind(id, body.label || '', body.type || '', body.last4 || '', body.bankName || '', body.status || 'active',
        body.lcCardUuid || '', body.lcBinUuid || '', body.cardLimit || 0, body.cardExpiry || '', body.totalSpend || 0).run();
    await db.prepare('INSERT INTO ops_logs (id, msg) VALUES (?, ?)').bind(uid(), `Added payment: ${body.label}`).run();
    return json({ id, success: true }, 201);
  }
  if (path.match(/^\/api\/ops\/payments\/[\w-]+$/) && method === 'DELETE') {
    const id = path.split('/').pop();
    const item = await db.prepare('SELECT label FROM ops_payments WHERE id = ?').bind(id).first();
    await db.prepare('DELETE FROM ops_payments WHERE id = ?').bind(id).run();
    await db.prepare('INSERT INTO ops_logs (id, msg) VALUES (?, ?)').bind(uid(), `Deleted payment: ${item?.label || id}`).run();
    return json({ success: true });
  }
  if (path.match(/^\/api\/ops\/payments\/[\w-]+$/) && method === 'PUT') {
    const id = path.split('/').pop();
    const body = await request.json();
    const sets = [];
    const vals = [];
    for (const [key, value] of Object.entries(body)) {
      if (key === 'id' || key === 'createdAt') continue;
      if (!ALLOWED_COLS.payments.has(key)) continue;
      sets.push(`${camelToSnake(key)} = ?`);
      vals.push(value);
    }
    if (sets.length === 0) return json({ error: 'No fields to update' }, 400);
    vals.push(id);
    await db.prepare(`UPDATE ops_payments SET ${sets.join(', ')} WHERE id = ?`).bind(...vals).run();
    await db.prepare('INSERT INTO ops_logs (id, msg) VALUES (?, ?)').bind(uid(), `Updated payment: ${id}`).run();
    return json({ success: true });
  }

  // ═══ OPS: LOGS ═══
  if (path === '/api/ops/logs' && method === 'GET') {
    const { results } = await db.prepare('SELECT * FROM ops_logs ORDER BY created_at DESC LIMIT 200').all();
    return json(results);
  }

  return null;
}

/**
 * Combined route entry. Returns Response if path matches sites/deploys/variants/ops; null otherwise.
 */
export async function handleSitesRoute(args) {
  return (await sitesRoute(args))
    || (await deploysRoute(args))
    || (await variantsRoute(args))
    || (await opsRoute(args));
}
