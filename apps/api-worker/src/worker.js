// FusionOps V2 — Cloudflare Workers API
// Binds to D1 database "ppc-gen-claude"
// Origin: https://github.com/songsawat-w/ppc-gen-cfca

import puppeteer from '@cloudflare/puppeteer';
import { corsHeaders, json, uid, toBase64 } from './lib/http.js';
import { extractHost } from './lib/url.js';
import {
  parseVoluumPostbackMergedParams,
  normalizeVoluumDomainParam,
  isSafeVoluumForwardHost,
  voluumForwardSearchParams,
} from './lib/voluum-guard.js';
import {
  TRUSTED_PAGES_SUFFIXES,
  buildAllowedHosts,
  isFusionopsPagesDevHost,
  isTrustedOriginRequest,
  denyUnlessTrustedOrBearer,
  isReadOnlyD1DirectSql,
} from './lib/auth.js';
import { extractJson, callGemini, callAnthropic, callAI } from './lib/ai.js';
import {
  githubFetch,
  githubApi,
  getGithubFileSha,
  upsertGithubFile,
  ensureGithubBranch,
} from './lib/github.js';
import {
  getNeonSql,
  ensureNeonTables,
  neonUpsertSettings,
  neonUpsertSite,
  neonDeleteSite,
  neonUpsertDeploy,
  neonDeleteDeploy,
} from './lib/neon-sync.js';
import { isGtagRelayPath, handleGtagRelay } from './handlers/gtag-relay.js';
import { handleProxy } from './handlers/proxy.js';
import { handleLeadingCardsRoute, getLcSettings } from './handlers/leadingcards.js';
import { handleMultiloginRoute, getMlSettings } from './handlers/multilogin.js';
import { handleVoluumApiRoute } from './handlers/voluum-api.js';
import { handleOpenApiRoute } from './handlers/openapi.js';
import {
  handlePixelTrackingRoute,
  handleVoluumPostbacksApiGet,
  canonicalPixelEvent,
} from './handlers/pixel-tracking.js';
import { handleInitRoute } from './handlers/init.js';
import { handleAiGenerationRoute } from './handlers/ai-generation.js';
import { handleD1AutomationRoute } from './handlers/automation/d1.js';
import { handleRegistrarAutomationRoute } from './handlers/automation/registrar.js';
import { handleCloudflareAutomationRoute } from './handlers/automation/cloudflare.js';
import { handleDeployAutomationRoute } from './handlers/automation/deploy.js';
import { handleTrackingVerifyRoute } from './handlers/automation/tracking-verify.js';
import { handleIntegrationsAutomationRoute } from './handlers/automation/integrations.js';
import { handleSitesRoute } from './handlers/sites.js';
import {
  normalizeNameservers,
  canonicalizeNameservers,
  nameserversMatch,
  fetchInternetBsCurrentNameservers,
  updateInternetBsNameservers,
} from './lib/internetbs.js';
import {
  pollCloudflareNameservers,
  resolveCloudflareAccount,
  ensureCloudflareZoneAndNameservers,
} from './lib/cloudflare.js';
import {
  SECRET_KEYS,
  redactSettings,
  snakeToCamel,
  camelToSnake,
  isMaskedSecret,
} from './lib/case-utils.js';


/** Cap client-supplied HTML for Browser Rendering (abuse / memory). */
const THUMB_PREVIEW_HTML_MAX_BYTES = 2 * 1024 * 1024;

/** Cap manual thumbnail upload size. */
const THUMB_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;

async function ensureTemplateManagerSchema(db) {
  try { await db.prepare('ALTER TABLE templates ADD COLUMN is_deleted INTEGER DEFAULT 0').run(); } catch (_e) {}
  try { await db.prepare("ALTER TABLE templates ADD COLUMN status TEXT DEFAULT 'draft'").run(); } catch (_e) {}
  try { await db.prepare('ALTER TABLE templates ADD COLUMN updated_at TEXT').run(); } catch (_e) {}
  try { await db.prepare('ALTER TABLE templates ADD COLUMN current_version INTEGER DEFAULT 1').run(); } catch (_e) {}
  try { await db.prepare('ALTER TABLE templates ADD COLUMN archived_at TEXT').run(); } catch (_e) {}
  try { await db.prepare('ALTER TABLE templates ADD COLUMN family_id TEXT').run(); } catch (_e) {}
  try { await db.prepare('ALTER TABLE templates ADD COLUMN variant_label TEXT').run(); } catch (_e) {}

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

async function getTemplateUsageMap(db) {
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

function parseTemplateFiles(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch (_e) { return {}; }
  }
  return {};
}

function normalizeTemplateFileKey(k) {
  return String(k || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

/** Read a template file by logical path (handles Windows keys and nested dirs). */
function getTemplateFileFromMap(files, logicalPath) {
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
function pickTemplateHtmlForThumb(files) {
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

function getTemplateQualityGateReport({ files = {}, sourceCode = '', category = '' } = {}) {
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

async function createTemplateVersionSnapshot(db, templateRow, note = '') {
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
function jsonFromTemplatePostException(err, ctx = {}) {
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

const BUILTIN_TEMPLATE_IDS = new Set([
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

function isValidTemplateId(value) {
  const v = String(value || '').trim();
  return /^[a-z0-9][a-z0-9-]{1,63}$/i.test(v);
}

/** Infer template category from templateId, name, description, and file contents */
function inferTemplateCategory(templateId, name, description, files) {
  const hint = [templateId, name, description].join(' ').toLowerCase();
  const fileContent = typeof files === 'object' && files
    ? Object.values(files).filter(v => typeof v === 'string').join(' ').toLowerCase().slice(0, 5000)
    : '';
  const all = hint + ' ' + fileContent;
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
function resolveCategory(explicit, templateId, name, description, files) {
  const cat = String(explicit || '').trim().toLowerCase();
  if (cat && cat !== 'general' && ['loan', 'pet', 'pet-care', 'installment', 'custom'].includes(cat)) return cat;
  return inferTemplateCategory(templateId, name, description, files);
}

const DEPLOY_MANIFEST_SCHEMA = {
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "https://lp-factory.dev/schemas/deploy-manifest.schema.json",
  "title": "DeployManifest",
  "type": "object",
  "additionalProperties": false,
  "required": ["version", "siteId", "brand", "templateId", "environment", "targets", "build", "tracking", "meta"],
  "properties": {
    "version": { "type": "integer", "minimum": 1 },
    "siteId": { "type": "string", "minLength": 1 },
    "brand": { "type": "string" },
    "templateId": { "type": "string", "minLength": 1 },
    "environment": { "type": "string", "enum": ["dev", "staging", "production"] },
    "targets": {
      "type": "array", "minItems": 1,
      "items": {
        "type": "object", "additionalProperties": false, "required": ["provider"],
        "properties": {
          "provider": { "type": "string", "enum": ["github-actions", "cloudflare-pages", "netlify", "vercel"] },
          "projectName": { "type": "string" },
          "siteId": { "type": "string" },
          "vercelProjectId": { "type": "string" },
          "customDomain": { "type": "string" },
          "branch": { "type": "string" }
        }
      }
    },
    "build": {
      "type": "object", "additionalProperties": false, "required": ["entry", "extraFiles"],
      "properties": {
        "entry": { "type": "string", "enum": ["index.html", "astro"] },
        "extraFiles": { "type": "array", "items": { "type": "string" } }
      }
    },
    "tracking": {
      "type": "object", "additionalProperties": false, "required": ["googleAdsId", "pixelEndpoint", "voluumDomain"],
      "properties": {
        "googleAdsId": { "type": "string" },
        "pixelEndpoint": { "type": "string" },
        "voluumDomain": { "type": "string" }
      }
    },
    "meta": {
      "type": "object", "additionalProperties": false, "required": ["requestedBy", "requestedAt", "requestId", "commitMessage"],
      "properties": {
        "requestedBy": { "type": "string" },
        "requestedAt": { "type": "string" },
        "requestId": { "type": "string" },
        "commitMessage": { "type": "string" },
        "deployRecordId": { "type": "string" }
      }
    }
  }
};

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    const hostname = url.hostname;
    // Main D1 binding — must be declared here so early routes (/e, /v, /api/postbacks, …) never hit TDZ
    // from a duplicate `const db` declared later in this same function.
    const db = env.DB;

    // ═══ GOOGLE ADS / ANALYTICS RELAY — handles t.{domain}/gtag/js,
    // /g/collect, /j/collect, /ccm/collect, /pagead/* (Option G). Feature-
    // flagged off by default (env.ENABLE_GTAG_RELAY). See
    // .planning/specs/tracking-pipeline-v1/DESIGN.md. Must run before the
    // /e and /v routes so those paths are never shadowed — this helper
    // returns null when the flag is off or the path isn't in the allowlist.
    if (isGtagRelayPath(path)) {
      const relayed = await handleGtagRelay(request, url, env);
      if (relayed) return relayed;
      // Relay disabled — fall through so /gtag/js etc. return 404 via the
      // final not-found handler rather than hitting unrelated routes.
    }

    // ═══ PIXEL ENDPOINT (/e) + VOLUUM POSTBACK (/v) ═══
    {
      const pixelRes = await handlePixelTrackingRoute({ request, env, db, hostname, url, path, method });
      if (pixelRes) return pixelRes;
    }

    // ═══ TEMPLATE THUMBNAIL — serve from R2 ═══
    // GET /api/templates/:id/thumb → returns stored PNG from R2
    const thumbServeMatch = path.match(/^\/api\/templates\/([^/]+)\/thumb$/);
    if (thumbServeMatch && method === 'GET') {
      const id = decodeURIComponent(thumbServeMatch[1]);
      try {
        const obj = await env.THUMBS.get(`thumbs/${id}.png`);
        if (!obj) return new Response(null, { status: 404 });
        const headers = new Headers({ 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400', ...corsHeaders });
        return new Response(obj.body, { headers });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // ═══ TEMPLATE THUMBNAIL — manual upload ═══
    // POST /api/templates/:id/upload-thumb → accept image file → store in R2
    const thumbUploadMatch = path.match(/^\/api\/templates\/([^/]+)\/upload-thumb$/);
    if (thumbUploadMatch && method === 'POST') {
      const id = decodeURIComponent(thumbUploadMatch[1]);
      try {
        const authDeny = denyUnlessTrustedOrBearer(request, url, env);
        if (authDeny) return authDeny;
        const formData = await request.formData();
        const file = formData.get('image');
        if (!file || typeof file === 'string') return json({ error: 'No image file provided' }, 400);
        const contentType = file.type || 'image/png';
        if (!contentType.startsWith('image/')) return json({ error: 'File must be an image' }, 400);
        const buffer = await file.arrayBuffer();
        if (buffer.byteLength > THUMB_UPLOAD_MAX_BYTES) {
          return json(
            { error: 'Image too large', code: 'THUMB_UPLOAD_LIMIT', limit: THUMB_UPLOAD_MAX_BYTES },
            413,
          );
        }
        await env.THUMBS.put(`thumbs/${id}.png`, buffer, { httpMetadata: { contentType: 'image/png' } });
        try { await db.prepare('ALTER TABLE templates ADD COLUMN thumbnail_url TEXT').run(); } catch (_e) {}
        try { await db.prepare('ALTER TABLE templates ADD COLUMN thumbnail_generated_at TEXT').run(); } catch (_e) {}
        const thumbUrl = `/api/templates/${encodeURIComponent(id)}/thumb`;
        await db.prepare(`UPDATE templates SET thumbnail_url = ?, thumbnail_generated_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`)
          .bind(thumbUrl, id).run();
        return json({ ok: true, thumbUrl });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // ═══ TEMPLATE THUMBNAIL — generate via Browser Rendering ═══
    // POST /api/templates/:id/generate-thumb → screenshot template HTML → store in R2
    const thumbGenMatch = path.match(/^\/api\/templates\/([^/]+)\/generate-thumb$/);
    if (thumbGenMatch && method === 'POST') {
      const id = decodeURIComponent(thumbGenMatch[1]);
      try {
        const authDeny = denyUnlessTrustedOrBearer(request, url, env);
        if (authDeny) return authDeny;
        await ensureTemplateManagerSchema(db);
        // Ensure thumbnail columns exist before querying
        try { await db.prepare('ALTER TABLE templates ADD COLUMN thumbnail_url TEXT').run(); } catch (_e) {}
        try { await db.prepare('ALTER TABLE templates ADD COLUMN thumbnail_generated_at TEXT').run(); } catch (_e) {}
        /** Same document the web app builds (dist-first + base href + injections). */
        let previewHtmlFromClient = '';
        try {
          const ct = request.headers.get('content-type') || '';
          if (ct.includes('application/json')) {
            const body = await request.json();
            if (body && typeof body.previewHtml === 'string' && body.previewHtml.trim()) {
              previewHtmlFromClient = body.previewHtml.trim();
            }
          }
        } catch (_parse) {
          /* empty or invalid JSON body — fall back to server-side pick */
        }
        if (previewHtmlFromClient) {
          const bytes = new TextEncoder().encode(previewHtmlFromClient).byteLength;
          if (bytes > THUMB_PREVIEW_HTML_MAX_BYTES) {
            return json(
              {
                error: 'previewHtml too large',
                code: 'PREVIEW_HTML_LIMIT',
                limit: THUMB_PREVIEW_HTML_MAX_BYTES,
              },
              413,
            );
          }
        }
        // Load template from D1 — uses files column (JSON string), not data
        const row = await db.prepare(`SELECT id, files, name, thumbnail_url FROM templates WHERE id = ? AND COALESCE(is_deleted,0) = 0 LIMIT 1`).bind(id).first();
        if (!row) return json({ error: 'Template not found' }, 404);
        const files = parseTemplateFiles(row.files);
        let html = previewHtmlFromClient;
        if (!html) {
          const picked = pickTemplateHtmlForThumb(files);
          if (!picked.html.trim()) return json({ error: 'No renderable HTML found in template' }, 422);
          html = picked.html;
        }
        // Launch browser and screenshot
        const browser = await puppeteer.launch(env.BROWSER);
        const page = await browser.newPage();
        await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
        await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 });
        const screenshot = await page.screenshot({ type: 'png', clip: { x: 0, y: 0, width: 390, height: 844 } });
        await browser.close();
        // Store in R2
        await env.THUMBS.put(`thumbs/${id}.png`, screenshot, { httpMetadata: { contentType: 'image/png' } });
        // Store thumbnailUrl in D1 — add column if needed
        try { await db.prepare('ALTER TABLE templates ADD COLUMN thumbnail_url TEXT').run(); } catch (_e) {}
        try { await db.prepare('ALTER TABLE templates ADD COLUMN thumbnail_generated_at TEXT').run(); } catch (_e) {}
        const thumbUrl = `/api/templates/${encodeURIComponent(id)}/thumb`;
        await db.prepare(`UPDATE templates SET thumbnail_url = ?, thumbnail_generated_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`)
          .bind(thumbUrl, id).run();
        return json({ ok: true, thumbUrl });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // ═══ SITE CONFIG — returns obfuscated aid for a given domain ═══
    // Called by apply.astro to avoid exposing aid directly in HTML source
    if (path === '/api/cfg' && method === 'GET') {
      try {
        const domain = url.searchParams.get('d') || '';
        if (!domain) return json({ error: 'Missing d param' }, 400);
        const row = await db.prepare(
          `SELECT data FROM sites WHERE id = ? OR json_extract(data, '$.domain') = ? LIMIT 1`
        ).bind(domain, domain).first();
        const data = row?.data ? JSON.parse(row.data) : null;
        const aid = data?.aid || '';
        if (!aid) return json({ error: 'Not found' }, 404);
        // Return only what's needed — single char key to minimize fingerprinting
        return json({ a: aid });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // ═══ PIXEL EVENTS API — query stored events ═══
    if (path === '/api/pixel/events' && method === 'GET') {
      try {
        const primaryDb = env.PIXEL_DB || env.DB;
        const domain = url.searchParams.get('domain') || '';
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
        const since = parseInt(url.searchParams.get('since') || '0', 10);

        // Query one DB binding and normalize schema differences. (param not named `db` — avoids clashing with fetch-local `const db`.)
        async function queryFromDb(d1Conn) {
          const tableExists = await d1Conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pixel_events' LIMIT 1")
            .first();
          if (!tableExists) return [];

          const schema = await d1Conn.prepare('PRAGMA table_info(pixel_events)').all();
          const columns = new Set((schema?.results || []).map((c) => String(c.name || '')));

          const tsExpr = columns.has('ts')
            ? 'ts'
            : columns.has('timestamp')
              ? "CASE WHEN CAST(timestamp AS INTEGER) > 2000000000 THEN CAST(timestamp AS INTEGER) / 1000 ELSE CAST(timestamp AS INTEGER) END"
              : columns.has('created_at')
                ? "unixepoch(created_at)"
                : '0';

          const dataExpr = columns.has('data')
            ? 'data'
            : columns.has('details')
              ? 'details'
              : "''";

          const domainExpr = columns.has('domain') ? 'domain' : "''";
          const gclidExpr = columns.has('gclid') ? 'gclid' : "''";
          const clickExpr = columns.has('click_id') ? 'click_id' : "''";

          let stmt;
          if (domain && columns.has('domain')) {
            stmt = d1Conn.prepare(
              `SELECT id, ${domainExpr} AS domain, event, ${gclidExpr} AS gclid, ${clickExpr} AS click_id, ${dataExpr} AS data, ${tsExpr} AS ts
               FROM pixel_events
               WHERE ${domainExpr} LIKE ? AND ${tsExpr} > ?
               ORDER BY ${tsExpr} DESC
               LIMIT ?`
            ).bind(`%${domain}%`, since, limit);
          } else {
            stmt = d1Conn.prepare(
              `SELECT id, ${domainExpr} AS domain, event, ${gclidExpr} AS gclid, ${clickExpr} AS click_id, ${dataExpr} AS data, ${tsExpr} AS ts
               FROM pixel_events
               WHERE ${tsExpr} > ?
               ORDER BY ${tsExpr} DESC
               LIMIT ?`
            ).bind(since, limit);
          }

          const { results } = await stmt.all();
          return (results || []).map((r) => {
            const canonicalEvent = canonicalPixelEvent(r.event);
            return {
              ...r,
              event: canonicalEvent,
              ts: Number(r.ts || 0),
              _key: `${r.domain || ''}|${canonicalEvent || ''}|${r.ts || 0}|${r.click_id || ''}|${r.gclid || ''}`,
            };
          });
        }

        const primaryRows = await queryFromDb(primaryDb);
        let merged = primaryRows;

        // Some t.{domain} routes may still hit api-worker (/e writes env.DB),
        // so merge events from DB as fallback to avoid missing rows in dashboard.
        if (env.PIXEL_DB && env.DB && env.PIXEL_DB !== env.DB) {
          const fallbackRows = await queryFromDb(env.DB);
          merged = [...primaryRows, ...fallbackRows];
        }

        const dedup = new Map();
        for (const row of merged) {
          if (!dedup.has(row._key)) dedup.set(row._key, row);
        }

        const events = Array.from(dedup.values())
          .sort((a, b) => Number(b.ts || 0) - Number(a.ts || 0))
          .slice(0, limit)
          .map(({ _key, ...rest }) => rest);

        return json({ success: true, events, count: events.length });
      } catch (e) {
        return json({ success: false, error: e.message }, 500);
      }
    }

    // ═══ PIXEL CRAWLER / BOT UA SUMMARY — Google crawler–like hits on t.{domain}/e ═══
    // Uses stored User-Agent on pixel_events (see /e handler). Not a full LP HTML crawl log.
    if (path === '/api/pixel/crawler-health' && method === 'GET') {
      try {
        const domain = String(url.searchParams.get('domain') || '').trim();
        const sinceParam = parseInt(url.searchParams.get('since') || '0', 10);
        const since = Number.isFinite(sinceParam) && sinceParam > 0 ? sinceParam : 0;

        async function aggregateCrawlerHits(d1Conn) {
          const tableExists = await d1Conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='pixel_events' LIMIT 1")
            .first();
          if (!tableExists) return null;

          // Legacy pixel_worker schema omitted ua; add column so crawler stats and /e inserts can use it.
          try {
            await d1Conn.prepare('ALTER TABLE pixel_events ADD COLUMN ua TEXT').run();
          } catch (_e) {
            /* column already exists */
          }

          const schema = await d1Conn.prepare('PRAGMA table_info(pixel_events)').all();
          const columns = new Set((schema?.results || []).map((c) => String(c.name || '')));
          if (!columns.has('ua')) {
            return { unsupported: true };
          }

          const tsExpr = columns.has('ts')
            ? 'ts'
            : columns.has('timestamp')
              ? "CASE WHEN CAST(timestamp AS INTEGER) > 2000000000 THEN CAST(timestamp AS INTEGER) / 1000 ELSE CAST(timestamp AS INTEGER) END"
              : columns.has('created_at')
                ? "unixepoch(created_at)"
                : '0';

          const domainExpr = columns.has('domain') ? 'domain' : "''";
          const uaExpr = 'LOWER(COALESCE(ua, \'\'))';

          let where = `${tsExpr} > ?`;
          const binds = [since];
          if (domain) {
            where += ` AND ${domainExpr} LIKE ?`;
            binds.push(`%${domain}%`);
          }

          const stmt = d1Conn.prepare(
            `SELECT
              COUNT(*) AS total_rows,
              SUM(CASE WHEN LENGTH(TRIM(COALESCE(ua, ''))) > 0 THEN 1 ELSE 0 END) AS rows_with_ua,
              SUM(CASE WHEN ${uaExpr} LIKE '%adsbot-google%' THEN 1 ELSE 0 END) AS adsbot_google,
              SUM(CASE WHEN ${uaExpr} LIKE '%mediapartners-google%' THEN 1 ELSE 0 END) AS mediapartners_google,
              SUM(CASE WHEN ${uaExpr} LIKE '%googlebot%' AND ${uaExpr} NOT LIKE '%adsbot-google%' THEN 1 ELSE 0 END) AS googlebot,
              SUM(CASE WHEN ${uaExpr} LIKE '%google-read-aloud%' THEN 1 ELSE 0 END) AS google_read_aloud
             FROM pixel_events
             WHERE ${where}`
          );
          const row = await stmt.bind(...binds).first();
          return { row, unsupported: false };
        }

        function mergeRows(a, b) {
          if (!a && !b) return null;
          if (!a) return b;
          if (!b) return a;
          return {
            total_rows: Number(a.total_rows || 0) + Number(b.total_rows || 0),
            rows_with_ua: Number(a.rows_with_ua || 0) + Number(b.rows_with_ua || 0),
            adsbot_google: Number(a.adsbot_google || 0) + Number(b.adsbot_google || 0),
            mediapartners_google: Number(a.mediapartners_google || 0) + Number(b.mediapartners_google || 0),
            googlebot: Number(a.googlebot || 0) + Number(b.googlebot || 0),
            google_read_aloud: Number(a.google_read_aloud || 0) + Number(b.google_read_aloud || 0),
          };
        }

        const dbList = [];
        if (env.PIXEL_DB) dbList.push(env.PIXEL_DB);
        if (env.DB && (!env.PIXEL_DB || env.DB !== env.PIXEL_DB)) dbList.push(env.DB);

        let merged = null;
        let sawTable = false;
        for (const d1Conn of dbList) {
          const result = await aggregateCrawlerHits(d1Conn);
          if (result === null) continue;
          sawTable = true;
          if (result.unsupported || !result.row) continue;
          merged = merged ? mergeRows(merged, result.row) : result.row;
        }

        if (!sawTable) {
          return json({
            success: true,
            domain: domain || null,
            since,
            buckets: null,
            disclaimer:
              'No pixel_events table yet. Events appear after traffic hits t.{domain}/e.',
          });
        }
        if (!merged) {
          return json({
            success: true,
            domain: domain || null,
            since,
            buckets: null,
            disclaimer:
              'pixel_events exists but User-Agent could not be aggregated (unexpected schema).',
          });
        }

        const r = merged || {};
        const adsbot = Number(r.adsbot_google || 0);
        const partners = Number(r.mediapartners_google || 0);
        const gbot = Number(r.googlebot || 0);
        const readAloud = Number(r.google_read_aloud || 0);
        const googleAdsRelated = adsbot + partners;

        return json({
          success: true,
          domain: domain || null,
          since,
          buckets: {
            total_pixel_events: Number(r.total_rows || 0),
            rows_with_user_agent: Number(r.rows_with_ua || 0),
            adsbot_google: adsbot,
            mediapartners_google: partners,
            google_ads_related_ua_hits: googleAdsRelated,
            googlebot: gbot,
            google_read_aloud: readAloud,
            google_crawler_ua_total: adsbot + partners + gbot + readAloud,
          },
          disclaimer:
            'Counts are requests to the first-party pixel (t.{domain}/e) whose User-Agent matches known Google crawlers (e.g. AdsBot-Google, Googlebot). Many policy checks fetch HTML without executing JS, so those visits may not hit the pixel — this is a lower bound, not full “Google Ads inspection” coverage.',
        });
      } catch (e) {
        return json({ success: false, error: e.message }, 500);
      }
    }

    // ═══ VOLUUM POSTBACKS API — query stored postbacks (t.{site}/v relay log) ═══
    if (path === '/api/postbacks' && method === 'GET') {
      return handleVoluumPostbacksApiGet(env, url);
    }

    // ═══ PROVISION DOMAIN DNS — called by deploy-lp.yml when GitHub token can't reach zone ═══
    // Uses CF credentials stored in D1 (cf_accounts + ops_domains) to create DNS records.
    if (path === '/api/provision-domain-dns' && method === 'POST') {
      try {
        const body = await request.json();
        const { domain, pagesHost } = body;
        if (!domain || !pagesHost) return json({ error: 'domain and pagesHost required' }, 400);

        const cleanDomain = String(domain).trim().toLowerCase().replace(/^www\./, '');

        // Look up domain → cf_account_id from ops_domains
        const domainRow = await db.prepare(
          "SELECT cf_account_id, zone_id FROM ops_domains WHERE domain = ? OR domain = ? LIMIT 1"
        ).bind(cleanDomain, `www.${cleanDomain}`).first().catch(() => null);

        const cfAccountRef = domainRow?.cf_account_id || '';
        if (!cfAccountRef) {
          return json({ error: `No CF account linked to ${cleanDomain} in ops_domains`, code: 'NO_CF_ACCOUNT' }, 404);
        }

        const cfRow = await resolveCloudflareAccount(db, cfAccountRef);
        if (!cfRow?.api_token || !cfRow?.account_id) {
          return json({ error: `CF account ${cfAccountRef} has no api_token in cf_accounts`, code: 'NO_CF_TOKEN' }, 404);
        }

        const cfToken = cfRow.api_token;
        const cfAccountId = cfRow.account_id;
        const cfHeaders = { Authorization: `Bearer ${cfToken}`, 'Content-Type': 'application/json' };

        // Get or create zone
        let zoneId = domainRow?.zone_id || '';
        if (!zoneId) {
          const zoneRes = await fetch(
            `https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(cleanDomain)}&account.id=${encodeURIComponent(cfAccountId)}`,
            { headers: cfHeaders }
          );
          const zoneData = await zoneRes.json().catch(() => ({}));
          zoneId = zoneData?.result?.[0]?.id || '';
        }
        if (!zoneId) {
          return json({ error: `Zone not found for ${cleanDomain}`, code: 'NO_ZONE' }, 404);
        }

        // Upsert DNS records: @, www → pagesHost (CNAME), t., link. → 192.0.2.1 (A)
        const records = [
          { type: 'CNAME', name: cleanDomain, content: pagesHost, proxied: true },
          { type: 'CNAME', name: `www.${cleanDomain}`, content: pagesHost, proxied: true },
          { type: 'A', name: `t.${cleanDomain}`, content: '192.0.2.1', proxied: true },
          { type: 'A', name: `link.${cleanDomain}`, content: '192.0.2.1', proxied: true },
        ];

        const results = [];
        for (const rec of records) {
          try {
            // Check existing
            const listRes = await fetch(
              `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?name=${encodeURIComponent(rec.name)}&type=${rec.type}`,
              { headers: cfHeaders }
            );
            const listData = await listRes.json().catch(() => ({}));
            const existing = (listData?.result || [])[0];

            if (existing && existing.content === rec.content) {
              results.push({ name: rec.name, status: 'exists' });
              continue;
            }

            // Delete conflicting records (A/AAAA/CNAME)
            const allRecs = await fetch(
              `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?name=${encodeURIComponent(rec.name)}`,
              { headers: cfHeaders }
            );
            const allData = await allRecs.json().catch(() => ({}));
            for (const old of (allData?.result || []).filter(r => ['A', 'AAAA', 'CNAME'].includes(r.type))) {
              await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${old.id}`, {
                method: 'DELETE', headers: cfHeaders,
              });
            }

            // Create
            const createRes = await fetch(
              `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`,
              {
                method: 'POST', headers: cfHeaders,
                body: JSON.stringify({ type: rec.type, name: rec.name, content: rec.content, proxied: rec.proxied, ttl: 1 }),
              }
            );
            const createData = await createRes.json().catch(() => ({}));
            results.push({ name: rec.name, status: createData?.success ? 'created' : 'error', error: createData?.errors?.[0]?.message });
          } catch (e) {
            results.push({ name: rec.name, status: 'error', error: e.message });
          }
        }

        // Also set up Workers Route for t.{domain}/* → lp-factory-api
        let routeStatus = 'skipped';
        try {
          const routeListRes = await fetch(
            `https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes`,
            { headers: cfHeaders }
          );
          const routeListData = await routeListRes.json().catch(() => ({}));
          const pattern = `t.${cleanDomain}/*`;
          const existingRoute = (routeListData?.result || []).find(r => r.pattern === pattern);
          if (existingRoute) {
            routeStatus = 'exists';
          } else {
            const routeRes = await fetch(
              `https://api.cloudflare.com/client/v4/zones/${zoneId}/workers/routes`,
              {
                method: 'POST', headers: cfHeaders,
                body: JSON.stringify({ pattern, script: 'lp-factory-api' }),
              }
            );
            const routeData = await routeRes.json().catch(() => ({}));
            routeStatus = routeData?.success ? 'created' : `error: ${routeData?.errors?.[0]?.message || 'unknown'}`;
          }
        } catch (e) {
          routeStatus = `error: ${e.message}`;
        }

        return json({ success: true, domain: cleanDomain, zoneId, records: results, workerRoute: routeStatus });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // ═══ PROXY ROUTES (no auth required — proxy forwards auth headers) ═══
    if (path.startsWith('/api/proxy/')) {
      const proxyRes = await handleProxy(request, url, env);
      if (proxyRes) return proxyRes;
    }

    // ═══ VPS DEPLOY (SSH via Worker — limited, returns instructions) ═══
    if (path === '/api/deploy/vps' && method === 'POST') {
      // CF Workers cannot open SSH connections.
      // This endpoint writes the HTML to a KV/R2 download link,
      // then returns instructions for the user to rsync it manually.
      try {
        const body = await request.json();
        const { html, host, user, remotePath, siteName } = body;
        if (!html) return json({ error: 'Missing html in body' }, 400);

        // Store HTML temporarily in D1 for download
        const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
        await env.DB.prepare(
          'INSERT OR REPLACE INTO vps_deploys (id, html, host, created_at) VALUES (?, ?, ?, ?)'
        ).bind(id, html, host || 'unknown', new Date().toISOString()).run().catch(() => { });

        const downloadUrl = `${url.origin}/api/deploy/vps/download/${id}`;
        const sshCmd = `curl -sL "${downloadUrl}" -o /tmp/index.html && scp /tmp/index.html ${user}@${host}:${remotePath}/index.html`;

        return json({
          success: true,
          url: `http://${host}${remotePath?.endsWith('/') ? remotePath : (remotePath || '/') + '/'}`,
          downloadUrl,
          sshCommand: sshCmd,
          note: 'CF Workers cannot SSH directly. Use the download URL or command above.',
        });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // VPS deploy download endpoint
    if (path.startsWith('/api/deploy/vps/download/') && method === 'GET') {
      const id = path.split('/').pop();
      try {
        const row = await env.DB.prepare('SELECT html FROM vps_deploys WHERE id = ?').bind(id).first();
        if (!row) return json({ error: 'Not found or expired' }, 404);
        return new Response(row.html, {
          headers: { 'Content-Type': 'text/html; charset=utf-8', ...corsHeaders },
        });
      } catch (e) {
        return json({ error: e.message }, 500);
      }
    }

    // ═══ OPENAPI SPEC (public — for API discovery) ═══
    {
      const openapiRes = handleOpenApiRoute({ path, method });
      if (openapiRes) return openapiRes;
    }

    // Auth check:
    // - MCP routes use their own x-mcp-secret header auth (skip global Bearer check).
    // - Preferred: Bearer auth via API_SECRET.
    // - Browser UI fallback: allow trusted origins for /api routes (localhost/pages).
    // - If API_SECRET is missing, still require trusted origin for non-public routes.
    const isMcpRoute = path.startsWith('/api/mcp/');
    if (env.API_SECRET && !isMcpRoute) {
      const auth = request.headers.get('Authorization');
      const hasValidBearer = !!auth && auth === `Bearer ${env.API_SECRET}`;
      const isTrustedApiOrigin = path.startsWith('/api/') && isTrustedOriginRequest(request, url, env);
      if (!hasValidBearer && !isTrustedApiOrigin) {
        return json({ error: 'Unauthorized (missing/invalid Bearer and untrusted origin)' }, 401);
      }
    } else if (path.startsWith('/api/') && !isMcpRoute) {
      const publicNoAuth = new Set(['/api/openapi.json']);
      // No API_SECRET: do not exempt /api/ai/* or /api/settings — require trusted origin like other routes.
      if (!publicNoAuth.has(path) && !isTrustedOriginRequest(request, url, env)) {
        return json({ error: 'Unauthorized (untrusted origin, API_SECRET not configured)' }, 401);
      }
    }

    const neonSql = getNeonSql(env);
    if (neonSql) {
      ensureNeonTables(neonSql).catch(() => {});
    }

    try {
      // ═══ SITES / DEPLOYS / VARIANTS / OPS ═══
      {
        const sitesRes = await handleSitesRoute({ request, db, neonSql, path, method });
        if (sitesRes) return sitesRes;
      }

      // ═══ MCP ONLINE TEMPLATE IMPORT ═══
      // POST /api/mcp/templates — receive a template from MCP server (fusion-mcp / Bolt.new)
      if (path === '/api/mcp/templates' && method === 'POST') {
        await ensureTemplateManagerSchema(db);
        const body = await request.json();

        // Validate MCP shared secret (optional, set MCP_SHARED_SECRET in wrangler.toml)
        const mcpSecret = env.MCP_SHARED_SECRET || '';
        if (mcpSecret) {
          const incomingSecret = request.headers.get('x-mcp-secret') || '';
          if (incomingSecret !== mcpSecret) {
            return json({ error: 'Invalid MCP secret' }, 401);
          }
        }

        // Required fields
        const templateId = String(body.templateId || body.template_id || '').trim();
        const name = String(body.name || '').trim();
        if (!templateId || !name) {
          return json({ error: 'templateId and name are required' }, 400);
        }
        if (!isValidTemplateId(templateId)) {
          return json({ error: 'Invalid templateId. Use letters, numbers, and hyphens (2-64 chars).' }, 400);
        }

        const id = body.id || uid();
        const now = new Date().toISOString();
        const filesJson = body.files ? JSON.stringify(body.files) : '{}';
        const statusRaw = String(body.status || '').trim().toLowerCase();
        const allowedStatuses = ['draft', 'active', 'deprecated', 'archived'];
        const hasExplicitStatus = Object.prototype.hasOwnProperty.call(body, 'status') && statusRaw !== '';
        const status = allowedStatuses.includes(statusRaw) ? statusRaw : 'draft';
        const source = String(body.source || 'mcp').toLowerCase();
        const badge = String(body.badge || (source === 'bolt' ? 'Bolt' : 'MCP')).trim() || (source === 'bolt' ? 'Bolt' : 'MCP');

        // Check duplicate
        const existing = await db.prepare(
          'SELECT id FROM templates WHERE template_id = ? AND COALESCE(is_deleted, 0) = 0'
        ).bind(templateId).first();

        const resolvedCategory = resolveCategory(body.category, templateId, name, body.description, body.files);

        if (existing) {
          // Update existing template (status is only updated when explicitly provided)
          if (hasExplicitStatus) {
            await db.prepare(`
              UPDATE templates SET
                name = ?, description = ?, category = ?, badge = ?,
                source_code = ?, files = ?, status = ?, archived_at = ?, updated_at = ?
              WHERE id = ?
            `).bind(
              name,
              body.description || '',
              resolvedCategory,
              badge,
              body.sourceCode || body.source_code || '',
              filesJson,
              status,
              status === 'archived' ? now : null,
              now,
              existing.id
            ).run();
          } else {
            await db.prepare(`
              UPDATE templates SET
                name = ?, description = ?, category = ?, badge = ?,
                source_code = ?, files = ?, updated_at = ?
              WHERE id = ?
            `).bind(
              name,
              body.description || '',
              resolvedCategory,
              badge,
              body.sourceCode || body.source_code || '',
              filesJson,
              now,
              existing.id
            ).run();
          }

          const updated = await db.prepare('SELECT * FROM templates WHERE id = ?').bind(existing.id).first();
          if (updated) {
            await createTemplateVersionSnapshot(db, updated, `Updated via MCP (${source})`);
          }
          return json({ id: existing.id, action: 'updated', success: true, status: hasExplicitStatus ? status : undefined });
        }

        // Insert new template
        try {
          await db.prepare(`
            INSERT INTO templates (
              id, template_id, name, description, category, badge,
              source_code, files, created_at, updated_at, is_deleted, status, current_version, archived_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 1, ?)
          `).bind(
            id, templateId, name,
            body.description || '',
            resolvedCategory,
            badge,
            body.sourceCode || body.source_code || '',
            filesJson, now, now, status, status === 'archived' ? now : null
          ).run();
        } catch (insertErr) {
          if (String(insertErr?.message || '').includes('UNIQUE constraint failed')) {
            return json({ error: `Template ID "${templateId}" already exists.` }, 400);
          }
          throw insertErr;
        }

        const templateRow = await db.prepare('SELECT * FROM templates WHERE id = ?').bind(id).first();
        if (templateRow) {
          await createTemplateVersionSnapshot(db, templateRow, `Imported via MCP (${source})`);
        }

        return json({ id, action: 'created', success: true, status }, 201);
      }

      // GET /api/mcp/templates — list templates (lightweight, for MCP server to poll)
      if (path === '/api/mcp/templates' && method === 'GET') {
        await ensureTemplateManagerSchema(db);
        const mcpSecret = env.MCP_SHARED_SECRET || '';
        if (mcpSecret) {
          const incomingSecret = request.headers.get('x-mcp-secret') || '';
          if (incomingSecret !== mcpSecret) {
            return json({ error: 'Invalid MCP secret' }, 401);
          }
        }
        const { results } = await db.prepare(
          'SELECT id, template_id, name, description, category, badge, status, created_at, updated_at FROM templates WHERE COALESCE(is_deleted, 0) = 0 ORDER BY created_at DESC'
        ).all();
        return json({ ok: true, data: results || [], total: (results || []).length });
      }

      // ═══ TEMPLATES ═══
      if (path === '/api/templates' && method === 'GET') {
        await ensureTemplateManagerSchema(db);
        const includeArchived = String(url.searchParams.get('includeArchived') || '') === '1';
        const statusFilter = String(url.searchParams.get('status') || '').trim().toLowerCase();
        const usageMap = await getTemplateUsageMap(db);
        const baseSql = includeArchived
          ? 'SELECT * FROM templates WHERE COALESCE(is_deleted, 0) = 0 ORDER BY created_at DESC'
          : 'SELECT * FROM templates WHERE COALESCE(is_deleted, 0) = 0 AND COALESCE(status, "draft") != "archived" ORDER BY created_at DESC';
        const { results } = await db.prepare(baseSql).all();
        const rows = (results || [])
          .filter((r) => !statusFilter || String(r.status || 'draft').toLowerCase() === statusFilter)
          .map((row) => ({
            ...row,
            usage_count: Number(usageMap[String(row.template_id || '').trim()] || 0),
            files: parseTemplateFiles(row.files),
          }));
        return json(rows);
      }

      if (path === '/api/templates' && method === 'POST') {
        // Default 40 MiB: template imports as JSON are large; stay under Cloudflare ~100 MiB request body cap.
        const CF_BODY_CEILING = 99 * 1024 * 1024;
        const defaultPostMax = 40 * 1024 * 1024;
        const parsedMax = parseInt(String(env.TEMPLATE_POST_MAX_BYTES || ''), 10);
        const POST_TEMPLATE_BODY_LIMIT = Number.isFinite(parsedMax) && parsedMax >= 256 * 1024
          ? Math.min(parsedMax, CF_BODY_CEILING)
          : defaultPostMax;
        let templateIdForLog = '';
        try {
          await ensureTemplateManagerSchema(db);
          const rawBody = await request.text();
          templateIdForLog = '(parse pending)';
          if (rawBody.length > POST_TEMPLATE_BODY_LIMIT) {
            console.error('[POST /api/templates]', { bytes: rawBody.length, limit: POST_TEMPLATE_BODY_LIMIT, code: 'PAYLOAD_TOO_LARGE' });
            return json({
              error: `Template JSON exceeds ${POST_TEMPLATE_BODY_LIMIT} bytes (current: ${rawBody.length}). Trim files, omit node_modules from import, push large repos to GitHub only, or raise TEMPLATE_POST_MAX_BYTES in Worker env (max ~${CF_BODY_CEILING}).`,
              code: 'PAYLOAD_TOO_LARGE',
              bytes: rawBody.length,
              limit: POST_TEMPLATE_BODY_LIMIT,
            }, 413);
          }

          let body;
          try {
            body = JSON.parse(rawBody || '{}');
          } catch (parseErr) {
            console.error('[POST /api/templates]', { phase: 'json_parse', message: parseErr?.message });
            return json({
              error: 'Invalid JSON in request body',
              code: 'INVALID_JSON',
              detail: String(parseErr?.message || parseErr),
            }, 400);
          }

          const id = body.id || uid();
          const now = new Date().toISOString();
          const templateId = String(body.templateId || '').trim();
          templateIdForLog = templateId || '(empty)';

          const status = String(body.status || 'draft').toLowerCase();
          const normalizedStatus = ['draft', 'active', 'deprecated', 'archived'].includes(status) ? status : 'draft';
          if (!isValidTemplateId(templateId)) {
            return json({ error: 'Invalid templateId. Use letters, numbers, and hyphens (2-64 chars).' }, 400);
          }

          const existing = await db.prepare('SELECT id FROM templates WHERE template_id = ? AND COALESCE(is_deleted, 0) = 0').bind(templateId).first();
          if (existing) {
            return json({ error: 'Template ID already exists' }, 400);
          }

          const filesJson = body.files ? JSON.stringify(body.files) : '{}';
          const postCategory = resolveCategory(body.category, templateId, body.name, body.description, body.files);
          try {
            await db.prepare(`
            INSERT INTO templates (
              id, template_id, name, description, category, badge,
              source_code, files, created_at, updated_at, is_deleted, status, current_version, archived_at,
              family_id, variant_label
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 1, ?, ?, ?)
          `).bind(
              id,
              templateId,
              body.name || '',
              body.description || '',
              postCategory,
              body.badge || 'New',
              body.sourceCode || '',
              filesJson,
              now,
              now,
              normalizedStatus,
              normalizedStatus === 'archived' ? now : null,
              body.familyId || null,
              body.variantLabel || null
            ).run();
          } catch (insertErr) {
            const im = String(insertErr?.message || '');
            if (im.includes('UNIQUE constraint failed') && /template_id/i.test(im)) {
              return json({ error: `Template ID "${templateId}" already exists. Choose a different ID.` }, 400);
            }
            return jsonFromTemplatePostException(insertErr, { phase: 'insert', templateId });
          }

          const templateRow = await db.prepare('SELECT * FROM templates WHERE id = ?').bind(id).first();
          if (templateRow) {
            try {
              await createTemplateVersionSnapshot(db, templateRow, body.note || 'Initial version');
            } catch (snapErr) {
              return jsonFromTemplatePostException(snapErr, {
                phase: 'version_snapshot',
                templateId,
                rowId: id,
                note: 'Template row was inserted; initial version snapshot failed.',
              });
            }
          }

          return json({ id, success: true }, 201);
        } catch (err) {
          return jsonFromTemplatePostException(err, { phase: 'unknown', templateId: templateIdForLog });
        }
      }

      if (path.match(/^\/api\/templates\/(?!default$)[\w-]+$/) && method === 'GET') {
        await ensureTemplateManagerSchema(db);
        const id = path.split('/').pop();
        const template = await db.prepare('SELECT * FROM templates WHERE id = ? AND COALESCE(is_deleted, 0) = 0').bind(id).first();
        if (!template) return json({ error: 'Template not found' }, 404);
        return json({ ...template, files: parseTemplateFiles(template.files) });
      }

      if (path.match(/^\/api\/templates\/(?!default$)[\w-]+$/) && method === 'PUT') {
        await ensureTemplateManagerSchema(db);
        const id = path.split('/').pop();
        const body = await request.json();
        const row = await db.prepare('SELECT * FROM templates WHERE id = ? AND COALESCE(is_deleted, 0) = 0').bind(id).first();
        if (!row) return json({ error: 'Template not found' }, 404);

        const fields = [];
        const values = [];
        const status = body.status ? String(body.status).toLowerCase() : '';

        if (Object.prototype.hasOwnProperty.call(body, 'templateId')) {
          const nextTemplateId = String(body.templateId || '').trim();
          if (!isValidTemplateId(nextTemplateId)) {
            return json({ error: 'Invalid templateId. Use letters, numbers, and hyphens (2-64 chars).' }, 400);
          }
          const duplicate = await db.prepare('SELECT id FROM templates WHERE template_id = ? AND id != ? AND COALESCE(is_deleted, 0) = 0')
            .bind(nextTemplateId, id).first();
          if (duplicate) {
            return json({ error: 'Template ID already exists' }, 400);
          }
          fields.push('template_id = ?');
          values.push(nextTemplateId);
        }
        if (Object.prototype.hasOwnProperty.call(body, 'name')) { fields.push('name = ?'); values.push(body.name || ''); }
        if (Object.prototype.hasOwnProperty.call(body, 'description')) { fields.push('description = ?'); values.push(body.description || ''); }
        if (Object.prototype.hasOwnProperty.call(body, 'category')) {
          const putCat = resolveCategory(body.category, row.template_id, body.name || row.name, body.description || row.description, body.files || null);
          fields.push('category = ?'); values.push(putCat);
        }
        if (Object.prototype.hasOwnProperty.call(body, 'badge')) { fields.push('badge = ?'); values.push(body.badge || 'New'); }
        if (Object.prototype.hasOwnProperty.call(body, 'familyId')) { fields.push('family_id = ?'); values.push(body.familyId || null); }
        if (Object.prototype.hasOwnProperty.call(body, 'variantLabel')) { fields.push('variant_label = ?'); values.push(body.variantLabel || null); }
        if (Object.prototype.hasOwnProperty.call(body, 'sourceCode')) { fields.push('source_code = ?'); values.push(body.sourceCode || ''); }
        if (Object.prototype.hasOwnProperty.call(body, 'files')) { fields.push('files = ?'); values.push(JSON.stringify(body.files || {})); }
        if (status && ['draft', 'active', 'deprecated', 'archived'].includes(status)) {
          fields.push('status = ?');
          values.push(status);
          if (status === 'archived') {
            fields.push('archived_at = datetime(\'now\')');
          } else {
            fields.push('archived_at = NULL');
          }
        }

        if (fields.length > 0) {
          fields.push('updated_at = datetime(\'now\')');
          values.push(id);
          await db.prepare(`UPDATE templates SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
        }

        const updated = await db.prepare('SELECT * FROM templates WHERE id = ?').bind(id).first();
        let versionNumber = updated?.current_version || 1;
        if (body.createVersion === true && updated) {
          versionNumber = await createTemplateVersionSnapshot(db, updated, body.note || 'Manual version');
        }

        return json({
          success: true,
          id,
          versionNumber,
          template: updated ? { ...updated, files: parseTemplateFiles(updated.files) } : null,
        });
      }

      if (path.match(/^\/api\/templates\/(?!default$)[\w-]+$/) && method === 'DELETE') {
        await ensureTemplateManagerSchema(db);
        const id = path.split('/').pop();
        const row = await db.prepare('SELECT id, template_id FROM templates WHERE id = ?').bind(id).first();
        if (!row) return json({ error: 'Template not found' }, 404);

        let inUseCount = 0;
        try {
          const usage = await db.prepare(`
            WITH latest AS (
              SELECT site_id, MAX(version_number) AS max_v
              FROM site_versions
              GROUP BY site_id
            )
            SELECT COUNT(*) AS c
            FROM latest l
            JOIN site_versions sv
              ON sv.site_id = l.site_id
             AND sv.version_number = l.max_v
            WHERE json_extract(sv.config_json, '$.templateId') = ?
          `).bind(row.template_id || '').first();
          inUseCount = Number(usage?.c || 0);
        } catch (_e) {
          inUseCount = 0;
        }
        if (inUseCount > 0) {
          return json({ error: `Cannot delete template. It is in use by ${inUseCount} active site(s).` }, 400);
        }

        await db.prepare('UPDATE templates SET is_deleted = 1, status = "archived", archived_at = datetime(\'now\'), updated_at = datetime(\'now\') WHERE id = ?')
          .bind(id).run();
        return json({ success: true });
      }

      if (path.match(/^\/api\/templates\/[\w-]+\/usage$/) && method === 'GET') {
        await ensureTemplateManagerSchema(db);
        const id = path.split('/')[3];
        const row = await db.prepare('SELECT id, template_id FROM templates WHERE id = ? AND COALESCE(is_deleted, 0) = 0').bind(id).first();
        if (!row) return json({ error: 'Template not found' }, 404);
        const tplId = row.template_id || '';

        let sites = [];
        try {
          const { results } = await db.prepare(`
            WITH latest AS (
              SELECT site_id, MAX(version_number) AS max_v
              FROM site_versions
              GROUP BY site_id
            )
            SELECT
              s.id AS site_id,
              s.brand AS brand,
              s.domain AS domain,
              json_extract(sv.config_json, '$.templateId') AS template_id
            FROM latest l
            JOIN site_versions sv
              ON sv.site_id = l.site_id
             AND sv.version_number = l.max_v
            LEFT JOIN sites s ON s.id = l.site_id
            WHERE json_extract(sv.config_json, '$.templateId') = ?
            ORDER BY s.created_at DESC
          `).bind(tplId).all();
          sites = (results || []).map((r) => ({
            siteId: r.site_id || '',
            brand: r.brand || '',
            domain: r.domain || '',
            templateId: r.template_id || '',
          }));
        } catch (_e) {
          sites = [];
        }

        return json({ success: true, templateId: tplId, usageCount: sites.length, sites });
      }

      if (path.match(/^\/api\/templates\/[\w-]+\/versions$/) && method === 'GET') {
        await ensureTemplateManagerSchema(db);
        const id = path.split('/')[3];
        const row = await db.prepare('SELECT id FROM templates WHERE id = ? AND COALESCE(is_deleted, 0) = 0').bind(id).first();
        if (!row) return json({ error: 'Template not found' }, 404);
        const { results } = await db
          .prepare('SELECT id, template_db_id, template_id, version_number, note, created_at FROM template_versions WHERE template_db_id = ? ORDER BY version_number DESC')
          .bind(id).all();
        return json({ success: true, versions: results || [] });
      }

      if (path.match(/^\/api\/templates\/[\w-]+\/publish$/) && method === 'POST') {
        await ensureTemplateManagerSchema(db);
        const id = path.split('/')[3];
        const body = await request.json().catch(() => ({}));
        const requestedVersion = Number(body.version || 0);
        const row = await db.prepare('SELECT * FROM templates WHERE id = ? AND COALESCE(is_deleted, 0) = 0').bind(id).first();
        if (!row) return json({ error: 'Template not found' }, 404);

        let version = null;
        if (requestedVersion > 0) {
          version = await db.prepare('SELECT * FROM template_versions WHERE template_db_id = ? AND version_number = ?')
            .bind(id, requestedVersion).first();
          if (!version) return json({ error: 'Version not found' }, 404);
          const quality = getTemplateQualityGateReport({
            files: parseTemplateFiles(version.files),
            sourceCode: version.source_code || '',
            category: version.category || row.category || '',
          });
          if (!quality.pass) {
            return json({ error: 'Publish blocked by quality gate', quality }, 400);
          }
          await db.prepare(`
            UPDATE templates
            SET name = ?, description = ?, category = ?, badge = ?, source_code = ?, files = ?, current_version = ?, status = 'active', archived_at = NULL, updated_at = datetime('now')
            WHERE id = ?
          `).bind(
            version.name || '',
            version.description || '',
            version.category || 'general',
            version.badge || 'New',
            version.source_code || '',
            version.files || '{}',
            requestedVersion,
            id
          ).run();
        } else {
          const quality = getTemplateQualityGateReport({
            files: parseTemplateFiles(row.files),
            sourceCode: row.source_code || '',
            category: row.category || '',
          });
          if (!quality.pass) {
            return json({ error: 'Publish blocked by quality gate', quality }, 400);
          }
          await db.prepare('UPDATE templates SET status = "active", archived_at = NULL, updated_at = datetime(\'now\') WHERE id = ?').bind(id).run();
        }

        return json({ success: true, id, publishedVersion: requestedVersion || row.current_version || 1 });
      }

      if (path.match(/^\/api\/templates\/[\w-]+\/rollback$/) && method === 'POST') {
        await ensureTemplateManagerSchema(db);
        const id = path.split('/')[3];
        const body = await request.json().catch(() => ({}));
        const targetVersion = Number(body.version || 0);
        if (!targetVersion) return json({ error: 'Missing version' }, 400);

        const version = await db.prepare('SELECT * FROM template_versions WHERE template_db_id = ? AND version_number = ?')
          .bind(id, targetVersion).first();
        if (!version) return json({ error: 'Version not found' }, 404);

        await db.prepare(`
          UPDATE templates
          SET name = ?, description = ?, category = ?, badge = ?, source_code = ?, files = ?, current_version = ?, status = 'active', archived_at = NULL, updated_at = datetime('now')
          WHERE id = ?
        `).bind(
          version.name || '',
          version.description || '',
          version.category || 'general',
          version.badge || 'New',
          version.source_code || '',
          version.files || '{}',
          targetVersion,
          id
        ).run();

        return json({ success: true, id, rolledBackTo: targetVersion });
      }

      if (path === '/api/templates/default' && method === 'GET') {
        const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind('defaultTemplateId').first();
        return json({ success: true, templateId: row?.value || 'classic' });
      }

      if (path === '/api/templates/default' && method === 'PUT') {
        const body = await request.json().catch(() => ({}));
        const templateId = String(body.templateId || '').trim();
        if (!templateId) return json({ error: 'Missing templateId' }, 400);
        const existsInDb = await db.prepare('SELECT id FROM templates WHERE template_id = ? AND COALESCE(is_deleted, 0) = 0 AND COALESCE(status, "draft") != "archived" LIMIT 1')
          .bind(templateId).first();
        if (!existsInDb && !BUILTIN_TEMPLATE_IDS.has(templateId)) {
          return json({ error: 'Template not found or archived' }, 400);
        }
        await db.prepare('INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime(\'now\')) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime(\'now\')')
          .bind('defaultTemplateId', templateId).run();
        return json({ success: true, templateId });
      }

      // ═══ INIT / STATS — Bootstrap Endpoints ═══
      // Returns settings + sites + deploys + ops for the app to hydrate on load.
      // /api/init-legacy: legacy bootstrap (settings + sites + deploys + ops)
      // /api/stats: lightweight stats
      // /api/init: full bootstrap (handler dispatch below also matches both)
      {
        const initRes = await handleInitRoute({ db, path, method });
        if (initRes) return initRes;
      }

      // ═══ SETTINGS ═══
      if (path === '/api/settings' && method === 'GET') {
        const { results } = await db.prepare('SELECT * FROM settings').all();
        const obj = {};
        results.forEach(r => { obj[r.key] = r.value; });
        return json(obj);
      }

      if (path === '/api/settings' && method === 'POST') {
        const body = await request.json();
        for (const [key, value] of Object.entries(body)) {
          await db.prepare(`
            INSERT INTO settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')
          `).bind(key, String(value), String(value)).run();
        }

        if (neonSql) {
          neonUpsertSettings(neonSql, body).catch(() => {});
        }
        return json({ success: true });
      }

      // ═══ ADSPOWER — server relay (HTTPS dashboard → user’s HTTPS tunnel → Local API) ═══
      if (path === "/api/adspower/proxy" && method === "POST") {
        try {
          const body = await request.json();
          const subPath = String(body.path || "/status");
          const m = String(body.method || "GET").toUpperCase();
          if (!subPath.startsWith("/") || subPath.includes("..")) {
            return json({ code: -1, msg: "Invalid path" }, 400);
          }
          const pathOnly = subPath.split("?")[0];
          const allowed = new Set([
            "/status",
            "/api/v2/browser-profile/list",
            "/api/v2/browser-profile/start",
            "/api/v2/browser-profile/stop",
          ]);
          if (!allowed.has(pathOnly)) {
            return json({ code: -1, msg: "Path not allowed" }, 400);
          }
          if (pathOnly === "/status" && m !== "GET") {
            return json({ code: -1, msg: "GET only for /status" }, 400);
          }
          if (pathOnly !== "/status" && m !== "POST") {
            return json({ code: -1, msg: "POST required for this endpoint" }, 400);
          }

          const baseRow = await db.prepare("SELECT value FROM settings WHERE key = ?").bind("adspowerLocalBase").first();
          const keyRow = await db.prepare("SELECT value FROM settings WHERE key = ?").bind("adspowerApiKey").first();
          const fromBodyBase = String(body.adspowerLocalBase ?? "").trim().replace(/\/+$/, "");
          const fromD1Base = String(baseRow?.value ?? "").trim().replace(/\/+$/, "");
          const base = fromBodyBase || fromD1Base;
          if (!base) {
            return json({
              code: -1,
              msg: "ยังไม่มี Base URL — ใส่ในฟอร์มหรือ Save ใน Settings → Automation (HTTPS tunnel)",
            });
          }
          if (!/^https:\/\//i.test(base)) {
            return json({
              code: -1,
              msg: "Base URL ต้องเป็น https:// (Worker เรียกจาก Cloudflare ไม่ถึง http://127.0.0.1)",
            });
          }

          const fromBodyKey = String(body.adspowerApiKey ?? "").trim();
          const fromD1Key = String(keyRow?.value ?? "").trim();
          const apiKey = fromBodyKey || fromD1Key;

          const headers = { Accept: "application/json" };
          if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

          const targetUrl = `${base}${subPath}`;
          const init = { method: m, headers, redirect: "manual" };
          if (m === "POST") {
            headers["Content-Type"] = "application/json";
            const payload = body.body != null && typeof body.body === "object" && !Array.isArray(body.body) ? body.body : {};
            init.body = JSON.stringify(payload);
          }

          const res = await fetch(targetUrl, init);
          const text = await res.text();
          let data;
          try {
            data = text ? JSON.parse(text) : {};
          } catch {
            data = { code: -1, msg: String(text || "").slice(0, 400) || `HTTP ${res.status}` };
          }
          if (!res.ok && (data.code === undefined || data.code === null) && !data.msg) {
            data = { code: -1, msg: `HTTP ${res.status}` };
          }
          return json(data);
        } catch (e) {
          return json({ code: -1, msg: `AdsPower relay: ${e.message || String(e)}` });
        }
      }

      // ═══ AI: GENERATE ASSETS ═══
      if (path === "/api/ai/generate-assets" && method === "POST") {
        const body = await request.json();
        const settingsRes = await db.prepare("SELECT * FROM settings WHERE key = 'geminiKey'").first();
        const key = settingsRes?.value;
        if (!key) return json({ error: "Gemini Key not configured" }, 400);

        const type = body.type || "logo";
        const promptGen = `Act as an expert AI prompt engineer.Create a highly detailed, professional prompt for an image generator(DALL - E 3 style).
            Brand: "${body.brand}"
          Context: "${type === 'logo' ? 'Fintech logo design' : 'High-converting hero background for loan site'}"
          Style: "${body.style || 'Modern & Clean'}"
          Requirements: ${type === 'logo' ? 'Flat vector, minimalist, white background, no text except brand' : 'Photorealistic, soft lighting, lots of copy space, 16:9'}
          Output: ONLY the refined prompt text.No chatter.`;

        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: promptGen }] }] })
        });
        const d = await res.json();
        const refinedPrompt = d.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "Modern fintech visual";

        const imageUrl = `https://pollinations.ai/p/${encodeURIComponent(refinedPrompt)}?width=${type === 'logo' ? 512 : 1280}&height=${type === 'logo' ? 512 : 720}&nologo=true&seed=${Math.floor(Math.random() * 1000)}`;

        return json({ url: imageUrl, prompt: refinedPrompt });
      }

      // ═══ CF ACCOUNTS ═══
      if (path === "/api/cf-accounts" && method === "GET") {
        const { results } = await db.prepare("SELECT * FROM cf_accounts ORDER BY label ASC").all();
        return json(results);
      }
      if (path === "/api/cf-accounts" && method === "POST") {
        const body = await request.json();
        const id = body.id || uid();
        await db.prepare("INSERT INTO cf_accounts (id, email, api_key, api_token, account_id, label) VALUES (?, ?, ?, ?, ?, ?)")
          .bind(id, body.email || "", body.apiKey || "", body.apiToken || "", body.accountId || "", body.label || "").run();
        return json({ id, success: true }, 201);
      }
      if (path.match(/^\/api\/cf-accounts\/[\w-]+$/) && method === "PUT") {
        const id = path.split("/").pop();
        const body = await request.json();
        await db.prepare("UPDATE cf_accounts SET email = ?, api_key = ?, api_token = ?, account_id = ?, label = ? WHERE id = ?")
          .bind(body.email || "", body.apiKey || "", body.apiToken || "", body.accountId || "", body.label || "", id).run();
        return json({ success: true });
      }
      if (path.match(/^\/api\/cf-accounts\/[\w-]+$/) && method === "DELETE") {
        const id = path.split("/").pop();
        await db.prepare("DELETE FROM cf_accounts WHERE id = ?").bind(id).run();
        return json({ success: true });
      }

      // ═══ REGISTRAR ACCOUNTS ═══
      if (path === "/api/registrar-accounts" && method === "GET") {
        const { results } = await db.prepare("SELECT * FROM registrar_accounts ORDER BY provider ASC, label ASC").all();
        return json(results);
      }
      if (path === "/api/registrar-accounts" && method === "POST") {
        const body = await request.json();
        const id = body.id || uid();
        await db.prepare("INSERT INTO registrar_accounts (id, provider, label, api_key, secret_key) VALUES (?, ?, ?, ?, ?)")
          .bind(id, body.provider || "internetbs", body.label || "", body.apiKey || "", body.secretKey || "").run();
        await db.prepare('INSERT INTO ops_logs (id, msg) VALUES (?, ?)').bind(uid(), `Added registrar account: ${body.label || body.provider}`).run();
        return json({ id, success: true }, 201);
      }
      if (path.match(/^\/api\/registrar-accounts\/[\w-]+$/) && method === "PUT") {
        const id = path.split("/").pop();
        const body = await request.json();
        await db.prepare("UPDATE registrar_accounts SET provider = ?, label = ?, api_key = ?, secret_key = ? WHERE id = ?")
          .bind(body.provider || "internetbs", body.label || "", body.apiKey || "", body.secretKey || "", id).run();
        await db.prepare('INSERT INTO ops_logs (id, msg) VALUES (?, ?)').bind(uid(), `Updated registrar account: ${body.label || body.provider}`).run();
        return json({ success: true });
      }
      if (path.match(/^\/api\/registrar-accounts\/[\w-]+$/) && method === "DELETE") {
        const id = path.split("/").pop();
        await db.prepare("DELETE FROM registrar_accounts WHERE id = ?").bind(id).run();
        return json({ success: true });
      }

      // ═══ DEPLOYMENT HISTORY ═══
      if (path === "/api/ops/deployments" && method === "GET") {
        const domain = url.searchParams.get("domain") || "";
        const status = url.searchParams.get("status") || "";
        const target = url.searchParams.get("target") || "";
        const limitRaw = url.searchParams.get("limit");
        const limit = Number.parseInt(limitRaw || "50", 10);
        let query = "SELECT * FROM ops_deployments";
        const conditions = [];
        const params = [];

        if (domain) {
          conditions.push("domain = ?");
          params.push(domain);
        }
        if (status) {
          conditions.push("status = ?");
          params.push(status);
        }
        if (target) {
          conditions.push("target = ?");
          params.push(target);
        }

        if (conditions.length > 0) {
          query += " WHERE " + conditions.join(" AND ");
        }
        query += " ORDER BY created_at DESC LIMIT " + (Number.isFinite(limit) && limit > 0 ? limit : 50);

        try {
          const stmt = db.prepare(query);
          const { results } = await stmt.bind(...params).all();
          return json((results || []).map(snakeToCamel));
        } catch (e) {
          const msg = String(e?.message || e || "");
          if (msg.includes("no such table: ops_deployments")) {
            return json([]);
          }
          throw e;
        }
      }

      if (path === "/api/ops/deployments" && method === "POST") {
        const body = await request.json();
        const id = body.id || uid();
        const now = new Date().toISOString();

        try {
          await db.prepare(`
            INSERT INTO ops_deployments (id, domain_id, domain, target, environment, url, status, config, deployed_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            id,
            body.domainId || "",
            body.domain || "",
            body.target || "",
            body.environment || "production",
            body.url || "",
            body.status || "pending",
            JSON.stringify(body.config || {}),
            body.deployedBy || "",
            now,
            now
          ).run();

          await db.prepare('INSERT INTO ops_logs (id, msg) VALUES (?, ?)')
            .bind(uid(), `Deployment started: ${body.domain} to ${body.target}`).run();

          return json({ id, success: true }, 201);
        } catch (e) {
          const msg = String(e?.message || e || "");
          if (msg.includes("no such table: ops_deployments")) {
            return json({ id: null, success: false, skipped: true, error: "ops_deployments table not found" });
          }
          throw e;
        }
      }

      if (path === "/api/ops/deployments/git-push" && method === "POST") {
        const body = await request.json();
        const siteId = body.siteId || body.domainId || uid();
        const deployRecordId = body.deployRecordId || "";
        const branch = body.branch || "main";
        const environment = body.environment || "production";
        const files = body.files && typeof body.files === "object" ? body.files : null;
        if (!files) {
          return json({ success: false, error: "Missing files payload" }, 400);
        }

        const hasIndexHtml = !!files["index.html"];
        const isAstroProject =
          (!!files["package.json"] && (!!files["astro.config.mjs"] || !!files["astro.config.ts"]))
          || !!files["src/pages/index.astro"];

        if (!hasIndexHtml && !isAstroProject) {
          return json({
            success: false,
            error: "Unsupported payload: provide index.html or an Astro project (package.json + astro.config.* or src/pages/index.astro)",
          }, 400);
        }

        const settingsRows = await db.prepare("SELECT key, value FROM settings WHERE key IN ('githubToken','githubRepoOwner','githubRepoName','githubRepoBranch','githubDeployWorkflow')").all();
        const settingsObj = {};
        (settingsRows?.results || []).forEach(r => {
          settingsObj[r.key] = r.value;
        });

        const requestToken = String(body.githubToken || "").trim();
        const token = String(
          (requestToken && !isMaskedSecret(requestToken))
            ? requestToken
            : (settingsObj.githubToken || "")
        ).trim();
        const repoOwner = String(body.repoOwner || settingsObj.githubRepoOwner || "").trim();
        const repoName = String(body.repoName || settingsObj.githubRepoName || "").trim();
        const sourceBranch = String(branch || settingsObj.githubRepoBranch || "main").trim() || "main";
        const deployBranch = "deploy/auto";

        if (!token || !repoOwner || !repoName) {
          return json({
            success: false,
            error: "GitHub pipeline not configured. Set githubToken/githubRepoOwner/githubRepoName in Settings.",
          }, 400);
        }

        const safeSiteFolder = String(siteId).replace(/[^a-zA-Z0-9_-]/g, "-");
        const basePath = `sites/${safeSiteFolder}`;
        const manifest = {
          version: 1,
          siteId,
          brand: body.brand || "",
          templateId: body.templateId || "classic",
          environment,
          targets: Array.isArray(body.targets) && body.targets.length ? body.targets : [{ provider: "github-actions" }],
          build: hasIndexHtml
            ? { entry: "index.html", extraFiles: Object.keys(files).filter(name => name !== "index.html") }
            : { entry: "astro", extraFiles: Object.keys(files) },
          tracking: {
            googleAdsId: body.tracking?.googleAdsId || "",
            pixelEndpoint: body.tracking?.pixelEndpoint || "",
            voluumDomain: body.tracking?.voluumDomain || "",
          },
          meta: {
            requestedBy: body.requestedBy || "unknown",
            requestedAt: new Date().toISOString(),
            requestId: body.requestId || uid(),
            commitMessage: body.commitMessage || `deploy(${siteId}): ${body.brand || body.domain || siteId}`,
            deployRecordId,
          },
        };

        const commitMessage = manifest.meta.commitMessage;
        const writeEntries = Object.entries(files).map(([name, content]) => {
          const cleanName = String(name || "").replace(/^\/+/, "");
          return [`${basePath}/${cleanName}`, String(content ?? "")];
        });
        writeEntries.push([`${basePath}/deploy-manifest.json`, JSON.stringify(manifest, null, 2)]);

        try {
          await ensureGithubBranch(token, repoOwner, repoName, deployBranch, sourceBranch);

          writeEntries.push(["schemas/deploy-manifest.schema.json", JSON.stringify(DEPLOY_MANIFEST_SCHEMA, null, 2)]);

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
          const commitSha = commitInfo?.sha || "";
          const commitUrl = commitInfo?.html_url || `https://github.com/${repoOwner}/${repoName}/commit/${commitSha}`;
          const workflowFile = String(body.workflowFile || settingsObj.githubDeployWorkflow || "deploy-sites.yml").trim() || "deploy-sites.yml";
          const workflowUrl = `https://github.com/${repoOwner}/${repoName}/actions/workflows/${workflowFile}`;
          let workflowDispatched = false;
          let workflowDispatchError = "";

          try {
            await githubApi(token, `/repos/${repoOwner}/${repoName}/actions/workflows/${encodeURIComponent(workflowFile)}/dispatches`, {
              method: "POST",
              body: JSON.stringify({
                ref: deployBranch,
                inputs: {
                  site_id: String(siteId),
                  environment: String(environment),
                  deploy_record_id: String(deployRecordId || ""),
                },
              }),
            });
            workflowDispatched = true;
          } catch (dispatchError) {
            workflowDispatchError = String(dispatchError?.message || dispatchError || "");
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
            message: "Artifacts committed to GitHub. CI pipeline should deploy shortly.",
          });
        } catch (e) {
          return json({
            success: false,
            error: `Git push failed: ${e?.message || e}`,
          }, 500);
        }
      }

      if (path.match(/^\/api\/ops\/deployments\/[\w-]+$/) && method === "PATCH") {
        const id = path.split("/").pop();
        const body = await request.json();
        const sets = [];
        const vals = [];

        if (body.status !== undefined) {
          sets.push("status = ?");
          vals.push(body.status);
        }
        if (body.url !== undefined) {
          sets.push("url = ?");
          vals.push(body.url);
        }
        if (body.errorMessage !== undefined) {
          sets.push("error_message = ?");
          vals.push(body.errorMessage);
        }
        if (body.durationMs !== undefined) {
          sets.push("duration_ms = ?");
          vals.push(body.durationMs);
        }

        if (sets.length > 0) {
          sets.push("updated_at = ?");
          vals.push(new Date().toISOString());
          vals.push(id);

          await db.prepare(`UPDATE ops_deployments SET ${sets.join(", ")} WHERE id = ?`)
            .bind(...vals).run();
        }

        return json({ success: true });
      }

      if (path === "/api/ops/deployments/stats" && method === "GET") {
        const domain = url.searchParams.get("domain") || "";
        const params = [];
        const baseConditions = [];
        if (domain) {
          baseConditions.push("domain = ?");
          params.push(domain);
        }
        const whereWith = (extra) => {
          const conditions = [...baseConditions];
          if (extra) conditions.push(extra);
          return conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
        };

        try {
          const totalStmt = db.prepare(`SELECT COUNT(*) as count FROM ops_deployments ${whereWith("")}`);
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
          const msg = String(e?.message || e || "");
          if (msg.includes("no such table: ops_deployments")) {
            return json({
              total: 0,
              success: 0,
              failed: 0,
              successRate: 0,
              avgDurationMs: 0,
              last24h: 0,
            });
          }
          throw e;
        }
      }

      // ═══ DEPLOY CONFIGS ═══
      if (path === "/api/ops/deploy-configs" && method === "GET") {
        const domainId = url.searchParams.get("domainId");
        if (!domainId) return json({ error: "Missing domainId" }, 400);

        let rows = [];
        try {
          const r = await db.prepare("SELECT * FROM ops_deploy_configs WHERE domain_id = ?")
            .bind(domainId).all();
          rows = r?.results || [];
        } catch (e) {
          const msg = String(e?.message || e || "");
          if (!msg.includes("no such table: ops_deploy_configs")) throw e;
        }

        const configs = {};
        rows.forEach(r => {
          configs[r.target_key] = JSON.parse(r.config || "{}");
        });

        return json(configs);
      }

      if (path === "/api/ops/deploy-configs" && method === "POST") {
        const body = await request.json();
        const { domainId, targetKey, config } = body;
        if (!domainId || !targetKey || !config) {
          return json({ error: "Missing domainId, targetKey, or config" }, 400);
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
          const msg = String(e?.message || e || "");
          if (msg.includes("no such table: ops_deploy_configs")) {
            return json({ success: false, skipped: true, error: "ops_deploy_configs table not found" });
          }
          throw e;
        }
      }

      // ═══ LEADINGCARDS PROXY ═══
      {
        const lcRes = await handleLeadingCardsRoute({ request, db, path, method, url });
        if (lcRes) return lcRes;
      }

      // ═══ MULTILOGIN PROXY ═══
      {
        const mlRes = await handleMultiloginRoute({ request, db, path, method, url });
        if (mlRes) return mlRes;
      }

      // ═══════════════════════════════════════════════════════════════════════════════
      // VOLUUM API PROXY
      // ═══════════════════════════════════════════════════════════════════════════════
      {
        const voluumRes = await handleVoluumApiRoute({ request, path, method, url });
        if (voluumRes) return voluumRes;
      }

      // ═══════════════════════════════════════════════════════════════════════════════
      // AUTOMATION API — Structured endpoints for external automation tools
      // ═══════════════════════════════════════════════════════════════════════════════

      // ═══ REGISTRAR AUTOMATION (Internet.bs) ═══
      {
        const registrarRes = await handleRegistrarAutomationRoute({ request, db, path, method });
        if (registrarRes) return registrarRes;
      }

      // ═══ CLOUDFLARE AUTOMATION ═══
      {
        const cfRes = await handleCloudflareAutomationRoute({ request, db, url, path, method });
        if (cfRes) return cfRes;
      }

      // ═══ DEPLOY ADAPTERS (Vercel / Netlify / CF Pages / CF Workers) ═══
      {
        const deployRes = await handleDeployAutomationRoute({ request, db, path, method });
        if (deployRes) return deployRes;
      }

      // ═══ TRACKING VERIFY (worker /__health + pixel /e probe) ═══
      {
        const trackingRes = await handleTrackingVerifyRoute({ request, path, method });
        if (trackingRes) return trackingRes;
      }

      // ═══ LC + ML AUTOMATION (operator card/profile management) ═══
      {
        const integRes = await handleIntegrationsAutomationRoute({ request, db, url, path, method });
        if (integRes) return integRes;
      }

      // ═══ D1 AUTOMATION (query/execute via CF API + direct-query via env.DB) ═══
      {
        const d1Res = await handleD1AutomationRoute({ request, env, path, method });
        if (d1Res) return d1Res;
      }

      // ═══ AI GENERATION (copy / meta / description / reviews) ═══
      {
        const aiRes = await handleAiGenerationRoute({ request, env, db, path, method });
        if (aiRes) return aiRes;
      }

      return json({ error: 'Not found' }, 404);

    } catch (err) {
      console.error(err);
      return json({ error: err.message }, 500);
    }
  },
};
