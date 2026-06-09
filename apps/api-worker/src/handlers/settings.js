// ============================================================
// Settings + Adspower relay handler for FusionOps API Worker
// ============================================================
// Routes:
//   GET  /api/settings              List all settings (key-value)
//   POST /api/settings              Bulk upsert settings (also mirrors to Neon)
//   POST /api/adspower/proxy        Server-relay to user's local Adspower API
//                                   via their HTTPS tunnel (path allowlisted)
//
// Adspower proxy notes:
//   - Path allowlist: /status + 3 browser-profile endpoints
//   - HTTPS-only base URL (Worker can't reach http://127.0.0.1)
//   - Resolves base+key from request body, falls back to D1 settings
//
// Extracted from worker.js (Phase 2: handler extraction).
// ============================================================

import { json } from '../lib/http.js';
import { neonUpsertSettings } from '../lib/neon-sync.js';
import { redactSettings, isMaskedSecret, SECRET_KEYS } from '../lib/case-utils.js';
import { healD1SettingsInPlace, persistD1SettingsHeal, resolveD1DatabaseIds } from '../lib/d1-settings-heal.js';

const ADSPOWER_ALLOWED_PATHS = new Set([
  '/status',
  '/api/v2/browser-profile/list',
  '/api/v2/browser-profile/start',
  '/api/v2/browser-profile/stop',
]);

async function settingsGet(db, neonSql) {
  const { results } = await db.prepare('SELECT * FROM settings').all();
  const obj = {};
  results.forEach(r => { obj[r.key] = r.value; });
  const healed = healD1SettingsInPlace(obj);
  if (healed) {
    await persistD1SettingsHeal(db, neonSql, obj);
  }
  return json(redactSettings(obj));
}

async function settingsPost({ request, db, neonSql }) {
  const body = await request.json();
  const merged = { ...body };
  if (merged.d1DatabaseId != null || merged.cfD1DatabaseId != null) {
    const resolved = resolveD1DatabaseIds(merged);
    if (resolved.d1DatabaseId) {
      merged.d1DatabaseId = resolved.d1DatabaseId;
      merged.cfD1DatabaseId = resolved.cfD1DatabaseId;
    }
  }
  for (const [key, value] of Object.entries(merged)) {
    // Skip if the frontend sent back a masked placeholder for a secret key —
    // this prevents '••••' from being persisted as the real credential.
    if (SECRET_KEYS.has(key) && isMaskedSecret(value)) continue;
    await db.prepare(`
      INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
      ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')
    `).bind(key, String(value), String(value)).run();
  }

  if (neonSql) {
    neonUpsertSettings(neonSql, merged).catch(() => {});
  }
  return json({ success: true });
}

async function adspowerProxy({ request, db }) {
  try {
    const body = await request.json();
    const subPath = String(body.path || '/status');
    const m = String(body.method || 'GET').toUpperCase();
    if (!subPath.startsWith('/') || subPath.includes('..')) {
      return json({ code: -1, msg: 'Invalid path' }, 400);
    }
    const pathOnly = subPath.split('?')[0];
    if (!ADSPOWER_ALLOWED_PATHS.has(pathOnly)) {
      return json({ code: -1, msg: 'Path not allowed' }, 400);
    }
    if (pathOnly === '/status' && m !== 'GET') {
      return json({ code: -1, msg: 'GET only for /status' }, 400);
    }
    if (pathOnly !== '/status' && m !== 'POST') {
      return json({ code: -1, msg: 'POST required for this endpoint' }, 400);
    }

    const baseRow = await db.prepare('SELECT value FROM settings WHERE key = ?').bind('adspowerLocalBase').first();
    const keyRow = await db.prepare('SELECT value FROM settings WHERE key = ?').bind('adspowerApiKey').first();
    const fromBodyBase = String(body.adspowerLocalBase ?? '').trim().replace(/\/+$/, '');
    const fromD1Base = String(baseRow?.value ?? '').trim().replace(/\/+$/, '');
    const base = fromBodyBase || fromD1Base;
    if (!base) {
      return json({
        code: -1,
        msg: 'ยังไม่มี Base URL — ใส่ในฟอร์มหรือ Save ใน Settings → Automation (HTTPS tunnel)',
      });
    }
    if (!/^https:\/\//i.test(base)) {
      return json({
        code: -1,
        msg: 'Base URL ต้องเป็น https:// (Worker เรียกจาก Cloudflare ไม่ถึง http://127.0.0.1)',
      });
    }

    const fromBodyKey = String(body.adspowerApiKey ?? '').trim();
    const fromD1Key = String(keyRow?.value ?? '').trim();
    const apiKey = fromBodyKey || fromD1Key;

    const headers = { Accept: 'application/json' };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const targetUrl = `${base}${subPath}`;
    const init = { method: m, headers, redirect: 'manual' };
    if (m === 'POST') {
      headers['Content-Type'] = 'application/json';
      const payload = body.body != null && typeof body.body === 'object' && !Array.isArray(body.body) ? body.body : {};
      init.body = JSON.stringify(payload);
    }

    const res = await fetch(targetUrl, init);
    const text = await res.text();
    let data;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { code: -1, msg: String(text || '').slice(0, 400) || `HTTP ${res.status}` };
    }
    if (!res.ok && (data.code === undefined || data.code === null) && !data.msg) {
      data = { code: -1, msg: `HTTP ${res.status}` };
    }
    return json(data);
  } catch (e) {
    // Sanitize error: never echo raw e.message — fetch/undici errors often
    // include the target URL (the user's private HTTPS tunnel) and rarely
    // also Authorization-header bytes. Map to a stable category instead.
    const raw = String(e?.message || e || '');
    let category = 'unknown';
    if (/abort|timeout|timed out/i.test(raw)) category = 'timeout';
    else if (/ENOTFOUND|getaddrinfo|DNS/i.test(raw)) category = 'dns';
    else if (/ECONNREFUSED|connection refused/i.test(raw)) category = 'refused';
    else if (/network|fetch failed/i.test(raw)) category = 'network';
    else if (/json|parse/i.test(raw)) category = 'parse';
    return json({ code: -1, msg: `AdsPower relay failed (${category})` });
  }
}

/**
 * Route entry. Returns Response if path matches; null otherwise.
 */
export async function handleSettingsRoute({ request, db, neonSql, path, method }) {
  if (path === '/api/settings' && method === 'GET') return settingsGet(db, neonSql);
  if (path === '/api/settings' && method === 'POST') return settingsPost({ request, db, neonSql });
  if (path === '/api/adspower/proxy' && method === 'POST') return adspowerProxy({ request, db });
  return null;
}
