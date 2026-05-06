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
import { handleSettingsRoute } from './handlers/settings.js';
import { handlePixelEventsRoute } from './handlers/pixel-events.js';
import { handleMiscRoute } from './handlers/misc.js';
import { handleTemplateThumbnailRoute, handleTemplatesRoute } from './handlers/templates.js';
import {
  ensureTemplateManagerSchema,
  getTemplateUsageMap,
  parseTemplateFiles,
  normalizeTemplateFileKey,
  getTemplateFileFromMap,
  pickTemplateHtmlForThumb,
  getTemplateQualityGateReport,
  createTemplateVersionSnapshot,
  jsonFromTemplatePostException,
  BUILTIN_TEMPLATE_IDS,
  isValidTemplateId,
  inferTemplateCategory,
  resolveCategory,
} from './lib/template-utils.js';
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

    // ═══ TEMPLATE THUMBNAILS (R2 serve + manual upload + Puppeteer screenshot) ═══
    // Auth handled per-route in handleTemplateThumbnailRoute (denyUnlessTrustedOrBearer
    // for upload/generate; serve is public).
    {
      const thumbRes = await handleTemplateThumbnailRoute({ request, env, db, url, path, method });
      if (thumbRes) return thumbRes;
    }

    // ═══ MISC SMALL ROUTES (cfg, postbacks, provision-dns, vps deploy, ai/generate-assets) ═══
    {
      const miscRes = await handleMiscRoute({ request, env, db, url, path, method });
      if (miscRes) return miscRes;
    }

    // ═══ PIXEL EVENTS QUERIES (events feed + crawler-health) ═══
    {
      const pixelEventsRes = await handlePixelEventsRoute({ env, url, path, method });
      if (pixelEventsRes) return pixelEventsRes;
    }

    // ═══ PROXY ROUTES (no auth required — proxy forwards auth headers) ═══
    if (path.startsWith('/api/proxy/')) {
      const proxyRes = await handleProxy(request, url, env);
      if (proxyRes) return proxyRes;
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

      // ═══ TEMPLATES (MCP import + CRUD + version mgmt + default) ═══
      {
        const templatesRes = await handleTemplatesRoute({ request, env, db, url, path, method });
        if (templatesRes) return templatesRes;
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

      // ═══ SETTINGS + ADSPOWER PROXY ═══
      {
        const settingsRes = await handleSettingsRoute({ request, db, neonSql, path, method });
        if (settingsRes) return settingsRes;
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
