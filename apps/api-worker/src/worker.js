// FusionOps V2 — Cloudflare Workers API
// Binds to D1 database "ppc-gen-claude"
// Origin: https://github.com/songsawat-w/ppc-gen-cfca

import { neon } from '@neondatabase/serverless';
import puppeteer from '@cloudflare/puppeteer';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, cwauth-token, x-csrf-token, x-cf-api-token, anthropic-version, anthropic-dangerous-direct-browser-access',
  'Access-Control-Max-Age': '86400',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

function uid() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

function extractHost(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch (_e) {
    return raw.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].toLowerCase();
  }
}

const TRUSTED_PAGES_SUFFIXES = [
  '.fusionops-web.pages.dev',
  '.fusionops.pages.dev',
];

function buildAllowedHosts(env, requestHost) {
  const configured = String(env?.ALLOWED_ORIGINS || '')
    .split(',')
    .map((v) => extractHost(v))
    .filter(Boolean);
  return new Set([
    'localhost',
    '127.0.0.1',
    '::1',
    'fusionops-web.pages.dev',
    'main.fusionops.pages.dev',
    'fusionops.pages.dev',
    extractHost(env?.APP_ORIGIN || ''),
    extractHost(env?.PUBLIC_APP_ORIGIN || ''),
    extractHost(requestHost || ''),
    ...configured,
  ].filter(Boolean));
}

function isTrustedOriginRequest(request, url, env) {
  const allowed = buildAllowedHosts(env, url?.hostname || '');
  const originHost = extractHost(request.headers.get('Origin') || '');
  const refererHost = extractHost(request.headers.get('Referer') || '');
  const sourceHost = originHost || refererHost;
  if (!sourceHost) return false;
  if (allowed.has(sourceHost)) return true;
  return TRUSTED_PAGES_SUFFIXES.some((suffix) => sourceHost.endsWith(suffix));
}

function getNeonSql(env) {
  const connStr = env?.NEON_DATABASE_URL;
  if (!connStr || typeof connStr !== 'string') return null;
  if (!connStr.includes('@')) return null;
  try {
    return neon(connStr);
  } catch (_e) {
    return null;
  }
}

async function ensureNeonTables(sql) {
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
      CREATE TABLE IF NOT EXISTS deploys (
        id TEXT PRIMARY KEY,
        site_id TEXT,
        brand TEXT,
        url TEXT,
        type TEXT,
        deployed_by TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      )
    `;
  } catch (_e) {
    // Best-effort only; D1 remains primary.
  }
}

async function neonUpsertSettings(sql, obj) {
  if (!sql || !obj) return;
  for (const [key, value] of Object.entries(obj)) {
    await sql`
      INSERT INTO settings (key, value, updated_at)
      VALUES (${key}, ${JSON.stringify(value)}, now())
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `;
  }
}

async function neonUpsertSite(sql, id, body) {
  if (!sql) return;
  await sql`
    INSERT INTO sites (id, data, created_at, updated_at)
    VALUES (${id}, ${JSON.stringify(body || {})}, now(), now())
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()
  `;
}

async function neonDeleteSite(sql, id) {
  if (!sql) return;
  await sql`DELETE FROM sites WHERE id = ${id}`;
}

async function neonUpsertDeploy(sql, id, body) {
  if (!sql) return;
  await sql`
    INSERT INTO deploys (id, site_id, brand, url, type, deployed_by, created_at)
    VALUES (
      ${id}, ${body?.siteId || ''}, ${body?.brand || ''}, ${body?.url || ''}, ${body?.type || 'new'}, ${body?.deployedBy || ''}, now()
    )
    ON CONFLICT (id) DO UPDATE SET
      site_id = EXCLUDED.site_id,
      brand = EXCLUDED.brand,
      url = EXCLUDED.url,
      type = EXCLUDED.type,
      deployed_by = EXCLUDED.deployed_by
  `;
}

async function neonDeleteDeploy(sql, id) {
  if (!sql) return;
  await sql`DELETE FROM deploys WHERE id = ${id}`;
}

async function createVersionSnapshot(db, siteId, config) {
  try {
    const json = JSON.stringify(config);

    const { results } = await db.prepare(`
      SELECT COALESCE(MAX(version_number), 0) as v
      FROM site_versions
      WHERE site_id = ?
    `).bind(siteId).all();

    const nextVersion = (results[0]?.v || 0) + 1;

    const hashBuffer = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(json)
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
      json,
      hashHex
    ).run();
  } catch (err) {
    console.error('Version snapshot failed:', err);
    // DO NOT throw
  }
}

function normalizeNameservers(input) {
  return (Array.isArray(input) ? input : [])
    .map((ns) => String(ns || "").trim().toLowerCase().replace(/\.$/, ""))
    .filter(Boolean);
}

function canonicalizeNameservers(input) {
  return Array.from(new Set(normalizeNameservers(input))).sort();
}

function nameserversMatch(a, b) {
  const left = canonicalizeNameservers(a);
  const right = canonicalizeNameservers(b);
  if (left.length !== right.length) return false;
  return left.every((value, idx) => value === right[idx]);
}

const CF_NS_RETRY_ATTEMPTS = 6;
const CF_NS_RETRY_DELAY_MS = 2000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollCloudflareNameservers(zoneId, headers, options = {}) {
  const attempts = Number(options.attempts || CF_NS_RETRY_ATTEMPTS);
  const delayMs = Number(options.delayMs || CF_NS_RETRY_DELAY_MS);
  let lastError = "";
  let latestZone = null;

  for (let i = 0; i < attempts; i++) {
    if (i > 0) {
      await sleep(delayMs);
    }

    const zoneRes = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}`, { headers });
    const zoneData = await zoneRes.json().catch(() => ({}));

    if (!zoneRes.ok || zoneData?.success === false) {
      lastError = zoneData?.errors?.[0]?.message || `Cloudflare zone lookup failed (${zoneRes.status})`;
      continue;
    }

    latestZone = zoneData?.result || latestZone;
    const nameservers = normalizeNameservers(latestZone?.name_servers || latestZone?.nameServers);
    if (nameservers.length >= 2) {
      return { success: true, nameservers, zone: latestZone };
    }

    lastError = "Cloudflare nameservers are not ready yet";
  }

  return {
    success: false,
    error: lastError || "Cloudflare nameservers are not ready yet",
    zone: latestZone,
  };
}

function extractInternetBsNameservers(payload) {
  const out = [];
  const walk = (obj) => {
    if (!obj || typeof obj !== "object") return;
    for (const [rawKey, value] of Object.entries(obj)) {
      const key = String(rawKey || "").toLowerCase();

      if (key === "ns_list" && typeof value === "string") {
        out.push(...value.split(","));
      } else if (/^ns\d+$/.test(key) || key.includes("nameserver")) {
        if (Array.isArray(value)) out.push(...value);
        else out.push(value);
      } else if (Array.isArray(value)) {
        value.forEach((entry) => {
          if (entry && typeof entry === "object") walk(entry);
        });
      } else if (value && typeof value === "object") {
        walk(value);
      }
    }
  };

  walk(payload);
  return canonicalizeNameservers(out);
}

async function fetchInternetBsCurrentNameservers(registrar, domain) {
  const apiUrl = "https://api.internet.bs/Domain/Info";
  const formData = new URLSearchParams({
    ApiKey: registrar.api_key || "",
    Password: registrar.secret_key || "",
    responseformat: "JSON",
    Domain: domain,
  });

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  });

  const rawText = await res.text();
  let data = null;
  try {
    data = JSON.parse(rawText);
  } catch (_e) {
    return {
      success: false,
      nameservers: [],
      message: rawText?.slice(0, 800) || "Non-JSON response from registrar",
    };
  }

  const statusText = String(data?.status || "").toLowerCase();
  if (statusText === "failure") {
    return {
      success: false,
      nameservers: [],
      message: data?.message || data?.error || "Registrar Domain/Info failed",
      raw: data,
    };
  }

  const nameservers = extractInternetBsNameservers(data);
  return {
    success: true,
    nameservers,
    message: data?.message || "",
    raw: data,
  };
}

async function resolveCloudflareAccount(db, cfAccountRef) {
  if (!cfAccountRef) return null;
  const row = await db
    .prepare("SELECT id, account_id, api_token FROM cf_accounts WHERE id = ? OR account_id = ? LIMIT 1")
    .bind(cfAccountRef, cfAccountRef)
    .first();
  if (!row?.account_id || !row?.api_token) return null;
  return row;
}

async function ensureCloudflareZoneAndNameservers(accountId, apiToken, domain) {
  const headers = {
    Authorization: `Bearer ${apiToken}`,
    "Content-Type": "application/json",
  };

  let zone = null;

  const checkRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(domain)}&account.id=${encodeURIComponent(accountId)}`,
    { headers }
  );
  const checkData = await checkRes.json();
  if (checkData?.success && Array.isArray(checkData.result) && checkData.result.length > 0) {
    zone = checkData.result[0];
  } else {
    const createRes = await fetch("https://api.cloudflare.com/client/v4/zones", {
      method: "POST",
      headers,
      body: JSON.stringify({
        account: { id: accountId },
        name: domain,
        jump_start: false,
      }),
    });
    const createData = await createRes.json();
    if (!createData?.success || !createData?.result?.id) {
      return { success: false, error: createData?.errors?.[0]?.message || "Failed to create Cloudflare zone" };
    }
    zone = createData.result;
  }

  let nameservers = normalizeNameservers(zone?.name_servers || zone?.nameServers);
  let latestZone = zone;
  if (nameservers.length < 2 && zone?.id) {
    const nsPoll = await pollCloudflareNameservers(zone.id, headers);
    if (!nsPoll.success) {
      return {
        success: false,
        error: `${nsPoll.error}. Retry in 10-30 seconds.`,
      };
    }
    nameservers = nsPoll.nameservers;
    latestZone = nsPoll.zone || zone;
  }

  if (nameservers.length < 2) {
    return { success: false, error: "Cloudflare nameservers are not ready yet. Retry in 10-30 seconds." };
  }

  return { success: true, zoneId: zone.id, nameservers, zone: latestZone };
}

async function updateInternetBsNameservers(db, accountId, domain, nameservers) {
  const registrar = await db.prepare("SELECT * FROM registrar_accounts WHERE id = ? LIMIT 1").bind(accountId).first();
  if (!registrar) return { success: false, error: "Internet.bs account not found" };

  const apiUrl = "https://api.internet.bs/Domain/Update";
  const formData = new URLSearchParams({
    ApiKey: registrar.api_key || "",
    Password: registrar.secret_key || "",
    responseformat: "JSON",
    Domain: domain,
    Ns_list: nameservers.join(","),
  });

  const res = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: formData.toString(),
  });

  const rawText = await res.text();
  let data = null;
  try {
    data = JSON.parse(rawText);
  } catch (_e) {
    data = { status: "FAILURE", message: rawText?.slice(0, 800) || "Non-JSON response from registrar" };
  }

  const statusText = String(data?.status || "").toLowerCase();
  const isSuccess = statusText === "success" || statusText === "ok";
  return {
    success: isSuccess,
    message: data?.message || data?.error || data?.msg || "Unknown registrar response",
    raw: data,
  };
}

async function autoSyncInternetBsNameserversForSite(db, body) {
  try {
    const domain = String(body?.domain || "").trim().toLowerCase();
    const registrarAccountId = body?.internetbsAccountId || body?.registrarAccountId || body?.accountId;
    const cfAccountRef = body?.cfAccountId;

    if (!domain || !registrarAccountId || !cfAccountRef) {
      return { attempted: false, reason: "missing_domain_or_account_selection" };
    }

    const cfAccount = await resolveCloudflareAccount(db, cfAccountRef);
    if (!cfAccount) {
      return { attempted: true, success: false, reason: "cloudflare_account_not_found" };
    }

    const zoneResult = await ensureCloudflareZoneAndNameservers(cfAccount.account_id, cfAccount.api_token, domain);
    if (!zoneResult.success) {
      return { attempted: true, success: false, reason: "zone_prepare_failed", message: zoneResult.error };
    }

    const registrarResult = await updateInternetBsNameservers(db, registrarAccountId, domain, zoneResult.nameservers);
    if (!registrarResult.success) {
      return { attempted: true, success: false, reason: "registrar_update_failed", message: registrarResult.message };
    }

    return {
      attempted: true,
      success: true,
      zoneId: zoneResult.zoneId,
      nameservers: zoneResult.nameservers,
      message: registrarResult.message,
    };
  } catch (e) {
    return { attempted: true, success: false, reason: "exception", message: e?.message || "Unknown error" };
  }
}

async function ensureTemplateManagerSchema(db) {
  try { await db.prepare('ALTER TABLE templates ADD COLUMN is_deleted INTEGER DEFAULT 0').run(); } catch (_e) {}
  try { await db.prepare("ALTER TABLE templates ADD COLUMN status TEXT DEFAULT 'draft'").run(); } catch (_e) {}
  try { await db.prepare('ALTER TABLE templates ADD COLUMN updated_at TEXT').run(); } catch (_e) {}
  try { await db.prepare('ALTER TABLE templates ADD COLUMN current_version INTEGER DEFAULT 1').run(); } catch (_e) {}
  try { await db.prepare('ALTER TABLE templates ADD COLUMN archived_at TEXT').run(); } catch (_e) {}

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

function getTemplateQualityGateReport({ files = {}, sourceCode = '', category = '' } = {}) {
  const fileMap = files && typeof files === 'object' ? files : {};
  const source = String(sourceCode || '');
  const categoryLower = String(category || '').toLowerCase();
  const keys = Object.keys(fileMap);
  const combined = source + JSON.stringify(fileMap);
  const hasEntry = keys.some((k) => k.endsWith('index.astro') || k.endsWith('index.html')) || /<html|<!doctype html/i.test(source);
  const hasPixelMarker = /sendBeacon|sendPixelBeacon|fpPixel|__fpPixel|PX_ENDPOINT|t\.[^"' ]+\/e|window\.__fusionopsTrack|window\.pixel/i.test(combined);
  const hasAstroLeak = /\{\s*noindex\s*\?|\{\s*[a-zA-Z_$][\w$]*\s*&&\s*\(/.test(combined);
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

async function getLcSettings(db) {
  const rows = await db.prepare("SELECT key, value FROM settings WHERE key IN ('lcToken', 'lcTeamUuid')").all();
  const s = {};
  rows.results.forEach(r => { s[r.key] = r.value; });
  return s;
}

async function getMlSettings(db) {
  const rows = await db.prepare("SELECT key, value FROM settings WHERE key IN ('mlToken', 'mlEmail', 'mlPassword', 'mlFolderId')").all();
  const s = {};
  rows.results.forEach(r => { s[r.key] = r.value; });
  return s;
}

function camelToSnake(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function toBase64(text) {
  const bytes = new TextEncoder().encode(String(text ?? ""));
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function isMaskedSecret(value) {
  return /^[•*]+$/.test(String(value || "").trim());
}

async function githubFetch(url, options = {}, GITHUB_TOKEN) {
  const mergedHeaders = new Headers(options.headers || {});
  mergedHeaders.set("Authorization", `Bearer ${GITHUB_TOKEN}`);
  mergedHeaders.set("Content-Type", "application/json");
  mergedHeaders.set("User-Agent", "FusionOps-LP-Factory");
  mergedHeaders.set("Accept", "application/vnd.github+json");
  mergedHeaders.set("X-GitHub-Api-Version", "2022-11-28");

  const reqOptions = {
    ...options,
    headers: mergedHeaders,
  };

  const res = await fetch(url, reqOptions);

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    const method = String(reqOptions.method || "GET").toUpperCase();
    const bodySnippet = detail ? detail.slice(0, 1000) : res.statusText;
    const error = new Error(`GitHub API ${res.status} ${method} ${url}: ${bodySnippet}`);
    error.status = res.status;
    throw error;
  }

  return res;
}

async function githubApi(token, path, options = {}) {
  const res = await githubFetch(`https://api.github.com${path}`, options, token);

  if (res.status === 204) return null;
  return res.json();
}

async function getGithubFileSha(token, owner, repo, path, branch) {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  try {
    const data = await githubApi(token, `/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(branch)}`);
    return data?.sha || null;
  } catch (e) {
    if (e?.status === 404) return null;
    throw e;
  }
}

async function upsertGithubFile({ token, owner, repo, branch, filePath, content, message }) {
  const sha = await getGithubFileSha(token, owner, repo, filePath, branch);
  const encodedPath = filePath.split("/").map(encodeURIComponent).join("/");
  const payload = {
    message,
    content: toBase64(content),
    branch,
  };
  if (sha) payload.sha = sha;

  const data = await githubApi(token, `/repos/${owner}/${repo}/contents/${encodedPath}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

  return data?.content?.sha || null;
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

async function ensureGithubBranch(token, owner, repo, branchName, sourceBranch) {
  try {
    await githubApi(token, `/repos/${owner}/${repo}/git/ref/${encodeURIComponent(`heads/${branchName}`)}`);
    return;
  } catch (e) {
    if (e?.status !== 404) throw e;
  }
  const sourceRef = await githubApi(token, `/repos/${owner}/${repo}/git/ref/${encodeURIComponent(`heads/${sourceBranch}`)}`);
  const sha = sourceRef?.object?.sha;
  if (!sha) throw new Error(`Cannot resolve source branch ${sourceBranch}`);
  await githubApi(token, `/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha }),
  });
}

// Column whitelists for PUT endpoints (SQL injection protection)
const ALLOWED_COLS = {
  domains: new Set(['domain', 'registrar', 'accountId', 'profileId', 'cfAccountId', 'zoneId', 'nameservers', 'status', 'registrarAccountId']),
  accounts: new Set(['label', 'email', 'paymentId', 'budget', 'status', 'cardUuid', 'cardLast4', 'cardStatus', 'profileId', 'proxyIp', 'monthlySpend']),
  profiles: new Set(['name', 'proxyIp', 'browserType', 'os', 'status', 'mlProfileId', 'mlFolderId', 'proxyHost', 'proxyPort', 'proxyUser', 'fingerprintOs']),
  payments: new Set(['label', 'type', 'last4', 'bankName', 'status', 'lcCardUuid', 'lcBinUuid', 'cardLimit', 'cardExpiry', 'totalSpend']),
};

// Secret keys that should never be returned in API responses
const SECRET_KEYS = new Set(['apiKey', 'geminiKey', 'netlifyToken', 'lcToken', 'mlToken', 'mlPassword', 'githubToken']);

function redactSettings(obj) {
  const safe = {};
  for (const [k, v] of Object.entries(obj)) {
    safe[k] = SECRET_KEYS.has(k) ? (v ? '••••' : '') : v;
  }
  return safe;
}

// Convert snake_case DB columns to camelCase for frontend
function snakeToCamel(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camel] = value;
  }
  return result;
}

// ═══════════════════════════════════════════
// PROXY HANDLER — forwards requests to external APIs
// Handles CORS by proxying through the Worker
// ═══════════════════════════════════════════
const PROXY_TARGETS = {
  '/api/proxy/cf/': 'https://api.cloudflare.com/client/v4/',
  '/api/proxy/mlx/': 'https://api.multilogin.com/',
  '/api/proxy/netlify/': 'https://api.netlify.com/api/v1/',
};

const MLX_CACHE_TTL_SUCCESS = 60000;    // ms for 2xx responses
const MLX_CACHE_TTL_RATE_LIMIT = 20000;  // ms for 429/503 responses

// In-memory TTL cache for MLX GET proxy responses
// Persists across requests within the same Worker isolate
const mlxCache = new Map(); // key -> { body, status, headers, expiresAt }

function mlxCacheKey(requestUrl, authHeader) {
  return `${requestUrl}|${authHeader || ''}`;
}

function mlxCacheGet(key) {
  const entry = mlxCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    mlxCache.delete(key);
    return null;
  }
  return entry;
}

function mlxCacheSet(key, body, status, headers, ttlMs) {
  if (mlxCache.size > 200) {
    // Evict oldest entry to cap memory usage
    mlxCache.delete(mlxCache.keys().next().value);
  }
  mlxCache.set(key, { body, status, headers, expiresAt: Date.now() + ttlMs });
}

async function handleProxy(request, url) {
  let targetBase = null;
  let strippedPath = url.pathname;

  for (const [prefix, base] of Object.entries(PROXY_TARGETS)) {
    if (url.pathname.startsWith(prefix)) {
      targetBase = base;
      strippedPath = url.pathname.slice(prefix.length);
      break;
    }
  }

  // Cache GET requests to MLX proxy to avoid upstream rate limits
  const isMlxGet = targetBase === 'https://api.multilogin.com/' && request.method === 'GET';
  if (isMlxGet) {
    const cKey = mlxCacheKey(request.url, request.headers.get('Authorization'));
    const cached = mlxCacheGet(cKey);
    if (cached) {
      const cachedHeaders = new Headers(cached.headers);
      cachedHeaders.set('X-Cache', 'HIT');
      for (const [k, v] of Object.entries(corsHeaders)) cachedHeaders.set(k, v);
      return new Response(cached.body, { status: cached.status, headers: cachedHeaders });
    }
  }

  // Check for generic pass-through: /api/proxy/pass?url=<encoded-target>
  if (!targetBase && url.pathname === '/api/proxy/pass') {
    const passUrl = url.searchParams.get('url');
    if (!passUrl) return json({ error: 'Missing ?url= parameter' }, 400);
    // Only allow HTTPS targets
    if (!passUrl.startsWith('https://')) return json({ error: 'Only HTTPS targets allowed' }, 400);
    const targetUrl = passUrl;
    const proxyHeaders = new Headers(request.headers);
    // Strip headers that expose original client IP — targets see Worker IP only
    proxyHeaders.delete('host');
    proxyHeaders.delete('origin');
    proxyHeaders.delete('referer');
    proxyHeaders.delete('x-forwarded-for');
    proxyHeaders.delete('x-real-ip');
    proxyHeaders.delete('cf-connecting-ip');
    proxyHeaders.delete('cf-ipcountry');
    proxyHeaders.delete('cf-ray');
    proxyHeaders.delete('cf-visitor');
    try {
      const proxyRes = await fetch(targetUrl, {
        method: request.method,
        headers: proxyHeaders,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
        redirect: 'follow',
      });
      const responseHeaders = new Headers(proxyRes.headers);
      for (const [k, v] of Object.entries(corsHeaders)) {
        responseHeaders.set(k, v);
      }
      return new Response(proxyRes.body, {
        status: proxyRes.status,
        statusText: proxyRes.statusText,
        headers: responseHeaders,
      });
    } catch (e) {
      return json({ error: e.message }, 502);
    }
  }

  if (!targetBase) return null; // not a proxy route

  const targetUrl = `${targetBase}${strippedPath}${url.search}`;

  const proxyHeaders = new Headers(request.headers);
  // Strip headers that expose original client IP — targets see Worker IP only
  proxyHeaders.delete('host');
  proxyHeaders.delete('origin');
  proxyHeaders.delete('referer');
  proxyHeaders.delete('x-forwarded-for');
  proxyHeaders.delete('x-real-ip');
  proxyHeaders.delete('cf-connecting-ip');
  proxyHeaders.delete('cf-ipcountry');
  proxyHeaders.delete('cf-ray');
  proxyHeaders.delete('cf-visitor');

  try {
    const proxyRes = await fetch(targetUrl, {
      method: request.method,
      headers: proxyHeaders,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      redirect: 'follow',
    });

    const responseHeaders = new Headers(proxyRes.headers);
    for (const [k, v] of Object.entries(corsHeaders)) {
      responseHeaders.set(k, v);
    }

    // For MLX GET: read body as text once, cache it, then return from string
    if (isMlxGet) {
      const bodyText = await proxyRes.text();
      const isSuccess = proxyRes.status >= 200 && proxyRes.status < 300;
      const isRateLimit = proxyRes.status === 429 || proxyRes.status === 503;
      const ttlMs = isSuccess ? MLX_CACHE_TTL_SUCCESS : isRateLimit ? MLX_CACHE_TTL_RATE_LIMIT : 0;
      if (ttlMs > 0) {
        const cKey = mlxCacheKey(request.url, request.headers.get('Authorization'));
        mlxCacheSet(cKey, bodyText, proxyRes.status, responseHeaders, ttlMs);
      }
      responseHeaders.set('X-Cache', 'MISS');
      return new Response(bodyText, { status: proxyRes.status, headers: responseHeaders });
    }

    return new Response(proxyRes.body, {
      status: proxyRes.status,
      statusText: proxyRes.statusText,
      headers: responseHeaders,
    });
  } catch (e) {
    return json({ error: e.message }, 502);
  }
}

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

    // ═══ PIXEL ENDPOINT — handles t.{domain}/e from Workers Route ═══
    // When accessed via Workers Route (t.domain/*), path = /e
    if (path === '/e' && (method === 'POST' || method === 'GET')) {
      try {
        const db = env.DB;
        // Ensure pixel_events table exists (idempotent)
        await db.prepare(`CREATE TABLE IF NOT EXISTS pixel_events (
          id TEXT PRIMARY KEY,
          domain TEXT,
          session_id TEXT,
          event TEXT,
          data TEXT,
          gclid TEXT,
          click_id TEXT,
          ip TEXT,
          ua TEXT,
          ref TEXT,
          ts INTEGER DEFAULT (unixepoch())
        )`).run();

        let payload = {};
        if (method === 'POST') {
          try { payload = await request.json(); } catch { payload = {}; }
        } else {
          for (const [k, v] of url.searchParams) payload[k] = v;
        }

        const id = uid();
        // Prefer explicit domain from payload for direct API-worker calls.
        const domain = String(payload.d || "").trim() || hostname || '';
        const sessionId = payload.sid || payload.session_id || '';
        const event = payload.e || payload.event || 'unknown';
        const data = typeof payload.data === 'object' ? JSON.stringify(payload.data) : (payload.data || '');
        const gclid = payload.gclid || '';
        const clickId = payload.click_id || payload.cid || '';
        const ip = request.headers.get('CF-Connecting-IP') || '';
        const ua = request.headers.get('User-Agent') || '';
        const ref = request.headers.get('Referer') || payload.ref || '';

        await db.prepare(
          `INSERT INTO pixel_events (id, domain, session_id, event, data, gclid, click_id, ip, ua, ref) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(id, domain, sessionId, event, data, gclid, clickId, ip, ua, ref).run();

        // Return 1x1 transparent GIF for GET, JSON for POST
        if (method === 'GET') {
          const gif = new Uint8Array([71,73,70,56,57,97,1,0,1,0,0,0,0,59]);
          return new Response(gif, {
            status: 200,
            headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store', ...corsHeaders },
          });
        }
        return json({ ok: true, id });
      } catch (e) {
        return json({ ok: false, error: e.message }, 500);
      }
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
        const db = env.DB;
        const formData = await request.formData();
        const file = formData.get('image');
        if (!file || typeof file === 'string') return json({ error: 'No image file provided' }, 400);
        const contentType = file.type || 'image/png';
        if (!contentType.startsWith('image/')) return json({ error: 'File must be an image' }, 400);
        const buffer = await file.arrayBuffer();
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
        const db = env.DB;
        await ensureTemplateManagerSchema(db);
        // Ensure thumbnail columns exist before querying
        try { await db.prepare('ALTER TABLE templates ADD COLUMN thumbnail_url TEXT').run(); } catch (_e) {}
        try { await db.prepare('ALTER TABLE templates ADD COLUMN thumbnail_generated_at TEXT').run(); } catch (_e) {}
        // Load template from D1 — uses files column (JSON string), not data
        const row = await db.prepare(`SELECT id, files, name, thumbnail_url FROM templates WHERE id = ? AND COALESCE(is_deleted,0) = 0 LIMIT 1`).bind(id).first();
        if (!row) return json({ error: 'Template not found' }, 404);
        const files = parseTemplateFiles(row.files);
        // Find HTML to render — prefer index.html, else strip Astro frontmatter
        const htmlKeys = Object.keys(files);
        const htmlKey = htmlKeys.find(k => k === 'index.html')
          || htmlKeys.find(k => k.endsWith('/index.html'))
          || htmlKeys.find(k => k.endsWith('index.astro'));
        if (!htmlKey) return json({ error: 'No renderable HTML found in template' }, 422);
        let html = String(files[htmlKey] || '');
        // Strip Astro frontmatter if present
        html = html.replace(/^---[\s\S]*?---\n?/, '');
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
        const db = env.DB;
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
        const db = env.DB;
        const domain = url.searchParams.get('domain') || '';
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 500);
        const since = url.searchParams.get('since') || '0';

        let stmt;
        if (domain) {
          stmt = db.prepare('SELECT * FROM pixel_events WHERE domain LIKE ? AND ts > ? ORDER BY ts DESC LIMIT ?')
            .bind(`%${domain}%`, parseInt(since), limit);
        } else {
          stmt = db.prepare('SELECT * FROM pixel_events WHERE ts > ? ORDER BY ts DESC LIMIT ?')
            .bind(parseInt(since), limit);
        }
        const { results } = await stmt.all();
        return json({ success: true, events: results || [], count: results?.length || 0 });
      } catch (e) {
        return json({ success: false, error: e.message }, 500);
      }
    }

    // ═══ PROXY ROUTES (no auth required — proxy forwards auth headers) ═══
    if (path.startsWith('/api/proxy/')) {
      const proxyRes = await handleProxy(request, url);
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
    if (path === '/api/openapi.json' && method === 'GET') {
      const spec = {
        openapi: '3.0.3',
        info: {
          title: 'FusionOps Automation API',
          version: '2.1.0',
          description: 'Automation endpoints for FusionOps V2',
        },
        servers: [{ url: 'https://lp-factory-api.misty-feather-556e.workers.dev', description: 'Production' }],
        tags: [
          { name: 'Registrar', description: 'Domain registrar operations (Internet.bs)' },
          { name: 'Cloudflare', description: 'Cloudflare DNS and zone management' },
          { name: 'Deploy', description: 'Deployment platform linking' },
          { name: 'LeadingCards', description: 'Virtual card management' },
          { name: 'Multilogin', description: 'Browser profile automation' },
        ],
        paths: {
          '/api/automation/registrar/check': {
            post: {
              tags: ['Registrar'],
              summary: 'Check domain availability',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['domain', 'provider'],
                      properties: {
                        domain: { type: 'string', example: 'example.com' },
                        provider: { type: 'string', enum: ['internetbs'] },
                        accountId: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/registrar/register': {
            post: {
              tags: ['Registrar'],
              summary: 'Register a domain',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['domain', 'provider'],
                      properties: {
                        domain: { type: 'string' },
                        provider: { type: 'string', enum: ['internetbs'] },
                        accountId: { type: 'string' },
                        period: { type: 'string', default: '1Y' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/registrar/nameservers': {
            put: {
              tags: ['Registrar'],
              summary: 'Update domain nameservers',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['domain', 'nameservers', 'provider'],
                      properties: {
                        domain: { type: 'string' },
                        nameservers: { type: 'array', items: { type: 'string' } },
                        provider: { type: 'string', enum: ['internetbs'] },
                        accountId: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/registrar/import': {
            post: {
              tags: ['Registrar'],
              summary: 'Import all domains',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['provider'],
                      properties: {
                        provider: { type: 'string', enum: ['internetbs'] },
                        accountId: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/registrar/ping': {
            post: {
              tags: ['Registrar'],
              summary: 'Test registrar connection',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['provider'],
                      properties: {
                        provider: { type: 'string', enum: ['internetbs'] },
                        accountId: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/cf-validate': {
            post: {
              tags: ['Cloudflare'],
              summary: 'Validate Cloudflare API token and account ID',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['accountId', 'apiToken'],
                      properties: {
                        accountId: { type: 'string' },
                        apiToken: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: {
                '200': { description: 'Valid credentials' },
                '400': { description: 'Invalid credentials' },
              },
            },
          },
          '/api/automation/cf/zone': {
            post: {
              tags: ['Cloudflare'],
              summary: 'Create or get zone',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['domain', 'cfAccountId'],
                      properties: {
                        domain: { type: 'string' },
                        cfAccountId: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/cf/dns': {
            get: {
              tags: ['Cloudflare'],
              summary: 'List DNS records',
              parameters: [
                { name: 'zoneId', in: 'query', required: true, schema: { type: 'string' } },
                { name: 'cfAccountId', in: 'query', required: true, schema: { type: 'string' } },
              ],
              responses: { '200': { description: 'Success' } },
            },
            post: {
              tags: ['Cloudflare'],
              summary: 'Create DNS record',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['zoneId', 'cfAccountId', 'type', 'name', 'content'],
                      properties: {
                        zoneId: { type: 'string' },
                        cfAccountId: { type: 'string' },
                        type: { type: 'string', enum: ['A', 'AAAA', 'CNAME', 'TXT', 'NS', 'MX', 'SRV'] },
                        name: { type: 'string' },
                        content: { type: 'string' },
                        ttl: { type: 'integer', default: 3600 },
                        proxied: { type: 'boolean', default: false },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
            put: {
              tags: ['Cloudflare'],
              summary: 'Update DNS record',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['dnsRecordId', 'zoneId', 'cfAccountId'],
                      properties: {
                        dnsRecordId: { type: 'string' },
                        zoneId: { type: 'string' },
                        cfAccountId: { type: 'string' },
                        type: { type: 'string' },
                        name: { type: 'string' },
                        content: { type: 'string' },
                        ttl: { type: 'integer' },
                        proxied: { type: 'boolean' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
            delete: {
              tags: ['Cloudflare'],
              summary: 'Delete DNS record',
              parameters: [
                { name: 'dnsRecordId', in: 'query', required: true, schema: { type: 'string' } },
                { name: 'zoneId', in: 'query', required: true, schema: { type: 'string' } },
                { name: 'cfAccountId', in: 'query', required: true, schema: { type: 'string' } },
              ],
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/deploy/vercel': {
            post: {
              tags: ['Deploy'],
              summary: 'Link Vercel project',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['projectName', 'accessToken'],
                      properties: {
                        projectName: { type: 'string' },
                        accessToken: { type: 'string' },
                        teamId: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/deploy/netlify': {
            post: {
              tags: ['Deploy'],
              summary: 'Link Netlify site',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['siteName', 'accessToken'],
                      properties: {
                        siteName: { type: 'string' },
                        accessToken: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/deploy/cf-pages': {
            post: {
              tags: ['Deploy'],
              summary: 'Link Cloudflare Pages project',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['projectName', 'cfAccountId'],
                      properties: {
                        projectName: { type: 'string' },
                        cfAccountId: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/deploy/cf-workers': {
            post: {
              tags: ['Deploy'],
              summary: 'Link Cloudflare Workers script',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['scriptName', 'cfAccountId'],
                      properties: {
                        scriptName: { type: 'string' },
                        cfAccountId: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/lc/create': {
            post: {
              tags: ['LeadingCards'],
              summary: 'Create virtual card',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        limit: { type: 'number' },
                        currency: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/lc/block': {
            post: {
              tags: ['LeadingCards'],
              summary: 'Block virtual card',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['cardUuid'],
                      properties: {
                        cardUuid: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/lc/activate': {
            post: {
              tags: ['LeadingCards'],
              summary: 'Activate virtual card',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['cardUuid'],
                      properties: {
                        cardUuid: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/lc/change_limit': {
            post: {
              tags: ['LeadingCards'],
              summary: 'Change card limit',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['cardUuid', 'limit'],
                      properties: {
                        cardUuid: { type: 'string' },
                        limit: { type: 'number' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/d1/query': {
            post: {
              tags: ['D1 Database'],
              summary: 'Execute SQL query on D1 database',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['sql', 'accountId', 'databaseId'],
                      properties: {
                        sql: { type: 'string', description: 'SQL query with ? placeholders' },
                        params: { type: 'array', description: 'Parameters for prepared statement' },
                        accountId: { type: 'string', description: 'Cloudflare Account ID' },
                        databaseId: { type: 'string', description: 'D1 Database UUID' },
                      },
                    },
                  },
                },
              },
              responses: {
                '200': { description: 'Query results' },
                '400': { description: 'Bad request' },
              },
            },
          },
          '/api/automation/d1/execute': {
            post: {
              tags: ['D1 Database'],
              summary: 'Execute SQL command (INSERT, UPDATE, DELETE)',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['sql', 'accountId', 'databaseId'],
                      properties: {
                        sql: { type: 'string', description: 'SQL command' },
                        params: { type: 'array', description: 'Parameters for prepared statement' },
                        accountId: { type: 'string', description: 'Cloudflare Account ID' },
                        databaseId: { type: 'string', description: 'D1 Database UUID' },
                      },
                    },
                  },
                },
              },
              responses: {
                '200': { description: 'Command executed' },
                '400': { description: 'Bad request' },
              },
            },
          },
          '/api/automation/ml/signin': {
            post: {
              tags: ['Multilogin'],
              summary: 'Sign in to Multilogin',
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/ml/refresh_token': {
            post: {
              tags: ['Multilogin'],
              summary: 'Refresh Multilogin token',
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/ml/profiles': {
            get: {
              tags: ['Multilogin'],
              summary: 'List Multilogin profiles',
              responses: { '200': { description: 'Success' } },
            },
            post: {
              tags: ['Multilogin'],
              summary: 'Create Multilogin profile',
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/ml/profiles/start': {
            post: {
              tags: ['Multilogin'],
              summary: 'Start Multilogin profile',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['profileId'],
                      properties: {
                        profileId: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/ml/profiles/stop': {
            post: {
              tags: ['Multilogin'],
              summary: 'Stop Multilogin profile',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['profileId'],
                      properties: {
                        profileId: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
          '/api/automation/ml/profiles/clone': {
            post: {
              tags: ['Multilogin'],
              summary: 'Clone Multilogin profile',
              requestBody: {
                required: true,
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      required: ['profileId'],
                      properties: {
                        profileId: { type: 'string' },
                      },
                    },
                  },
                },
              },
              responses: { '200': { description: 'Success' } },
            },
          },
        },
        components: {
          securitySchemes: {
            BearerAuth: {
              type: 'http',
              scheme: 'bearer',
              bearerFormat: 'API_SECRET',
            },
          },
        },
      };
      return json(spec);
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
      const isAiRoute = path.startsWith('/api/ai/');
      const isSettingsRoute = path === '/api/settings';
      if (!publicNoAuth.has(path) && !isAiRoute && !isSettingsRoute && !isTrustedOriginRequest(request, url, env)) {
        return json({ error: 'Unauthorized (untrusted origin, API_SECRET not configured)' }, 401);
      }
    }

    const db = env.DB;

    const neonSql = getNeonSql(env);
    if (neonSql) {
      ensureNeonTables(neonSql).catch(() => {});
    }

    try {
      // ═══ SITES ═══
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

        if (neonSql) {
          neonUpsertSite(neonSql, id, body).catch(() => {});
        }
        await createVersionSnapshot(db, id, body);
        const internetBsSync = await autoSyncInternetBsNameserversForSite(db, body);
        return json({ id, success: true, internetBsSync }, 201);
      }

      if (path.match(/^\/api\/sites\/[\w-]+$/) && method === 'DELETE') {
        const id = path.split('/').pop();
        await db.prepare('DELETE FROM sites WHERE id = ?').bind(id).run();

        if (neonSql) {
          neonDeleteSite(neonSql, id).catch(() => {});
        }
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

      // ═══ DEPLOYS ═══
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

        if (neonSql) {
          neonUpsertDeploy(neonSql, id, body).catch(() => {});
        }
        return json({ id, success: true }, 201);
      }

      if (path.startsWith('/api/deploys/') && method === 'DELETE') {
        const id = path.split('/')[3];
        await db.prepare('DELETE FROM deploys WHERE id = ?').bind(id).run();

        if (neonSql) {
          neonDeleteDeploy(neonSql, id).catch(() => {});
        }
        return json({ success: true });
      }

      // ═══ VARIANTS ═══
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
        const status = 'draft';
        const source = String(body.source || 'mcp').toLowerCase();
        const badge = String(body.badge || (source === 'bolt' ? 'Bolt' : 'MCP')).trim() || (source === 'bolt' ? 'Bolt' : 'MCP');

        // Check duplicate
        const existing = await db.prepare(
          'SELECT id FROM templates WHERE template_id = ? AND COALESCE(is_deleted, 0) = 0'
        ).bind(templateId).first();

        if (existing) {
          // Update existing template
          await db.prepare(`
            UPDATE templates SET
              name = ?, description = ?, category = ?, badge = ?,
              source_code = ?, files = ?, updated_at = ?
            WHERE id = ?
          `).bind(
            name,
            body.description || '',
            body.category || 'general',
            badge,
            body.sourceCode || body.source_code || '',
            filesJson,
            now,
            existing.id
          ).run();

          const updated = await db.prepare('SELECT * FROM templates WHERE id = ?').bind(existing.id).first();
          if (updated) {
            await createTemplateVersionSnapshot(db, updated, `Updated via MCP (${source})`);
          }
          return json({ id: existing.id, action: 'updated', success: true });
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
            body.category || 'general',
            badge,
            body.sourceCode || body.source_code || '',
            filesJson, now, now, status, null
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

        return json({ id, action: 'created', success: true }, 201);
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
        await ensureTemplateManagerSchema(db);
        const body = await request.json();
        const id = body.id || uid();
        const now = new Date().toISOString();
        const templateId = String(body.templateId || '').trim();
        const status = String(body.status || 'draft').toLowerCase();
        const normalizedStatus = ['draft', 'active', 'deprecated', 'archived'].includes(status) ? status : 'draft';
        if (!isValidTemplateId(templateId)) {
          return json({ error: 'Invalid templateId. Use letters, numbers, and hyphens (2-64 chars).' }, 400);
        }

        // Check if template_id already exists
        const existing = await db.prepare('SELECT id FROM templates WHERE template_id = ? AND COALESCE(is_deleted, 0) = 0').bind(templateId).first();
        if (existing) {
          return json({ error: 'Template ID already exists' }, 400);
        }

        const filesJson = body.files ? JSON.stringify(body.files) : '{}';
        try {
          await db.prepare(`
            INSERT INTO templates (
              id, template_id, name, description, category, badge,
              source_code, files, created_at, updated_at, is_deleted, status, current_version, archived_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 1, ?)
          `).bind(
            id,
            templateId,
            body.name || '',
            body.description || '',
            body.category || 'general',
            body.badge || 'New',
            body.sourceCode || '',
            filesJson,
            now,
            now,
            normalizedStatus,
            normalizedStatus === 'archived' ? now : null
          ).run();
        } catch (insertErr) {
          if (String(insertErr?.message || '').includes('UNIQUE constraint failed')) {
            return json({ error: `Template ID "${templateId}" already exists. Choose a different ID.` }, 400);
          }
          throw insertErr;
        }

        const templateRow = await db.prepare('SELECT * FROM templates WHERE id = ?').bind(id).first();
        if (templateRow) {
          await createTemplateVersionSnapshot(db, templateRow, body.note || 'Initial version');
        }

        return json({ id, success: true }, 201);
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
        if (Object.prototype.hasOwnProperty.call(body, 'category')) { fields.push('category = ?'); values.push(body.category || 'general'); }
        if (Object.prototype.hasOwnProperty.call(body, 'badge')) { fields.push('badge = ?'); values.push(body.badge || 'New'); }
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

      // ═══ OPS: DOMAINS ═══
      if (path == '/api/ops/domains' && method === 'GET') {
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

      // ═══ INIT — Bootstrap Endpoint ═══
      // Returns settings + sites + deploys + ops for the app to hydrate on load.
      // IMPORTANT: Returns neonUrl in plain text so the frontend can auto-connect Neon
      // on new devices/browsers where localStorage is empty.
      if (path === '/api/init-legacy' && method === 'GET') {
        const [settingsRows, sitesRows, deploysRows] = await Promise.all([
          db.prepare('SELECT key, value FROM settings').all(),
          db.prepare('SELECT * FROM sites ORDER BY updated_at DESC').all(),
          db.prepare('SELECT * FROM deploy_history ORDER BY deploy_time DESC LIMIT 100').all(),
        ]);

        const settings = {};
        settingsRows.results.forEach(r => { settings[r.key] = r.value; });

        // Ops data
        const [domains, accounts, profiles, payments, logs] = await Promise.all([
          db.prepare('SELECT * FROM ops_domains ORDER BY created_at DESC').all(),
          db.prepare('SELECT * FROM ops_accounts ORDER BY created_at DESC').all(),
          db.prepare('SELECT * FROM ops_profiles ORDER BY created_at DESC').all(),
          db.prepare('SELECT * FROM ops_payments ORDER BY created_at DESC').all(),
          db.prepare('SELECT * FROM ops_logs ORDER BY created_at DESC LIMIT 50').all(),
        ]);

        return json({
          settings,
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

      // ═══ STATS (computed) ═══
      if (path === '/api/stats' && method === 'GET') {
        const sites = await db.prepare('SELECT COUNT(*) as count, COALESCE(SUM(cost),0) as spend FROM sites').first();
        const deploys = await db.prepare('SELECT COUNT(*) as count FROM deploys').first();
        const domains = await db.prepare('SELECT COUNT(*) as count FROM ops_domains').first();
        return json({
          builds: sites.count,
          spend: sites.spend,
          deployed: deploys.count,
          domains: domains.count,
        });
      }

      // ═══ ALL DATA (initial load) ═══
      if (path === '/api/init' && method === 'GET') {
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

        const [sites, deploys, variants, domains, accounts, profiles, payments, logs, settingsRows, stats, cfAccountsResults, registrarAccountsResults, deploymentsResults] = await Promise.all([
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
          safeAll('SELECT * FROM cf_accounts ORDER BY label ASC'),
          safeAll('SELECT * FROM registrar_accounts ORDER BY provider ASC, label ASC'),
          safeAll('SELECT * FROM ops_deployments ORDER BY created_at DESC LIMIT 50'),
        ]);

        const settingsObj = {};
        settingsRows.forEach(r => { settingsObj[r.key] = r.value; });

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
          cfAccounts: cfAccountsResults.map(snakeToCamel),
          registrarAccounts: registrarAccountsResults.map(snakeToCamel),
          settings: redactSettings(settingsObj),
          stats: { builds: stats.builds || 0, spend: stats.spend || 0 },
          integrations: {
            lcConfigured: !!settingsObj.lcToken,
            mlConfigured: !!settingsObj.mlToken,
            netlifyConfigured: !!settingsObj.netlifyToken,
          },
        });
      }

      // ═══ LEADINGCARDS PROXY ═══
      if (path === '/api/lc/cards' && method === 'GET') {
        const lc = await getLcSettings(db);
        if (!lc.lcToken) return json({ error: 'LeadingCards token not configured' }, 400);
        const params = new URLSearchParams(url.search);
        if (lc.lcTeamUuid) params.set('team_uuid', lc.lcTeamUuid);
        const res = await fetch(`https://app.leadingcards.media/v1/cards/?${params.toString()}`, {
          headers: { 'Authorization': `Token ${lc.lcToken}`, 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        return json(data, res.status);
      }

      if (path.match(/^\/api\/lc\/cards\/[\w-]+$/) && method === 'GET') {
        const lc = await getLcSettings(db);
        if (!lc.lcToken) return json({ error: 'LeadingCards token not configured' }, 400);
        const parts = path.split('/');
        const uuid = parts.pop();
        const res = await fetch(`https://app.leadingcards.media/v1/cards/${uuid}/`, {
          headers: { 'Authorization': `Token ${lc.lcToken}`, 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        return json(data, res.status);
      }

      if (path === '/api/lc/cards' && method === 'POST') {
        const lc = await getLcSettings(db);
        if (!lc.lcToken) return json({ error: 'LeadingCards token not configured' }, 400);
        const body = await request.json();
        if (lc.lcTeamUuid) body.team_uuid = lc.lcTeamUuid;
        const res = await fetch('https://app.leadingcards.media/v1/cards/', {
          method: 'POST',
          headers: { 'Authorization': `Token ${lc.lcToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        return json(data, res.status);
      }

      if (path.match(/^\/api\/lc\/cards\/[\w-]+\/(block|activate)$/) && method === 'PUT') {
        const lc = await getLcSettings(db);
        if (!lc.lcToken) return json({ error: 'LeadingCards token not configured' }, 400);
        const parts = path.split('/');
        const action = parts.pop();
        const uuid = parts.pop();
        const res = await fetch(`https://app.leadingcards.media/v1/cards/${uuid}/${action}/`, {
          method: 'PUT',
          headers: { 'Authorization': `Token ${lc.lcToken}`, 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        return json(data, res.status);
      }

      if (path.match(/^\/api\/lc\/cards\/[\w-]+\/change_limit$/) && method === 'PUT') {
        const lc = await getLcSettings(db);
        if (!lc.lcToken) return json({ error: 'LeadingCards token not configured' }, 400);
        const parts = path.split('/');
        parts.pop(); // change_limit
        const uuid = parts.pop();
        const body = await request.json();
        const res = await fetch(`https://app.leadingcards.media/v1/cards/${uuid}/change_limit/`, {
          method: 'PUT',
          headers: { 'Authorization': `Token ${lc.lcToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        return json(data, res.status);
      }

      if (path.match(/^\/api\/lc\/(bins|billing|tags|transactions|teams)$/) && method === 'GET') {
        const lc = await getLcSettings(db);
        if (!lc.lcToken) return json({ error: 'LeadingCards token not configured' }, 400);
        const resource = path.split('/').pop();
        const apiMap = { bins: 'cards/bins', billing: 'billing_addresses', tags: 'tags', transactions: 'transactions', teams: 'teams' };
        const endpoint = apiMap[resource];
        const params = new URLSearchParams(url.search);
        const res = await fetch(`https://app.leadingcards.media/v1/${endpoint}/?${params.toString()}`, {
          headers: { 'Authorization': `Token ${lc.lcToken}`, 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        return json(data, res.status);
      }

      if (path === '/api/lc/billing' && method === 'POST') {
        const lc = await getLcSettings(db);
        if (!lc.lcToken) return json({ error: 'LeadingCards token not configured' }, 400);
        const body = await request.json();
        const res = await fetch('https://app.leadingcards.media/v1/billing_addresses/', {
          method: 'POST',
          headers: { 'Authorization': `Token ${lc.lcToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        return json(data, res.status);
      }

      // ═══ MULTILOGIN PROXY ═══
      if (path === '/api/ml/signin' && method === 'POST') {
        const ml = await getMlSettings(db);
        if (!ml.mlEmail || !ml.mlPassword) return json({ error: 'Multilogin email/password not configured' }, 400);
        const res = await fetch('https://api.multilogin.com/user/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: ml.mlEmail, password: ml.mlPassword }),
        });
        const data = await res.json();
        if (data.data?.token) {
          await db.prepare(`
            INSERT INTO settings (key, value, updated_at) VALUES ('mlToken', ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')
          `).bind(data.data.token, data.data.token).run();
        }
        return json(data, res.status);
      }

      if (path === '/api/ml/refresh-token' && method === 'POST') {
        const ml = await getMlSettings(db);
        if (!ml.mlToken) return json({ error: 'Multilogin token not configured' }, 400);
        const res = await fetch('https://api.multilogin.com/user/refresh_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ml.mlToken}` },
        });
        const data = await res.json();
        if (data.data?.token) {
          await db.prepare(`
            INSERT INTO settings (key, value, updated_at) VALUES ('mlToken', ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')
          `).bind(data.data.token, data.data.token).run();
        }
        return json(data, res.status);
      }

      if (path === '/api/ml/profiles' && method === 'GET') {
        const ml = await getMlSettings(db);
        if (!ml.mlToken) return json({ error: 'Multilogin token not configured' }, 400);
        const params = new URLSearchParams(url.search);
        const res = await fetch(`https://api.multilogin.com/profile/list?${params.toString()}`, {
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ml.mlToken}` },
        });
        const data = await res.json();
        return json(data, res.status);
      }

      if (path === '/api/ml/profiles' && method === 'POST') {
        const ml = await getMlSettings(db);
        if (!ml.mlToken) return json({ error: 'Multilogin token not configured' }, 400);
        const body = await request.json();
        const res = await fetch('https://api.multilogin.com/profile/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ml.mlToken}` },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        return json(data, res.status);
      }

      if (path.match(/^\/api\/ml\/profiles\/[\w-]+\/(start|stop)$/) && method === 'POST') {
        const ml = await getMlSettings(db);
        if (!ml.mlToken) return json({ error: 'Multilogin token not configured' }, 400);
        const parts = path.split('/');
        const action = parts.pop();
        const profileId = parts.pop();
        const res = await fetch(`https://api.multilogin.com/profile/${action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ml.mlToken}` },
          body: JSON.stringify({ profile_id: profileId }),
        });
        const data = await res.json();
        return json(data, res.status);
      }

      if (path.match(/^\/api\/ml\/profiles\/[\w-]+\/clone$/) && method === 'POST') {
        const ml = await getMlSettings(db);
        if (!ml.mlToken) return json({ error: 'Multilogin token not configured' }, 400);
        const parts = path.split('/');
        parts.pop(); // clone
        const profileId = parts.pop();
        const res = await fetch('https://api.multilogin.com/profile/clone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ml.mlToken}` },
          body: JSON.stringify({ profile_id: profileId }),
        });
        const data = await res.json();
        return json(data, res.status);
      }

      // ═══════════════════════════════════════════════════════════════════════════════
      // VOLUUM API PROXY
      // ═══════════════════════════════════════════════════════════════════════════════
      if (path === '/api/voluum/session' && method === 'POST') {
        const body = await request.json();
        const res = await fetch('https://api.voluum.com/auth/access/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(body)
        });
        const data = await res.json().catch(() => ({}));
        return json(data, res.status);
      }

      if (path === '/api/voluum/report' && method === 'GET') {
        const token = request.headers.get('cwauth-token');
        if (!token) return json({ error: 'Missing cwauth-token proxy header' }, 401);
        const params = new URLSearchParams(url.search);
        const res = await fetch(`https://api.voluum.com/report?${params.toString()}`, {
          headers: { 'Accept': 'application/json', 'cwauth-token': token }
        });
        const data = await res.json().catch(() => ({}));
        return json(data, res.status);
      }

      if (path === '/api/voluum/proxy' && method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const token = String(body?.token || '').trim();
        const proxyMethod = String(body?.method || 'GET').toUpperCase();
        const proxyPath = String(body?.path || '').trim();
        const proxyBody = body?.body;

        if (!token) return json({ error: 'Missing Voluum token' }, 401);
        if (!proxyPath || !proxyPath.startsWith('/')) {
          return json({ error: 'Invalid Voluum path; expected path starting with "/"' }, 400);
        }
        if (proxyPath.includes('://') || proxyPath.includes('..')) {
          return json({ error: 'Invalid Voluum path' }, 400);
        }
        if (!['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(proxyMethod)) {
          return json({ error: `Unsupported method: ${proxyMethod}` }, 400);
        }

        const targetUrl = `https://api.voluum.com${proxyPath}`;
        const headers = {
          'Accept': 'application/json',
          'cwauth-token': token,
        };
        const init = { method: proxyMethod, headers };
        if (proxyMethod !== 'GET' && proxyMethod !== 'DELETE' && proxyBody !== undefined) {
          headers['Content-Type'] = 'application/json';
          init.body = JSON.stringify(proxyBody);
        }

        const res = await fetch(targetUrl, init);
        const text = await res.text();
        let data;
        try {
          data = text ? JSON.parse(text) : {};
        } catch (_e) {
          data = { raw: text };
        }
        return json(data, res.status);
      }

      // ═══════════════════════════════════════════════════════════════════════════════
      // AUTOMATION API — Structured endpoints for external automation tools
      // ═══════════════════════════════════════════════════════════════════════════════

      // ═══ REGISTRAR AUTOMATION ═══
      if (path === '/api/automation/registrar/check' && method === 'POST') {
        const body = await request.json();
        const { domain, provider, accountId } = body;
        if (!domain || !provider) return json({ error: 'Missing domain or provider' }, 400);

        const acctRow = accountId
          ? await db.prepare('SELECT * FROM registrar_accounts WHERE id = ?').bind(accountId).first()
          : await db.prepare('SELECT * FROM registrar_accounts WHERE provider = ? LIMIT 1').bind(provider).first();
        if (!acctRow) return json({ error: 'Registrar account not found' }, 404);

        const apiUrl = `https://api.internet.bs/Domain/Check`;
        const formData = new URLSearchParams({
          ApiKey: acctRow.api_key,
          Password: acctRow.secret_key,
          responseformat: 'JSON',
          Domain: domain,
        });

        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString(),
        });
        const data = await res.json();
        return json({
          success: data.status?.toLowerCase() !== 'failure',
          available: data.status?.toLowerCase() === 'available',
          domain,
          provider,
          status: data.status,
          message: data.message,
        });
      }

      if (path === '/api/automation/registrar/register' && method === 'POST') {
        const body = await request.json();
        const { domain, provider, accountId, period = '1Y' } = body;
        if (!domain || !provider) return json({ error: 'Missing domain or provider' }, 400);

        const acctRow = accountId
          ? await db.prepare('SELECT * FROM registrar_accounts WHERE id = ?').bind(accountId).first()
          : await db.prepare('SELECT * FROM registrar_accounts WHERE provider = ? LIMIT 1').bind(provider).first();
        if (!acctRow) return json({ error: 'Registrar account not found' }, 404);

        const apiUrl = `https://api.internet.bs/Domain/Create`;
        const formData = new URLSearchParams({
          ApiKey: acctRow.api_key,
          Password: acctRow.secret_key,
          responseformat: 'JSON',
          Domain: domain,
          Period: period,
        });

        // Add nameservers if provided
        if (body.nameservers && Array.isArray(body.nameservers)) {
          body.nameservers.forEach((ns, i) => {
            formData.append(`Ns${i + 1}`, ns);
          });
        }

        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString(),
        });
        const data = await res.json();
        const success = data.status?.toLowerCase() === 'success';
        return json({
          success,
          domain,
          provider,
          transactionId: data.transactid,
          status: data.status,
          message: data.message,
          product: data.product,
        });
      }

      if (path === '/api/automation/registrar/credentials' && method === 'POST') {
        const body = await request.json();
        const { provider, accountId } = body;
        const acctRow = accountId
          ? await db.prepare('SELECT * FROM registrar_accounts WHERE id = ?').bind(accountId).first()
          : await db.prepare('SELECT * FROM registrar_accounts WHERE provider = ? LIMIT 1').bind(provider).first();
        if (!acctRow) return json({ error: 'Registrar account not found' }, 404);
        return json({ apiKey: acctRow.api_key, secretKey: acctRow.secret_key, provider: acctRow.provider });
      }

      if (path === '/api/automation/registrar/nameservers' && method === 'PUT') {
        const body = await request.json();
        const { domain, nameservers, provider, accountId } = body;
        if (!domain || !nameservers || !Array.isArray(nameservers)) return json({ error: 'Missing domain or nameservers' }, 400);

        const cleanedNameservers = canonicalizeNameservers(nameservers);
        if (cleanedNameservers.length < 2) {
          return json({ error: 'At least 2 valid nameservers are required' }, 400);
        }

        const acctRow = accountId
          ? await db.prepare('SELECT * FROM registrar_accounts WHERE id = ?').bind(accountId).first()
          : await db.prepare('SELECT * FROM registrar_accounts WHERE provider = ? LIMIT 1').bind(provider).first();
        if (!acctRow) return json({ error: 'Registrar account not found' }, 404);

        // Whitelist worker's actual outbound IP in InternetBS before calling Domain/Update
        // Use api64.ipify.org which returns the real IP used (IPv6 or IPv4)
        try {
          const ipRes = await fetch('https://api64.ipify.org?format=json').catch(() => null);
          const ipData = await ipRes?.json().catch(() => ({}));
          const workerIp = ipData?.ip;
          const isIPv6 = workerIp?.includes(':');
          console.log('[IBS] Worker outbound IP:', workerIp, isIPv6 ? '(IPv6 - skipping whitelist, add CF IPv4 ranges manually)' : '');
          if (workerIp && !isIPv6) {
            const f = new URLSearchParams({ ApiKey: acctRow.api_key, Password: acctRow.secret_key, responseformat: 'JSON', Ip: workerIp });
            const r = await fetch('https://api.internet.bs/Account/Access/AddIp', {
              method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: f.toString(),
            }).catch(() => null);
            const d = await r?.json().catch(() => ({}));
            console.log(`[IBS] AddIp ${workerIp}:`, d?.status, d?.message);
          }
        } catch (_e) { console.warn('[IBS] IP whitelist failed:', _e?.message); }

        // Pre-check to avoid unnecessary registrar updates.
        const beforeCheck = await fetchInternetBsCurrentNameservers(acctRow, domain);
        if (beforeCheck.success && beforeCheck.nameservers.length >= 2 && nameserversMatch(beforeCheck.nameservers, cleanedNameservers)) {
          return json({
            success: true,
            domain,
            nameservers: cleanedNameservers,
            currentNameservers: beforeCheck.nameservers,
            alreadySynced: true,
            verified: true,
            message: 'Nameservers already match target. No update needed.',
          });
        }

        const apiUrl = `https://api.internet.bs/Domain/Update`;
        const formData = new URLSearchParams({
          ApiKey: acctRow.api_key,
          Password: acctRow.secret_key,
          responseformat: 'JSON',
          Domain: domain,
          Ns_list: cleanedNameservers.join(','),
        });

        // Internet.bs Domain/Update expects Ns_list; Ns1/Ns2 can be rejected.

        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString(),
        });

        const rawText = await res.text();
        let data = null;
        try {
          data = JSON.parse(rawText);
        } catch (_e) {
          data = { status: 'FAILURE', message: rawText?.slice(0, 800) || 'Non-JSON response from registrar' };
        }

        const statusText = String(data?.status || '').toLowerCase();
        const isSuccess = statusText === 'success' || statusText === 'ok';
        const message = data?.message || data?.error || data?.msg || 'Unknown registrar response';

        const afterCheck = isSuccess ? await fetchInternetBsCurrentNameservers(acctRow, domain) : { success: false, nameservers: [] };
        const verified = !!(afterCheck.success && nameserversMatch(afterCheck.nameservers, cleanedNameservers));

        return json({
          success: isSuccess,
          domain,
          nameservers: cleanedNameservers,
          currentNameservers: afterCheck.success ? afterCheck.nameservers : beforeCheck.nameservers,
          verified,
          alreadySynced: false,
          status: data.status,
          message: verified ? 'Nameservers updated and verified.' : message,
          raw: data,
          verify: {
            before: beforeCheck.success ? beforeCheck.nameservers : [],
            after: afterCheck.success ? afterCheck.nameservers : [],
            beforeError: beforeCheck.success ? null : (beforeCheck.message || null),
            afterError: afterCheck.success ? null : (afterCheck.message || null),
          },
        });
      }

      if (path === '/api/automation/registrar/import' && method === 'POST') {
        const body = await request.json();
        const { provider, accountId } = body;
        if (!provider) return json({ error: 'Missing provider' }, 400);

        const acctRow = accountId
          ? await db.prepare('SELECT * FROM registrar_accounts WHERE id = ?').bind(accountId).first()
          : await db.prepare('SELECT * FROM registrar_accounts WHERE provider = ? LIMIT 1').bind(provider).first();
        if (!acctRow) return json({ error: 'Registrar account not found' }, 404);

        const apiUrl = `https://api.internet.bs/Domain/List`;
        const formData = new URLSearchParams({
          ApiKey: acctRow.api_key,
          Password: acctRow.secret_key,
          responseformat: 'JSON',
          CompactList: 'no',
        });

        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString(),
        });
        const data = await res.json();
        const domains = Array.isArray(data.domain) ? data.domain : (data.domain ? [data.domain] : []);
        return json({
          success: data.status?.toLowerCase() !== 'failure',
          provider,
          count: domains.length,
          domains: domains.map(d => ({
            domain: typeof d === 'string' ? d : d.name,
            status: typeof d === 'string' ? 'ACTIVE' : d.status,
            expiration: typeof d === 'string' ? null : d.expiration,
            autoRenew: typeof d === 'string' ? null : d.autorenew?.toLowerCase() === 'yes',
          })),
        });
      }

      if (path === '/api/automation/registrar/ping' && method === 'POST') {
        const body = await request.json();
        const { provider, accountId, apiKey, secretKey } = body;
        if (!provider) return json({ error: 'Missing provider' }, 400);

        // Support testing unsaved credentials directly from UI
        let resolvedApiKey = apiKey || '';
        let resolvedSecretKey = secretKey || '';

        if (!resolvedApiKey || !resolvedSecretKey) {
          const acctRow = accountId
            ? await db.prepare('SELECT * FROM registrar_accounts WHERE id = ?').bind(accountId).first()
            : await db.prepare('SELECT * FROM registrar_accounts WHERE provider = ? LIMIT 1').bind(provider).first();
          if (!acctRow) return json({ error: 'Registrar account not found' }, 404);
          resolvedApiKey = acctRow.api_key || '';
          resolvedSecretKey = acctRow.secret_key || '';
        }

        if (!resolvedApiKey || !resolvedSecretKey) {
          return json({ error: 'Missing registrar credentials' }, 400);
        }

        const apiUrl = `https://api.internet.bs/Account/Balance/Get`;
        const formData = new URLSearchParams({
          ApiKey: resolvedApiKey,
          Password: resolvedSecretKey,
          responseformat: 'JSON',
        });

        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: formData.toString(),
        });
        const data = await res.json();
        return json({
          success: data.status?.toLowerCase() === 'success',
          provider,
          balance: data.balance,
          currency: data.balance?.[0]?.currency,
          message: data.message,
        });
      }

      if (path === '/api/automation/registrar/ip' && method === 'GET') {
        try {
          const res = await fetch('https://api.ipify.org?format=json');
          const data = await res.json();
          return json({ success: true, ip: data.ip });
        } catch (e) {
          return json({ success: false, error: e.message }, 500);
        }
      }

      // ═══ CLOUDFLARE AUTOMATION ═══
      // Validate CF API token and account ID
      if (path === '/api/automation/cf-validate' && method === 'POST') {
        const body = await request.json();
        const { accountId, apiToken } = body;
        if (!accountId || !apiToken) return json({ error: 'Missing accountId or apiToken' }, 400);

        // Validate by fetching account info
        const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${accountId}`, {
          headers: { 'Authorization': `Bearer ${apiToken}`, 'Content-Type': 'application/json' },
        });

        if (!res.ok) {
          let errMsg = `HTTP ${res.status}`;
          try {
            const data = await res.json();
            errMsg = data.errors?.[0]?.message || errMsg;
          } catch { }
          return json({ success: false, error: errMsg }, 400);
        }

        const data = await res.json();
        if (!data.success) {
          return json({ success: false, error: data.errors?.[0]?.message || 'Invalid credentials' }, 400);
        }

        return json({ success: true, account: data.result });
      }

      if (path === '/api/automation/cf/zone' && method === 'POST') {
        const body = await request.json();
        const { domain, cfAccountId, cfApiToken, apiToken } = body;
        if (!domain || !cfAccountId) return json({ error: 'Missing domain or cfAccountId' }, 400);

        let token = cfApiToken || apiToken || '';
        let resolvedAccountId = cfAccountId;

        const acctRow = await db.prepare('SELECT api_token, account_id FROM cf_accounts WHERE id = ? OR account_id = ? LIMIT 1')
          .bind(cfAccountId, cfAccountId).first();

        if (acctRow) {
          if (!token) token = acctRow.api_token || '';
          resolvedAccountId = acctRow.account_id || cfAccountId;
        }

        if (!token) return json({ error: 'Cloudflare API token not found' }, 400);

        // First check if zone exists
        const checkRes = await fetch(`https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(domain)}`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        const checkData = await checkRes.json();
        if (checkData.success && checkData.result?.[0]) {
          let zone = checkData.result[0];
          let nameservers = normalizeNameservers(zone?.name_servers || zone?.nameServers);
          if (nameservers.length < 2 && zone?.id) {
            const nsPoll = await pollCloudflareNameservers(zone.id, {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            }, { attempts: 4, delayMs: 1500 });
            if (nsPoll.success) {
              zone = nsPoll.zone || zone;
              nameservers = nsPoll.nameservers;
            }
          }
          return json({
            success: true,
            exists: true,
            zoneId: zone.id,
            zone,
            nameservers,
            warning: nameservers.length < 2 ? 'Cloudflare nameservers are not ready yet. Retry in 10-30 seconds.' : undefined,
          });
        }

        // Create zone
        const createRes = await fetch('https://api.cloudflare.com/client/v4/zones', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: domain, account: { id: resolvedAccountId }, type: 'full' }),
        });
        const createData = await createRes.json();
        if (!createData.success) {
          return json({ success: false, error: createData.errors?.[0]?.message || 'Zone creation failed' }, 400);
        }
        let zone = createData.result;
        let nameservers = normalizeNameservers(zone?.name_servers || zone?.nameServers);
        if (nameservers.length < 2 && zone?.id) {
          const nsPoll = await pollCloudflareNameservers(zone.id, {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          }, { attempts: 4, delayMs: 1500 });
          if (nsPoll.success) {
            zone = nsPoll.zone || zone;
            nameservers = nsPoll.nameservers;
          }
        }
        return json({
          success: true,
          exists: false,
          zoneId: zone.id,
          zone,
          nameservers,
          warning: nameservers.length < 2 ? 'Cloudflare nameservers are not ready yet. Retry in 10-30 seconds.' : undefined,
        });
      }

      if (path === '/api/automation/cf/dns' && method === 'GET') {
        const zoneId = url.searchParams.get('zoneId');
        const cfAccountId = url.searchParams.get('cfAccountId');
        const apiToken = request.headers.get('x-cf-api-token') || url.searchParams.get('apiToken') || '';
        if (!zoneId || !cfAccountId) return json({ error: 'Missing zoneId or cfAccountId' }, 400);

        let token = apiToken;
        const acctRow = await db.prepare('SELECT api_token, account_id FROM cf_accounts WHERE id = ? OR account_id = ? LIMIT 1')
          .bind(cfAccountId, cfAccountId).first();

        if (acctRow) {
          if (!token) token = acctRow.api_token || '';
        }

        if (!token) return json({ error: 'Cloudflare API token not found' }, 400);

        const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        return json({ success: data.success, records: data.result || [], error: data.errors?.[0]?.message });
      }

      if (path === '/api/automation/cf/dns' && method === 'POST') {
        const body = await request.json();
        const { zoneId, cfAccountId, apiToken, type, name, content, ttl = 3600, proxied = false } = body;
        if (!zoneId || !cfAccountId || !type || !name || content === undefined) {
          return json({ error: 'Missing zoneId, cfAccountId, type, name, or content' }, 400);
        }

        let token = apiToken || '';
        const acctRow = await db.prepare('SELECT api_token, account_id FROM cf_accounts WHERE id = ? OR account_id = ? LIMIT 1')
          .bind(cfAccountId, cfAccountId).first();

        if (acctRow) {
          if (!token) token = acctRow.api_token || '';
        }

        if (!token) return json({ error: 'Cloudflare API token not found' }, 400);

        const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ type, name, content, ttl, proxied }),
        });
        const data = await res.json();
        if (!data.success) return json({ success: false, error: data.errors?.[0]?.message }, 400);
        return json({ success: true, record: data.result });
      }

      if (path === '/api/automation/cf/dns' && method === 'PUT') {
        const body = await request.json();
        const { dnsRecordId, zoneId, cfAccountId, apiToken, type, name, content, ttl, proxied } = body;
        if (!dnsRecordId || !zoneId || !cfAccountId) return json({ error: 'Missing dnsRecordId, zoneId, or cfAccountId' }, 400);

        let token = apiToken || '';
        const acctRow = await db.prepare('SELECT api_token, account_id FROM cf_accounts WHERE id = ? OR account_id = ? LIMIT 1')
          .bind(cfAccountId, cfAccountId).first();

        if (acctRow) {
          if (!token) token = acctRow.api_token || '';
        }

        if (!token) return json({ error: 'Cloudflare API token not found' }, 400);

        const updateData = {};
        if (type) updateData.type = type;
        if (name) updateData.name = name;
        if (content !== undefined) updateData.content = content;
        if (ttl !== undefined) updateData.ttl = ttl;
        if (proxied !== undefined) updateData.proxied = proxied;

        const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${dnsRecordId}`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(updateData),
        });
        const data = await res.json();
        if (!data.success) return json({ success: false, error: data.errors?.[0]?.message }, 400);
        return json({ success: true, record: data.result });
      }

      if (path === '/api/automation/cf/dns' && method === 'DELETE') {
        const dnsRecordId = url.searchParams.get('dnsRecordId');
        const zoneId = url.searchParams.get('zoneId');
        const cfAccountId = url.searchParams.get('cfAccountId');
        const apiToken = request.headers.get('x-cf-api-token') || url.searchParams.get('apiToken') || '';
        if (!dnsRecordId || !zoneId || !cfAccountId) return json({ error: 'Missing dnsRecordId, zoneId, or cfAccountId' }, 400);

        let token = apiToken;
        const acctRow = await db.prepare('SELECT api_token, account_id FROM cf_accounts WHERE id = ? OR account_id = ? LIMIT 1')
          .bind(cfAccountId, cfAccountId).first();

        if (acctRow) {
          if (!token) token = acctRow.api_token || '';
        }

        if (!token) return json({ error: 'Cloudflare API token not found' }, 400);

        const res = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${dnsRecordId}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        return json({ success: data.success });
      }

      // ═══ DEPLOY ADAPTERS ═══
      if (path === '/api/automation/deploy/vercel' && method === 'POST') {
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

      if (path === '/api/automation/deploy/netlify' && method === 'POST') {
        const body = await request.json();
        const { siteName, accessToken } = body;
        if (!siteName || !accessToken) return json({ error: 'Missing siteName or accessToken' }, 400);

        const res = await fetch(`https://api.netlify.com/api/v1/sites`, {
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

      if (path === '/api/automation/deploy/cf-pages' && method === 'POST') {
        const body = await request.json();
        const { projectName, cfAccountId } = body;
        if (!projectName || !cfAccountId) return json({ error: 'Missing projectName or cfAccountId' }, 400);

        const acctRow = await db.prepare('SELECT api_token, account_id FROM cf_accounts WHERE id = ? OR account_id = ? LIMIT 1')
          .bind(cfAccountId, cfAccountId).first();
        if (!acctRow) return json({ error: 'Cloudflare account not found' }, 404);

        const resolvedAccountId = acctRow.account_id || cfAccountId;

        const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${resolvedAccountId}/pages/projects/${encodeURIComponent(projectName)}`, {
          headers: { 'Authorization': `Bearer ${acctRow.api_token}`, 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        return json({
          success: data.success || res.status === 404,
          linked: data.success ? !!data.result : false,
          project: data.result || null,
        });
      }

      if (path === '/api/automation/deploy/cf-workers' && method === 'POST') {
        const body = await request.json();
        const { scriptName, cfAccountId } = body;
        if (!scriptName || !cfAccountId) return json({ error: 'Missing scriptName or cfAccountId' }, 400);

        const acctRow = await db.prepare('SELECT api_token, account_id FROM cf_accounts WHERE id = ? OR account_id = ? LIMIT 1')
          .bind(cfAccountId, cfAccountId).first();
        if (!acctRow) return json({ error: 'Cloudflare account not found' }, 404);

        const resolvedAccountId = acctRow.account_id || cfAccountId;

        const res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${resolvedAccountId}/workers/scripts/${encodeURIComponent(scriptName)}`, {
          headers: { 'Authorization': `Bearer ${acctRow.api_token}`, 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        return json({
          success: res.ok,
          linked: res.ok,
          script: res.ok ? { name: scriptName } : null,
        });
      }

      if (path === '/api/automation/tracking/verify' && method === 'POST') {
        const body = await request.json();
        const domain = String(body?.domain || '').trim().toLowerCase();
        const workerUrl = String(body?.workerUrl || '').trim();
        if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)) {
          return json({ error: 'Valid domain is required' }, 400);
        }

        const checks = {};
        let allPassed = true;

        if (workerUrl) {
          try {
            const healthUrl = `${workerUrl.replace(/\/+$/, '')}/__health`;
            const healthRes = await fetch(healthUrl, { method: 'GET' });
            const bodyText = await healthRes.text().catch(() => '');
            checks.workerHealth = {
              ok: healthRes.ok,
              status: healthRes.status,
              url: healthUrl,
              body: bodyText.slice(0, 120),
            };
            if (!healthRes.ok) allPassed = false;
          } catch (e) {
            checks.workerHealth = {
              ok: false,
              status: 0,
              url: workerUrl,
              error: e?.message || 'worker health request failed',
            };
            allPassed = false;
          }
        }

        const pixelUrl = `https://t.${domain}/e`;
        try {
          const payload = {
            e: 'deploy_verify',
            d: domain,
            ts: Date.now(),
            source: 'automation-tracking-verify',
          };
          const pixelRes = await fetch(pixelUrl, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(payload),
          });
          const pixelBody = await pixelRes.text().catch(() => '');
          checks.pixelEndpoint = {
            ok: pixelRes.ok,
            status: pixelRes.status,
            url: pixelUrl,
            body: pixelBody.slice(0, 120),
          };
          if (!pixelRes.ok) allPassed = false;
        } catch (e) {
          checks.pixelEndpoint = {
            ok: false,
            status: 0,
            url: pixelUrl,
            error: e?.message || 'pixel endpoint request failed',
          };
          allPassed = false;
        }

        return json({
          success: allPassed,
          checks,
          verifiedAt: new Date().toISOString(),
        });
      }

      // ═══ LEADINGCARDS AUTOMATION ═══
      if (path === '/api/automation/lc/create' && method === 'POST') {
        const lc = await getLcSettings(db);
        if (!lc.lcToken) return json({ error: 'LeadingCards token not configured' }, 400);
        const body = await request.json();
        if (lc.lcTeamUuid) body.team_uuid = lc.lcTeamUuid;

        const res = await fetch('https://app.leadingcards.media/v1/cards/', {
          method: 'POST',
          headers: { 'Authorization': `Token ${lc.lcToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        return json({
          success: res.ok,
          card: data,
          status: res.status,
        });
      }

      if (path === '/api/automation/lc/block' && method === 'POST') {
        const lc = await getLcSettings(db);
        if (!lc.lcToken) return json({ error: 'LeadingCards token not configured' }, 400);
        const body = await request.json();
        const { cardUuid } = body;
        if (!cardUuid) return json({ error: 'Missing cardUuid' }, 400);

        const res = await fetch(`https://app.leadingcards.media/v1/cards/${cardUuid}/block/`, {
          method: 'PUT',
          headers: { 'Authorization': `Token ${lc.lcToken}`, 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        return json({ success: res.ok, card: data, status: res.status });
      }

      if (path === '/api/automation/lc/activate' && method === 'POST') {
        const lc = await getLcSettings(db);
        if (!lc.lcToken) return json({ error: 'LeadingCards token not configured' }, 400);
        const body = await request.json();
        const { cardUuid } = body;
        if (!cardUuid) return json({ error: 'Missing cardUuid' }, 400);

        const res = await fetch(`https://app.leadingcards.media/v1/cards/${cardUuid}/activate/`, {
          method: 'PUT',
          headers: { 'Authorization': `Token ${lc.lcToken}`, 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        return json({ success: res.ok, card: data, status: res.status });
      }

      if (path === '/api/automation/lc/change_limit' && method === 'POST') {
        const lc = await getLcSettings(db);
        if (!lc.lcToken) return json({ error: 'LeadingCards token not configured' }, 400);
        const body = await request.json();
        const { cardUuid, limit } = body;
        if (!cardUuid || !limit) return json({ error: 'Missing cardUuid or limit' }, 400);

        const res = await fetch(`https://app.leadingcards.media/v1/cards/${cardUuid}/change_limit/`, {
          method: 'PUT',
          headers: { 'Authorization': `Token ${lc.lcToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ limit }),
        });
        const data = await res.json();
        return json({ success: res.ok, card: data, status: res.status });
      }

      // ═══ MULTILOGIN AUTOMATION ═══
      if (path === '/api/automation/ml/signin' && method === 'POST') {
        const ml = await getMlSettings(db);
        if (!ml.mlEmail || !ml.mlPassword) return json({ error: 'Multilogin credentials not configured' }, 400);

        const res = await fetch('https://api.multilogin.com/user/signin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: ml.mlEmail, password: md5(ml.mlPassword) }),
        });
        const data = await res.json();
        if (data.data?.token) {
          await db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES ('mlToken', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')`)
            .bind(data.data.token, data.data.token).run();
        }
        return json({
          success: !!data.data?.token,
          token: data.data?.token || null,
          message: data.message,
        });
      }

      if (path === '/api/automation/ml/refresh_token' && method === 'POST') {
        const ml = await getMlSettings(db);
        if (!ml.mlToken) return json({ error: 'Multilogin token not configured' }, 400);

        const res = await fetch('https://api.multilogin.com/user/refresh_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ml.mlToken}` },
        });
        const data = await res.json();
        if (data.data?.token) {
          await db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES ('mlToken', ?, datetime('now')) ON CONFLICT(key) DO UPDATE SET value = ?, updated_at = datetime('now')`)
            .bind(data.data.token, data.data.token).run();
        }
        return json({
          success: !!data.data?.token,
          token: data.data?.token || null,
          message: data.message,
        });
      }

      if (path === '/api/automation/ml/profiles' && method === 'GET') {
        const ml = await getMlSettings(db);
        if (!ml.mlToken) return json({ error: 'Multilogin token not configured' }, 400);

        const params = new URLSearchParams(url.search);
        const res = await fetch(`https://api.multilogin.com/profile/list?${params.toString()}`, {
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ml.mlToken}` },
        });
        const data = await res.json();
        return json({
          success: res.ok,
          profiles: data.data || [],
          total: data.total || 0,
        });
      }

      if (path === '/api/automation/ml/profiles' && method === 'POST') {
        const ml = await getMlSettings(db);
        if (!ml.mlToken) return json({ error: 'Multilogin token not configured' }, 400);
        const body = await request.json();

        const res = await fetch('https://api.multilogin.com/profile/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ml.mlToken}` },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        return json({
          success: !!data.data?.profile_id,
          profileId: data.data?.profile_id || null,
          profile: data.data || null,
        });
      }

      if (path === '/api/automation/ml/profiles/start' && method === 'POST') {
        const ml = await getMlSettings(db);
        if (!ml.mlToken) return json({ error: 'Multilogin token not configured' }, 400);
        const body = await request.json();
        const { profileId } = body;
        if (!profileId) return json({ error: 'Missing profileId' }, 400);

        const res = await fetch('https://api.multilogin.com/profile/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ml.mlToken}` },
          body: JSON.stringify({ profile_id: profileId }),
        });
        const data = await res.json();
        return json({
          success: !!data.data?.connection_url,
          connectionUrl: data.data?.connection_url || null,
          profileId: data.data?.profile_id || profileId,
        });
      }

      if (path === '/api/automation/ml/profiles/stop' && method === 'POST') {
        const ml = await getMlSettings(db);
        if (!ml.mlToken) return json({ error: 'Multilogin token not configured' }, 400);
        const body = await request.json();
        const { profileId } = body;
        if (!profileId) return json({ error: 'Missing profileId' }, 400);

        const res = await fetch('https://api.multilogin.com/profile/stop', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ml.mlToken}` },
          body: JSON.stringify({ profile_id: profileId }),
        });
        const data = await res.json();
        return json({
          success: res.ok,
          profileId,
          message: data.message,
        });
      }

      if (path === '/api/automation/ml/profiles/clone' && method === 'POST') {
        const ml = await getMlSettings(db);
        if (!ml.mlToken) return json({ error: 'Multilogin token not configured' }, 400);
        const body = await request.json();
        const { profileId } = body;
        if (!profileId) return json({ error: 'Missing profileId' }, 400);

        const res = await fetch('https://api.multilogin.com/profile/clone', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ml.mlToken}` },
          body: JSON.stringify({ profile_id: profileId }),
        });
        const data = await res.json();
        return json({
          success: !!data.data?.profile_id,
          newProfileId: data.data?.profile_id || null,
          profile: data.data || null,
        });
      }

      // ═══ D1 DATABASE QUERIES ═══
      // Direct SQL queries to D1 database (proxied to avoid CORS)
      if (path === '/api/automation/d1/query' && method === 'POST') {
        const body = await request.json();
        const { sql, params = [], accountId, databaseId, apiToken } = body;

        if (!sql) return json({ success: false, error: 'Missing SQL query' }, 400);
        if (!accountId) return json({ success: false, error: 'Missing accountId' }, 400);
        if (!databaseId) return json({ success: false, error: 'Missing databaseId' }, 400);
        if (!apiToken) return json({ success: false, error: 'Missing apiToken (send from request body)' }, 400);

        try {
          // Cloudflare D1 Query API
          const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;

          console.log('[D1 Query]', {
            url: url.replace(accountId, '***').replace(databaseId, '***'),
            sql: sql.substring(0, 50) + (sql.length > 50 ? '...' : ''),
            hasToken: !!apiToken,
            tokenPrefix: apiToken ? apiToken.substring(0, 10) + '...' : 'none',
          });

          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sql, params }),
          });

          const responseText = await res.text();

          if (!res.ok) {
            let errData = {};
            try {
              errData = JSON.parse(responseText);
            } catch { }

            const errorMessage = errData.errors?.[0]?.message || errData.errors?.[0]?.code || responseText || `HTTP ${res.status}`;

            console.error('[D1 Error]', {
              status: res.status,
              error: errorMessage,
              details: errData.errors?.[0] || {},
            });

            return json({
              success: false,
              error: errorMessage,
              code: errData.errors?.[0]?.code,
              details: errData.errors?.[0] || {},
              httpStatus: res.status,
            }, res.status);
          }

          const data = JSON.parse(responseText);
          return json({
            success: true,
            results: data.result?.[0]?.results || [],
          });
        } catch (e) {
          console.error('[D1 Exception]', e.message, e.stack);
          return json({ success: false, error: e.message, stack: e.stack }, 500);
        }
      }

      if (path === '/api/automation/d1/execute' && method === 'POST') {
        const body = await request.json();
        const { sql, params = [], accountId, databaseId, apiToken } = body;

        if (!sql) return json({ success: false, error: 'Missing SQL command' }, 400);
        if (!accountId) return json({ success: false, error: 'Missing accountId' }, 400);
        if (!databaseId) return json({ success: false, error: 'Missing databaseId' }, 400);
        if (!apiToken) return json({ success: false, error: 'Missing apiToken (send from request body)' }, 400);

        try {
          const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${databaseId}/query`;
          const res = await fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ sql, params }),
          });

          if (!res.ok) {
            const errData = await res.json().catch(() => ({}));
            return json({
              success: false,
              error: errData.errors?.[0]?.message || `HTTP ${res.status}`,
            }, res.status);
          }

          return json({ success: true });
        } catch (e) {
          return json({ success: false, error: e.message }, 500);
        }
      }

      // ═══ D1 DATABASE DIRECT (using env.DB binding) ═══
      // Test endpoint - no API token needed, uses Worker's D1 binding directly
      if (path === '/api/automation/d1/test' && method === 'GET') {
        try {
          // Query using env.DB binding (no token needed)
          const { results } = await env.DB
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .all();

          return json({
            success: true,
            tables: results.map(r => r.name),
            message: 'D1 connection successful',
          });
        } catch (e) {
          return json({
            success: false,
            error: e.message,
          }, 500);
        }
      }

      // ═══ D1 DATABASE DIRECT QUERY ═══
      // Execute SQL using env.DB binding directly (no API token needed)
      if (path === '/api/automation/d1/direct-query' && method === 'POST') {
        try {
          const body = await request.json();
          const { sql, params = [] } = body;

          if (!sql) return json({ success: false, error: 'Missing SQL query' }, 400);

          // Use env.DB binding directly
          const stmt = env.DB.prepare(sql);
          let result;
          if (params && params.length > 0) {
            result = await stmt.bind(...params).all();
          } else {
            result = await stmt.all();
          }

          return json({
            success: true,
            results: result.results || [],
          });
        } catch (e) {
          return json({
            success: false,
            error: e.message,
          }, 500);
        }
      }

      // ═══ AI HELPERS ═══
      function extractJson(text) {
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start === -1 || end === -1 || end < start) return null;
        return text.slice(start, end + 1);
      }

      async function callGemini(apiKey, prompt, maxTokens = 512) {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { maxOutputTokens: maxTokens, temperature: 0.7 },
            }),
          }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(`Gemini API error ${res.status}: ${data?.error?.message || JSON.stringify(data).slice(0, 100)}`);
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (!text) throw new Error('Gemini returned empty response');
        return text;
      }

      async function callAnthropic(apiKey, prompt, maxTokens = 512) {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: maxTokens,
            messages: [{ role: 'user', content: prompt }],
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(`Anthropic error ${res.status}: ${data?.error?.message || JSON.stringify(data).slice(0, 100)}`);
        const text = data?.content?.[0]?.text || '';
        if (!text) throw new Error('Anthropic returned empty response');
        return text;
      }

      async function callAI(env, body, prompt, maxTokens = 512) {
        // Key priority: request body → env secret
        const geminiKey = body.geminiKey || env.GEMINI_API_KEY || '';
        const anthropicKey = body.anthropicKey || env.ANTHROPIC_API_KEY || '';
        let lastError = '';
        // Primary: Gemini
        if (geminiKey) {
          try {
            const text = await callGemini(geminiKey, prompt, maxTokens);
            if (text) return text;
          } catch (e) { lastError = `Gemini: ${e.message}`; }
        }
        // Backup: Anthropic
        if (anthropicKey) {
          try {
            return await callAnthropic(anthropicKey, prompt, maxTokens);
          } catch (e) { lastError += ` | Anthropic: ${e.message}`; }
        }
        const hasKeys = !!(geminiKey || anthropicKey);
        if (hasKeys) throw new Error(`AI providers failed: ${lastError}`);
        throw new Error('No AI API key configured. Add Gemini API Key or Anthropic API Key in Settings.');
      }

      // ═══ AI GENERATE COPY ═══
      if (path === '/api/ai/generate-copy' && method === 'POST') {
        try {
          const body = await request.json();
          // Key resolution: request body → env secret → D1 settings
          const d1GeminiRow = await db.prepare("SELECT value FROM settings WHERE key = 'geminiKey'").first().catch(() => null);
          const d1AnthropicRow = await db.prepare("SELECT value FROM settings WHERE key = 'anthropicKey'").first().catch(() => null);
          const resolvedGeminiKey = body.geminiKey || env.GEMINI_API_KEY || (d1GeminiRow?.value || '');
          const resolvedAnthropicKey = body.anthropicKey || env.ANTHROPIC_API_KEY || (d1AnthropicRow?.value || '');
          if (!resolvedGeminiKey && !resolvedAnthropicKey) {
            return json({ error: 'No AI API key configured. Add Gemini API Key in Settings.' }, 400);
          }
          const { brand = '', loanType = 'personal loan', amountMin = 100, amountMax = 5000, lang = 'English' } = body;
          const prompt = `You are a direct-response copywriter specializing in loan landing pages.
Generate copy for a loan landing page. Respond ONLY with valid JSON, no explanation.
IMPORTANT: Never use the exact phrase "Personal Loans" in your output. Use alternatives like "personal finance", "quick funding", or "fast cash" instead.

Brand: ${brand}
Loan type: ${loanType}
Amount range: $${amountMin} – $${amountMax}
Language: ${lang}

Return this exact JSON shape:
{
  "h1": "hero headline (max 8 words, mention amount or speed)",
  "sub": "sub-headline (max 15 words, reassuring, no jargon)",
  "cta": "CTA button text (2-4 words, action verb)",
  "badge": "trust badge text (e.g. 'No Hard Credit Check')",
  "tagline": "short tagline (max 6 words)"
}`;
          const enrichedBody = { ...body, geminiKey: resolvedGeminiKey, anthropicKey: resolvedAnthropicKey };
          const text = await callAI(env, enrichedBody, prompt, 1024);
          const jsonStr = extractJson(text);
          if (!jsonStr) return json({ error: 'AI returned unexpected format', raw: text.slice(0, 300) }, 500);
          return json(JSON.parse(jsonStr));
        } catch (e) {
          return json({ error: e.message }, 500);
        }
      }

      // ═══ AI GENERATE META ═══
      if (path === '/api/ai/generate-meta' && method === 'POST') {
        try {
          const body = await request.json();
          // Key resolution: request body → env secret → D1 settings
          const d1GeminiRow = await db.prepare("SELECT value FROM settings WHERE key = 'geminiKey'").first().catch(() => null);
          const d1AnthropicRow = await db.prepare("SELECT value FROM settings WHERE key = 'anthropicKey'").first().catch(() => null);
          const resolvedGeminiKey = body.geminiKey || env.GEMINI_API_KEY || (d1GeminiRow?.value || '');
          const resolvedAnthropicKey = body.anthropicKey || env.ANTHROPIC_API_KEY || (d1AnthropicRow?.value || '');
          if (!resolvedGeminiKey && !resolvedAnthropicKey) {
            return json({ error: 'No AI API key configured. Add Gemini API Key in Settings.' }, 400);
          }
          const { brand = '', domain = '', loanType = 'personal loan', amountMin = 100, amountMax = 5000, h1 = '', cta = '', lang = 'English' } = body;
          const prompt = `You are an SEO copywriter for loan landing pages.
Generate meta title and description. Respond ONLY with valid JSON.
IMPORTANT: Never use the exact phrase "Personal Loans" in your output. Use alternatives like "personal finance", "quick funding", or "fast cash" instead.

Brand: ${brand}
Domain: ${domain}
Loan type: ${loanType}
Amount range: $${amountMin} – $${amountMax}
Hero H1: ${h1}
CTA: ${cta}
Language: ${lang}

Return this exact JSON shape:
{
  "metaTitle": "SEO title (50-60 chars, include brand and amount)",
  "metaDesc": "Meta description (140-160 chars, include CTA and amount)"
}`;
          const enrichedBody = { ...body, geminiKey: resolvedGeminiKey, anthropicKey: resolvedAnthropicKey };
          const text = await callAI(env, enrichedBody, prompt, 1024);
          const jsonStr = extractJson(text);
          if (!jsonStr) return json({ error: 'AI returned unexpected format', raw: text.slice(0, 500) }, 500);
          return json(JSON.parse(jsonStr));
        } catch (e) {
          return json({ error: e.message }, 500);
        }
      }

      // ═══ AI GENERATE TEMPLATE DESCRIPTION ═══
      if (path === '/api/ai/generate-description' && method === 'POST') {
        try {
          const body = await request.json();
          const d1GeminiRow = await db.prepare("SELECT value FROM settings WHERE key = 'geminiKey'").first().catch(() => null);
          const d1AnthropicRow = await db.prepare("SELECT value FROM settings WHERE key = 'anthropicKey'").first().catch(() => null);
          const resolvedGeminiKey = body.geminiKey || env.GEMINI_API_KEY || (d1GeminiRow?.value || '');
          const resolvedAnthropicKey = body.anthropicKey || env.ANTHROPIC_API_KEY || (d1AnthropicRow?.value || '');
          if (!resolvedGeminiKey && !resolvedAnthropicKey) {
            return json({ error: 'No AI API key configured. Add Gemini API Key in Settings.' }, 400);
          }
          const { templateName = '', format = 'astro', files = [] } = body;
          const fileList = Array.isArray(files) ? files.slice(0, 20).join(', ') : '';
          const prompt = `You are a UI component library documenter. Write a single short description (1–2 sentences, max 120 chars) for a landing page template.\n\nTemplate name: "${templateName}"\nFormat: ${format}\nKey files: ${fileList}\n\nRespond ONLY with a plain string — no JSON, no quotes, no markdown.`;
          const enrichedBody = { ...body, geminiKey: resolvedGeminiKey, anthropicKey: resolvedAnthropicKey };
          const text = await callAI(env, enrichedBody, prompt, 150);
          const desc = text.replace(/^["'\s]+|["'\s]+$/g, '').split('\n')[0].trim();
          return json({ description: desc });
        } catch (e) {
          return json({ error: e.message }, 500);
        }
      }

      // ═══ AI GENERATE REVIEWS ═══
      if (path === '/api/ai/generate-reviews' && method === 'POST') {
        try {
          const body = await request.json();
          const d1GeminiRow = await db.prepare("SELECT value FROM settings WHERE key = 'geminiKey'").first().catch(() => null);
          const d1AnthropicRow = await db.prepare("SELECT value FROM settings WHERE key = 'anthropicKey'").first().catch(() => null);
          const resolvedGeminiKey = body.geminiKey || env.GEMINI_API_KEY || (d1GeminiRow?.value || '');
          const resolvedAnthropicKey = body.anthropicKey || env.ANTHROPIC_API_KEY || (d1AnthropicRow?.value || '');
          if (!resolvedGeminiKey && !resolvedAnthropicKey) {
            return json({ error: 'No AI API key configured. Add Gemini API Key in Settings.' }, 400);
          }
          const { brand = '', loanType = 'personal finance', amountMax = 5000 } = body;
          const prompt = `You are a UX copywriter. Generate 3 short, realistic customer reviews for a ${loanType} landing page. Each review must match the loan category context. Different names, states, situations. Respond ONLY with valid JSON array.\n\nBrand: ${brand}, Amount up to: $${amountMax}\n\n[\n  {"name":"First L.","location":"City, ST","rating":5,"text":"1-2 sentence review"},\n  {...},\n  {...}\n]`;
          const enrichedBody = { ...body, geminiKey: resolvedGeminiKey, anthropicKey: resolvedAnthropicKey };
          const text = await callAI(env, enrichedBody, prompt, 512);
          const jsonStr = extractJson(text);
          if (!jsonStr) return json({ error: 'AI returned unexpected format', raw: text.slice(0, 300) }, 500);
          return json(JSON.parse(jsonStr));
        } catch (e) {
          return json({ error: e.message }, 500);
        }
      }

      return json({ error: 'Not found' }, 404);

    } catch (err) {
      console.error(err);
      return json({ error: err.message }, 500);
    }
  },
};
