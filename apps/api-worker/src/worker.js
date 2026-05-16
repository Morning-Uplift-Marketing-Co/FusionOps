// FusionOps V2 — Cloudflare Workers API
// Binds to D1 database "ppc-gen-claude"
// Origin: https://github.com/songsawat-w/ppc-gen-cfca
//
// Router shell: this file delegates every route to a handler module.
// All business logic lives in src/handlers/*.js and src/lib/*.js.
// Adding a new endpoint = create/extend a handler, then wire the dispatch
// here (or extend an existing handler's route table).

import { handleAnalysisRoutes } from './analysis/routes.js';
import { handleLifecycleRoutes } from './analysis/lifecycle.js';
import { corsHeaders, json } from './lib/http.js';
import { isTrustedOriginRequest } from './lib/auth.js';
import { getNeonSql, ensureNeonTables } from './lib/neon-sync.js';
import { isGtagRelayPath, handleGtagRelay } from './handlers/gtag-relay.js';
import { handleProxy } from './handlers/proxy.js';
import { handleLeadingCardsRoute } from './handlers/leadingcards.js';
import { handleMultiloginRoute } from './handlers/multilogin.js';
import { handleVoluumApiRoute } from './handlers/voluum-api.js';
import { handleOpenApiRoute } from './handlers/openapi.js';
import { handlePixelTrackingRoute } from './handlers/pixel-tracking.js';
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
import { handleAccountsRoute } from './handlers/accounts.js';
import { handleDeploymentsRoute } from './handlers/deployments.js';

export default {
  async fetch(request, env) {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    // --- FBIS Analysis routes ---
    const analysisResponse = await handleAnalysisRoutes(path, request.method, request, env);
    if (analysisResponse) return analysisResponse;
    // --- Lifecycle Engine routes ---
    const lifecycleResponse = await handleLifecycleRoutes(request, env);
    if (lifecycleResponse) return lifecycleResponse;
    // --- end FBIS ---
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

      // ═══ CF + REGISTRAR ACCOUNTS CRUD ═══
      {
        const accountsRes = await handleAccountsRoute({ request, db, path, method });
        if (accountsRes) return accountsRes;
      }

      // ═══ OPS DEPLOYMENTS + DEPLOY-CONFIGS (git-push, stats, configs) ═══
      {
        const deployRes = await handleDeploymentsRoute({ request, db, url, path, method });
        if (deployRes) return deployRes;
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
