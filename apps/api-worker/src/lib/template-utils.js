// ============================================================
// Template helpers for FusionOps API Worker
// ============================================================
// Schema management, file parsing, quality gate, version snapshots,
// category inference, and template ID validation.
//
// Used by handlers/templates.js (template CRUD + thumbnails + MCP import).
//
// Extracted from worker.js (Phase 2: utility extraction).
// ============================================================

import { json, uid } from './http.js';

/** Idempotent schema migrations for the templates manager. */
export async function ensureTemplateManagerSchema(db) {
  try { await db.prepare('ALTER TABLE templates ADD COLUMN is_deleted INTEGER DEFAULT 0').run(); } catch (_e) { /* exists */ }
  try { await db.prepare("ALTER TABLE templates ADD COLUMN status TEXT DEFAULT 'draft'").run(); } catch (_e) { /* exists */ }
  try { await db.prepare('ALTER TABLE templates ADD COLUMN updated_at TEXT').run(); } catch (_e) { /* exists */ }
  try { await db.prepare('ALTER TABLE templates ADD COLUMN current_version INTEGER DEFAULT 1').run(); } catch (_e) { /* exists */ }
  try { await db.prepare('ALTER TABLE templates ADD COLUMN archived_at TEXT').run(); } catch (_e) { /* exists */ }
  try { await db.prepare('ALTER TABLE templates ADD COLUMN family_id TEXT').run(); } catch (_e) { /* exists */ }
  try { await db.prepare('ALTER TABLE templates ADD COLUMN variant_label TEXT').run(); } catch (_e) { /* exists */ }

  await db.prepare(`
    CREATE TABLE IF NOT EXISTS template_versions (
      id TEXT PRIMARY KEY,
      template_db_id TEXT NOT NULL,
      template_id TEXT NOT NULL,
      version_number INTEGER NOT NULL,
      name TEXT DEFAULT '',
      description TEXT DEFAULT '',
      category TEXT DEFAULT 'general',
      badge TEXT DEFAULT 'New',
      source_code TEXT DEFAULT '',
      files TEXT DEFAULT '{}',
      note TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    )
  `).run();
  await db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS uniq_template_versions ON template_versions(template_db_id, version_number)').run();
  await db.prepare('CREATE INDEX IF NOT EXISTS idx_template_versions_template_id ON template_versions(template_id)').run();
}

/** Build templateId → usage_count map from latest site_versions rows. */
export async function getTemplateUsageMap(db) {
  try {
    const { results } = await db.prepare(`
      WITH latest AS (
        SELECT site_id, MAX(version_number) AS max_v
        FROM site_versions
        GROUP BY site_id
      )
      SELECT
        json_extract(sv.config_json, '$.templateId') AS template_id,
        COUNT(*) AS usage_count
      FROM latest l
      JOIN site_versions sv
        ON sv.site_id = l.site_id
       AND sv.version_number = l.max_v
      WHERE json_extract(sv.config_json, '$.templateId') IS NOT NULL
      GROUP BY json_extract(sv.config_json, '$.templateId')
    `).all();
    const usage = {};
    for (const row of (results || [])) {
      const key = String(row.template_id || '').trim();
      if (!key) continue;
      usage[key] = Number(row.usage_count || 0);
    }
    return usage;
  } catch (_e) {
    return {};
  }
}

export function parseTemplateFiles(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch (_e) { return {}; }
  }
  return {};
}

export function normalizeTemplateFileKey(k) {
  return String(k || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

/** Read a template file by logical path (handles Windows keys and nested dirs). */
export function getTemplateFileFromMap(files, logicalPath) {
  if (!files || typeof files !== 'object' || !logicalPath) return '';
  const want = normalizeTemplateFileKey(logicalPath);
  for (const key of Object.keys(files)) {
    if (normalizeTemplateFileKey(key) === want) return String(files[key] ?? '');
  }
  for (const key of Object.keys(files)) {
    const nk = normalizeTemplateFileKey(key);
    if (nk.endsWith('/' + want)) return String(files[key] ?? '');
  }
  return '';
}

/**
 * Pick HTML for thumbnail screenshot: prefer CI/build output, then root index, then Astro entry.
 * @returns {{ html: string, source: string|null }}
 */
export function pickTemplateHtmlForThumb(files) {
  if (!files || typeof files !== 'object') return { html: '', source: null };
  const distOrder = ['dist/index.html', 'out/index.html', 'build/index.html'];
  for (const p of distOrder) {
    const html = getTemplateFileFromMap(files, p);
    if (html.trim()) return { html, source: p };
  }
  const keys = Object.keys(files);
  const idx =
    keys.find((k) => normalizeTemplateFileKey(k) === 'index.html') ||
    keys.find((k) => normalizeTemplateFileKey(k).endsWith('/index.html')) ||
    keys.find((k) => normalizeTemplateFileKey(k).endsWith('index.astro'));
  if (!idx) return { html: '', source: null };
  let html = String(files[idx] || '');
  html = html.replace(/^---[\s\S]*?---\n?/, '');
  return { html, source: idx };
}

/**
 * Quality gate for template uploads. Returns { pass, blocking, warnings }.
 * Blocking issues prevent acceptance; warnings are surfaced to the operator.
 */
export function getTemplateQualityGateReport({ files = {}, sourceCode = '', category = '' } = {}) {
  const fileMap = files && typeof files === 'object' ? files : {};
  const source = String(sourceCode || '');
  const categoryLower = String(category || '').toLowerCase();
  const keys = Object.keys(fileMap);
  const combined = source + JSON.stringify(fileMap);
  const htmlCombined = keys
    .filter((k) => k.toLowerCase().endsWith('.html'))
    .map((k) => (typeof fileMap[k] === 'string' ? fileMap[k] : ''))
    .join('\n') + '\n' + (/<html|<!doctype html/i.test(source) ? source : '');
  const hasEntry = keys.some((k) => k.endsWith('index.astro') || k.endsWith('index.html')) || /<html|<!doctype html/i.test(source);
  const hasPixelMarker = /sendBeacon|sendPixelBeacon|fpPixel|__fpPixel|PX_ENDPOINT|t\.[^"' ]+\/e|window\.__fusionopsTrack|window\.pixel/i.test(combined);
  const hasAstroLeak = /\{title\}|\{\s*noindex\s*\?|\{\s*[a-zA-Z_$][\w$]*\s*&&\s*\(/.test(htmlCombined);
  const hasViewport = /<meta[^>]+name=["']viewport["']/i.test(combined);
  const hasCta = /<button|href=["']#apply["']|type=["']submit["']/i.test(combined);
  const hasCalculator = /calculator|monthly payment|calcMonthly|loanAmount|payment estimate/i.test(combined);
  const hasAprCompare = /representative apr|apr range|<table[\s\S]*apr|term[\s\S]*apr/i.test(combined);
  const bannedPatterns = [
    /guaranteed approval/i,
    /guaranteed loan/i,
    /100%\s*approval/i,
    /everyone approved/i,
    /instant cash now/i,
    /free money/i,
    /zero risk/i,
  ];
  const matchedBanned = bannedPatterns.filter((p) => p.test(combined)).map((p) => p.toString());
  const blocking = [];
  const warnings = [];
  if (!hasEntry) blocking.push('Missing template entry (index.astro or index.html).');
  if (!hasPixelMarker) blocking.push('Missing first-party pixel marker (sendBeacon / t.domain/e).');
  if (hasAstroLeak) blocking.push('Potential Astro expression leak detected.');
  if (matchedBanned.length > 0) blocking.push(`Policy-risk copy detected: ${matchedBanned.join(', ')}`);
  if (/(installment|loan|pdl|pet-care)/i.test(categoryLower)) {
    if (!hasCalculator) blocking.push('Missing Payment Calculator section for loan template.');
    if (!hasAprCompare) blocking.push('Missing APR Compare/Representative APR section for loan template.');
  }
  if (!hasViewport) warnings.push('Viewport meta not detected (mobile UX risk).');
  if (!hasCta) warnings.push('Primary CTA marker not detected.');
  return {
    pass: blocking.length === 0,
    blocking,
    warnings,
  };
}

/**
 * Append a new template_versions row and bump current_version.
 * Race condition: MAX(version_number)+1 is not atomic — two concurrent
 * snapshots can collide on the UNIQUE index. Caller should retry on 409.
 */
export async function createTemplateVersionSnapshot(db, templateRow, note = '') {
  const { results } = await db
    .prepare('SELECT COALESCE(MAX(version_number), 0) AS v FROM template_versions WHERE template_db_id = ?')
    .bind(templateRow.id)
    .all();
  const nextVersion = Number(results?.[0]?.v || 0) + 1;
  const vid = uid();

  await db.prepare(`
    INSERT INTO template_versions (
      id, template_db_id, template_id, version_number,
      name, description, category, badge, source_code, files, note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    vid,
    templateRow.id,
    templateRow.template_id || '',
    nextVersion,
    templateRow.name || '',
    templateRow.description || '',
    templateRow.category || 'general',
    templateRow.badge || 'New',
    templateRow.source_code || '',
    templateRow.files || '{}',
    note || ''
  ).run();

  await db.prepare('UPDATE templates SET current_version = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .bind(nextVersion, templateRow.id).run();

  return nextVersion;
}

/** Stable HTTP responses + Workers logs for POST /api/templates failures. */
export function jsonFromTemplatePostException(err, ctx = {}) {
  const msg = String(err?.message || err || 'Unknown error');
  console.error('[POST /api/templates]', { ...ctx, message: msg }, err?.stack || '');
  if (/no such column/i.test(msg)) {
    return json({
      error: msg,
      code: 'D1_SCHEMA_MISMATCH',
      hint: 'D1 is missing a column on `templates` or `template_versions`. Apply migrations under apps/api-worker/migrations and redeploy the worker so ensureTemplateManagerSchema runs.',
    }, 500);
  }
  if (/no such table/i.test(msg)) {
    return json({
      error: msg,
      code: 'D1_MISSING_TABLE',
      hint: 'Apply SQL migrations under apps/api-worker/migrations to this D1 database.',
    }, 500);
  }
  if (/UNIQUE constraint failed/i.test(msg)) {
    const isVersions = /template_versions/i.test(msg);
    return json({
      error: isVersions
        ? 'Version snapshot failed due to a uniqueness conflict (retry the request).'
        : msg,
      code: 'UNIQUE_CONSTRAINT',
      detail: msg,
    }, 409);
  }
  if (/Payload too large|entity too large|too large|maximum.*size|exceeds.*limit/i.test(msg)) {
    return json({
      error: 'Template payload too large for storage or platform limits.',
      code: 'PAYLOAD_TOO_LARGE',
      detail: msg,
    }, 413);
  }
  if (/database is locked|D1_ERROR|:\s*busy/i.test(msg)) {
    return json({ error: msg, code: 'D1_TRANSIENT' }, 503);
  }
  return json({ error: msg, code: 'TEMPLATE_POST_FAILED' }, 500);
}

export const BUILTIN_TEMPLATE_IDS = new Set([
  'classic',
  'astrodeck-loan',
  'lander-core',
  'worker-safe-loan',
  'pdl-loans-v1',
  'pdl-loans-v3',
  'simple-lp',
  'pet-care-loans',
  'elastic-credits-v3',
  'scratchpay-bridge',
  'pet-loans-v1',
  'installment-loans-v1',
  'installment-loans-v2',
  'bear-loan-modern',
  'pet-care-v2',
  'installment-golden',
  'pet-care-golden',
  'leadgen-golden',
  'template-green-01',
  'pdl-loansv1',
]);

export function isValidTemplateId(value) {
  const v = String(value || '').trim();
  return /^[a-z0-9][a-z0-9-]{1,63}$/i.test(v);
}

/** Infer template category from templateId, name, description, and file contents */
export function inferTemplateCategory(templateId, name, description, files) {
  const hint = [templateId, name, description].join(' ').toLowerCase();
  const fileContent = typeof files === 'object' && files
    ? Object.values(files).filter(v => typeof v === 'string').join(' ').toLowerCase().slice(0, 5000)
    : '';
  if (/pet|animal|vet|puppy|kitten|veterinar/.test(hint)) return 'pet';
  if (/installment|pdl|payday/.test(hint)) return 'installment';
  if (/loan|lend|borrow|credit|financ|apr/.test(hint)) return 'loan';
  // Check file content as fallback
  if (/pet[-_ ]?care|veterinar|animal\s+hospital/i.test(fileContent)) return 'pet';
  if (/installment\s+loan|payday\s+loan/i.test(fileContent)) return 'installment';
  if (/loan\s+calculator|monthly\s+payment|apr\s+range|personal\s+loan/i.test(fileContent)) return 'loan';
  return 'general';
}

/** Resolve category: use explicit if valid and non-general, otherwise infer */
export function resolveCategory(explicit, templateId, name, description, files) {
  const cat = String(explicit || '').trim().toLowerCase();
  if (cat && cat !== 'general' && ['loan', 'pet', 'pet-care', 'installment', 'custom'].includes(cat)) return cat;
  return inferTemplateCategory(templateId, name, description, files);
}
