// ============================================================
// Templates handler for FusionOps API Worker
// ============================================================
// Routes:
//   GET  /api/templates/:id/thumb            Serve PNG from R2
//   POST /api/templates/:id/upload-thumb     Manual thumbnail upload
//   POST /api/templates/:id/generate-thumb   Puppeteer screenshot → R2
//   POST /api/mcp/templates                  MCP/Bolt template import (upsert)
//   GET  /api/mcp/templates                  Lightweight list (for MCP server poll)
//   GET  /api/templates                      List with usage counts
//   POST /api/templates                      Create template (40 MiB default body limit)
//   GET  /api/templates/:id                  Get one
//   PUT  /api/templates/:id                  Update (status/files/etc.)
//   DELETE /api/templates/:id                Soft-delete (refuse if in use)
//   GET  /api/templates/:id/usage            List sites currently using this template
//   GET  /api/templates/:id/versions         List version history
//   POST /api/templates/:id/publish          Mark active (with quality-gate check)
//   POST /api/templates/:id/rollback         Restore from a previous version
//   GET  /api/templates/default              Get default template id
//   PUT  /api/templates/default              Set default template id
//
// Auth: thumbnail upload + generate require Bearer/trusted-origin (denyUnlessTrustedOrBearer).
// MCP routes use x-mcp-secret header (separate from API_SECRET).
//
// Extracted from worker.js (Phase 2: handler extraction).
// ============================================================

import puppeteer from '@cloudflare/puppeteer';
import { corsHeaders, json, uid } from '../lib/http.js';
import { denyUnlessTrustedOrBearer } from '../lib/auth.js';
import {
  ensureTemplateManagerSchema,
  getTemplateUsageMap,
  parseTemplateFiles,
  pickTemplateHtmlForThumb,
  getTemplateQualityGateReport,
  createTemplateVersionSnapshot,
  jsonFromTemplatePostException,
  BUILTIN_TEMPLATE_IDS,
  isValidTemplateId,
  resolveCategory,
} from '../lib/template-utils.js';

/** Cap client-supplied HTML for Browser Rendering (abuse / memory). */
const THUMB_PREVIEW_HTML_MAX_BYTES = 2 * 1024 * 1024;

/** Cap manual thumbnail upload size. */
const THUMB_UPLOAD_MAX_BYTES = 8 * 1024 * 1024;

// ═══════════════════════════════════════════════════════════════════════════
// THUMBNAILS — R2 store + Puppeteer screenshot
// ═══════════════════════════════════════════════════════════════════════════

async function handleThumbServe({ env, id }) {
  try {
    const obj = await env.THUMBS.get(`thumbs/${id}.png`);
    if (!obj) return new Response(null, { status: 404 });
    const headers = new Headers({ 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400', ...corsHeaders });
    return new Response(obj.body, { headers });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function handleThumbUpload({ request, env, db, url, id }) {
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
    try { await db.prepare('ALTER TABLE templates ADD COLUMN thumbnail_url TEXT').run(); } catch (_e) { /* exists */ }
    try { await db.prepare('ALTER TABLE templates ADD COLUMN thumbnail_generated_at TEXT').run(); } catch (_e) { /* exists */ }
    const thumbUrl = `/api/templates/${encodeURIComponent(id)}/thumb`;
    await db.prepare(`UPDATE templates SET thumbnail_url = ?, thumbnail_generated_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`)
      .bind(thumbUrl, id).run();
    return json({ ok: true, thumbUrl });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

async function handleThumbGenerate({ request, env, db, url, id }) {
  try {
    const authDeny = denyUnlessTrustedOrBearer(request, url, env);
    if (authDeny) return authDeny;
    await ensureTemplateManagerSchema(db);
    // Ensure thumbnail columns exist before querying
    try { await db.prepare('ALTER TABLE templates ADD COLUMN thumbnail_url TEXT').run(); } catch (_e) { /* exists */ }
    try { await db.prepare('ALTER TABLE templates ADD COLUMN thumbnail_generated_at TEXT').run(); } catch (_e) { /* exists */ }
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
    try { await db.prepare('ALTER TABLE templates ADD COLUMN thumbnail_url TEXT').run(); } catch (_e) { /* exists */ }
    try { await db.prepare('ALTER TABLE templates ADD COLUMN thumbnail_generated_at TEXT').run(); } catch (_e) { /* exists */ }
    const thumbUrl = `/api/templates/${encodeURIComponent(id)}/thumb`;
    await db.prepare(`UPDATE templates SET thumbnail_url = ?, thumbnail_generated_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`)
      .bind(thumbUrl, id).run();
    return json({ ok: true, thumbUrl });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MCP IMPORT (POST /api/mcp/templates) + LIST (GET /api/mcp/templates)
// ═══════════════════════════════════════════════════════════════════════════

async function handleMcpImport({ request, env, db }) {
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

async function handleMcpList({ request, env, db }) {
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

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATES CRUD
// ═══════════════════════════════════════════════════════════════════════════

async function handleTemplatesList({ db, url }) {
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

async function handleTemplateCreate({ request, env, db }) {
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

async function handleTemplateGet({ db, id }) {
  await ensureTemplateManagerSchema(db);
  const template = await db.prepare('SELECT * FROM templates WHERE id = ? AND COALESCE(is_deleted, 0) = 0').bind(id).first();
  if (!template) return json({ error: 'Template not found' }, 404);
  return json({ ...template, files: parseTemplateFiles(template.files) });
}

async function handleTemplateUpdate({ request, db, id }) {
  await ensureTemplateManagerSchema(db);
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

async function handleTemplateDelete({ db, id }) {
  await ensureTemplateManagerSchema(db);
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

async function handleTemplateUsage({ db, id }) {
  await ensureTemplateManagerSchema(db);
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

async function handleTemplateVersions({ db, id }) {
  await ensureTemplateManagerSchema(db);
  const row = await db.prepare('SELECT id FROM templates WHERE id = ? AND COALESCE(is_deleted, 0) = 0').bind(id).first();
  if (!row) return json({ error: 'Template not found' }, 404);
  const { results } = await db
    .prepare('SELECT id, template_db_id, template_id, version_number, note, created_at FROM template_versions WHERE template_db_id = ? ORDER BY version_number DESC')
    .bind(id).all();
  return json({ success: true, versions: results || [] });
}

async function handleTemplatePublish({ request, db, id }) {
  await ensureTemplateManagerSchema(db);
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

async function handleTemplateRollback({ request, db, id }) {
  await ensureTemplateManagerSchema(db);
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

async function handleTemplateDefaultGet({ db }) {
  const row = await db.prepare('SELECT value FROM settings WHERE key = ?').bind('defaultTemplateId').first();
  return json({ success: true, templateId: row?.value || 'classic' });
}

async function handleTemplateDefaultSet({ request, db }) {
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

/**
 * Public route entries — split into two so the main router can call thumbnails
 * (no global API auth) before the auth check, and the rest after.
 */

/** Thumbnails: serve/upload/generate. Auth handled per-route (denyUnlessTrustedOrBearer). */
export async function handleTemplateThumbnailRoute({ request, env, db, url, path, method }) {
  const thumbServeMatch = path.match(/^\/api\/templates\/([^/]+)\/thumb$/);
  if (thumbServeMatch && method === 'GET') {
    return handleThumbServe({ env, id: decodeURIComponent(thumbServeMatch[1]) });
  }
  const thumbUploadMatch = path.match(/^\/api\/templates\/([^/]+)\/upload-thumb$/);
  if (thumbUploadMatch && method === 'POST') {
    return handleThumbUpload({ request, env, db, url, id: decodeURIComponent(thumbUploadMatch[1]) });
  }
  const thumbGenMatch = path.match(/^\/api\/templates\/([^/]+)\/generate-thumb$/);
  if (thumbGenMatch && method === 'POST') {
    return handleThumbGenerate({ request, env, db, url, id: decodeURIComponent(thumbGenMatch[1]) });
  }
  return null;
}

/** MCP + CRUD + version mgmt. Behind the global API_SECRET / trusted-origin gate. */
export async function handleTemplatesRoute({ request, env, db, url, path, method }) {
  // MCP routes
  if (path === '/api/mcp/templates' && method === 'POST') return handleMcpImport({ request, env, db });
  if (path === '/api/mcp/templates' && method === 'GET') return handleMcpList({ request, env, db });

  // /api/templates list + create (must precede /:id matchers)
  if (path === '/api/templates' && method === 'GET') return handleTemplatesList({ db, url });
  if (path === '/api/templates' && method === 'POST') return handleTemplateCreate({ request, env, db });

  // /api/templates/default (must precede /:id matchers)
  if (path === '/api/templates/default' && method === 'GET') return handleTemplateDefaultGet({ db });
  if (path === '/api/templates/default' && method === 'PUT') return handleTemplateDefaultSet({ request, db });

  // Single-template subresources
  const usageMatch = path.match(/^\/api\/templates\/([\w-]+)\/usage$/);
  if (usageMatch && method === 'GET') return handleTemplateUsage({ db, id: usageMatch[1] });

  const versionsMatch = path.match(/^\/api\/templates\/([\w-]+)\/versions$/);
  if (versionsMatch && method === 'GET') return handleTemplateVersions({ db, id: versionsMatch[1] });

  const publishMatch = path.match(/^\/api\/templates\/([\w-]+)\/publish$/);
  if (publishMatch && method === 'POST') return handleTemplatePublish({ request, db, id: publishMatch[1] });

  const rollbackMatch = path.match(/^\/api\/templates\/([\w-]+)\/rollback$/);
  if (rollbackMatch && method === 'POST') return handleTemplateRollback({ request, db, id: rollbackMatch[1] });

  // Single-template GET/PUT/DELETE (must come last because :id is a wildcard)
  const idMatch = path.match(/^\/api\/templates\/(?!default$)([\w-]+)$/);
  if (idMatch) {
    if (method === 'GET') return handleTemplateGet({ db, id: idMatch[1] });
    if (method === 'PUT') return handleTemplateUpdate({ request, db, id: idMatch[1] });
    if (method === 'DELETE') return handleTemplateDelete({ db, id: idMatch[1] });
  }

  return null;
}
