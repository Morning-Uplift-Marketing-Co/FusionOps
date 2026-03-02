/**
 * Cloudflare Workers Sites Deploy (P4)
 *
 * Deploys a Worker script that serves static HTML with edge enhancements.
 * Ref: https://developers.cloudflare.com/api/resources/workers/methods/update/
 *
 * Flow:
 *   1. Build a self-contained Worker module that embeds the HTML
 *   2. Upload via PUT /accounts/{id}/workers/scripts/{name}  (multipart/form-data)
 *   3. Enable *.workers.dev subdomain
 */

import { getCfApiBase } from "../api-proxy.js";

function buildWorkerScript(assets) {
  // assets is { "/index.html": "content", "/style.css": "content", ... }
  // or string (legacy back-compat)

  let assetMap = {};
  if (typeof assets === "string") {
    assetMap["/"] = assets;
    assetMap["/index.html"] = assets;
  } else {
    // Normalize keys to start with /
    for (const [key, value] of Object.entries(assets)) {
      const normalizedKey = key.startsWith("/") ? key : `/${key}`;
      assetMap[normalizedKey] = value;
    }

    // EXPLICITLY ensure / and /index.html both exist
    // Prefer /index.html if it exists
    if (assetMap["/index.html"]) {
      assetMap["/"] = assetMap["/index.html"];
    } else if (assetMap["/"]) {
      // If only / exists, copy to /index.html
      assetMap["/index.html"] = assetMap["/"];
    } else {
      console.error("[CF Workers] No index.html content found in assets!");
      console.error("[CF Workers] Available keys:", Object.keys(assetMap));
    }
  }

  // DEBUG: Log the asset map keys
  console.log('[CF Workers] Building worker with assets keys:', Object.keys(assetMap));

  // Create JS object string for embedding
  const assetString = JSON.stringify(assetMap);

  return `
// Auto-generated Worker — serves LP with edge logic
const ASSETS = ${assetString};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    let path = url.pathname;

    // Health check
    if (path === "/__health") {
      return new Response("ok", { status: 200 });
    }

    // DEBUG: Log the requested path
    console.log('[CF Workers] Requested path:', path, 'Available keys:', Object.keys(ASSETS));

    // Normalize root path to index.html
    if (path === "/" || path === "") {
      path = "/index.html";
    }

    // Lookup asset
    let content = ASSETS[path];

    // Fallback: try without .html extension
    if (!content && path.endsWith(".html")) {
      const basePath = path.slice(0, -5);
      content = ASSETS[basePath] || ASSETS[basePath + "/index.html"];
    }

    // Fallback: if path is directory-like, try appending index.html
    if (!content && path.endsWith("/")) {
      content = ASSETS[path + "index.html"];
    }

    // Fallback: 404
    if (!content) {
      console.error('[CF Workers] Asset not found for path:', path);
      return new Response("Not Found", { status: 404 });
    }

    // Determine content type
    let contentType = "text/html;charset=UTF-8";
    if (path.endsWith(".css")) contentType = "text/css";
    if (path.endsWith(".js")) contentType = "application/javascript";
    if (path.endsWith(".json")) contentType = "application/json";
    if (path.endsWith(".png")) contentType = "image/png";
    if (path.endsWith(".jpg")) contentType = "image/jpeg";
    if (path.endsWith(".svg")) contentType = "image/svg+xml";

    // Geo-based headers (available via CF)
    const country = request.cf?.country || "US";
    const region = request.cf?.region || "";
    const city = request.cf?.city || "";

    const headers = new Headers({
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "X-Robots-Tag": "noindex, nofollow",
      "X-Frame-Options": "DENY",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Edge-Country": country,
      "X-Edge-Region": region,
      "X-Edge-City": city,
      "X-Frame-Options": "DENY",
    });

    return new Response(content, { status: 200, headers });
  }
};
`;
}

function normalizeHost(value) {
  return String(value || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

function apexCandidates(host) {
  const h = normalizeHost(host);
  if (!h) return [];
  const parts = h.split(".").filter(Boolean);
  if (parts.length <= 2) return [h];
  const candidates = [h, parts.slice(-2).join(".")];
  if (parts.length >= 3) candidates.push(parts.slice(-3).join("."));
  return [...new Set(candidates)];
}

export async function deploy(assets, site, settings) {
  const cfApiToken = (settings.cfApiToken || "").trim();
  const cfAccountId = (settings.cfAccountId || "").trim();
  if (!cfApiToken || !cfAccountId) {
    return { success: false, error: "Missing Cloudflare API Token or Account ID. Configure in Settings." };
  }
  if (!/^[0-9a-f]{32}$/i.test(cfAccountId)) {
    return { success: false, error: `Invalid Account ID: must be exactly 32 hex characters (got ${cfAccountId.length}). Check Settings.` };
  }

  const slug = (site.domain || site.brand || "lp")
    .toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").slice(0, 40);
  const scriptName = `lp-worker-${slug}-${(site.id || "x").slice(0, 6)}`;
  const auth = { Authorization: `Bearer ${cfApiToken}` };
  const cfBase = getCfApiBase();

  try {
    let finalAssets = {};
    if (typeof assets === "string") {
      finalAssets["/"] = assets;
      finalAssets["/index.html"] = assets;
    } else {
      // Normalize keys to ensure they start with '/'
      for (const [key, value] of Object.entries(assets || {})) {
        const normalizedKey = key.startsWith("/") ? key : `/${key}`;
        finalAssets[normalizedKey] = value;
      }
    }

    const indexContent = finalAssets["/index.html"] || finalAssets["/"];
    if (!indexContent || String(indexContent).length < 100) {
      return { success: false, error: "Worker deploy aborted: generated assets are missing a valid /index.html. Please rebuild the template and retry." };
    }

    if (site?._extraFiles) {
      Object.assign(finalAssets, site._extraFiles);
    }

    const workerScript = buildWorkerScript(finalAssets);

    // ── Upload Worker script (multipart/form-data) ───────────────
    //
    // The Worker upload expects:
    //   - A metadata part (JSON) specifying main_module and compat date
    //   - The worker module part (the actual JS)
    //
    const formData = new FormData();

    // Metadata part — tells CF which file is the entrypoint
    formData.append(
      "metadata",
      new Blob(
        [JSON.stringify({
          main_module: "worker.js",
          compatibility_date: "2024-09-23",
          compatibility_flags: ["nodejs_compat"],
        })],
        { type: "application/json" }
      )
    );

    // Worker module part — must match the main_module name
    formData.append(
      "worker.js",
      new Blob([workerScript], { type: "application/javascript+module" }),
      "worker.js"
    );

    const uploadRes = await fetch(
      `${cfBase}/accounts/${cfAccountId}/workers/scripts/${scriptName}`,
      {
        method: "PUT",
        headers: auth,       // Do NOT set Content-Type — browser sets multipart boundary
        body: formData,
      }
    );

    if (!uploadRes.ok) {
      const errBody = await uploadRes.text().catch(() => "");
      let errMsg = `HTTP ${uploadRes.status}`;
      try {
        const j = JSON.parse(errBody);
        errMsg = j.errors?.[0]?.message || errMsg;
      } catch (e) {
        console.warn("[CFWorkers] Failed to parse error response:", e?.message || e);
        errMsg = errBody.slice(0, 200) || errMsg;
      }
      return { success: false, error: `Worker upload failed: ${errMsg}` };
    }

    // ── Enable workers.dev subdomain ─────────────────────────────
    let url = `https://${scriptName}.workers.dev`;

    // First check the account's workers.dev subdomain
    const subdomainCheckRes = await fetch(
      `${cfBase}/accounts/${cfAccountId}/workers/subdomain`,
      { headers: { ...auth, "Content-Type": "application/json" } }
    );
    if (subdomainCheckRes.ok) {
      const subData = await subdomainCheckRes.json();
      const subdomain = subData.result?.subdomain;
      if (subdomain) {
        url = `https://${scriptName}.${subdomain}.workers.dev`;
      }
    }

    // Enable the script on the subdomain
    await fetch(
      `${cfBase}/accounts/${cfAccountId}/workers/scripts/${scriptName}/subdomain`,
      {
        method: "POST",
        headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: true }),
      }
    ).catch(() => { }); // Best-effort; deploy already succeeded

    // ── Step: Create Workers Routes for custom domain ──────────────
    // The A record (192.0.2.1 proxied) created by updateDnsAfterDeploy
    // only works when a Workers Route maps the domain to this script.
    let routeCreated = false;
    let routeError = null;
    if (site.domain) {
      try {
        // 1. Resolve zone ID robustly (handles apex + subdomain domain values)
        async function resolveZoneId(domain) {
          const candidates = apexCandidates(domain);
          for (const zName of candidates) {
            const zonesRes = await fetch(
              `${cfBase}/zones?name=${encodeURIComponent(zName)}`,
              { headers: { ...auth, "Content-Type": "application/json" } }
            );
            const zonesData = await zonesRes.json();
            const direct = zonesData.result?.[0]?.id;
            if (direct) return { zoneId: direct, zoneName: zName };
          }

          // Last fallback: scan and suffix-match
          const allRes = await fetch(
            `${cfBase}/zones?per_page=100`,
            { headers: { ...auth, "Content-Type": "application/json" } }
          );
          const allData = await allRes.json();
          const domainHost = normalizeHost(domain);
          const zones = allData.result || [];
          const matched = zones.find((z) => {
            const zn = normalizeHost(z?.name);
            return domainHost === zn || domainHost.endsWith(`.${zn}`);
          });
          return matched?.id ? { zoneId: matched.id, zoneName: matched.name } : { zoneId: null, zoneName: null };
        }

        const { zoneId, zoneName } = await resolveZoneId(site.domain);

        if (zoneId) {
          // 2. List existing routes for this zone
          const existingRoutesRes = await fetch(
            `${cfBase}/zones/${zoneId}/workers/routes`,
            { headers: { ...auth, "Content-Type": "application/json" } }
          );
          const existingRoutes = await existingRoutesRes.json();
          const routes = existingRoutes.result || [];

          // 3. Upsert route for root domain: {domain}/*
          const rootPattern = `${site.domain}/*`;
          const existingRoot = routes.find(r => r.pattern === rootPattern);
          if (existingRoot) {
            // Update existing route to point to current script
            if (existingRoot.script !== scriptName) {
              await fetch(
                `${cfBase}/zones/${zoneId}/workers/routes/${existingRoot.id}`,
                {
                  method: "PUT",
                  headers: { ...auth, "Content-Type": "application/json" },
                  body: JSON.stringify({ pattern: rootPattern, script: scriptName }),
                }
              );
              console.log(`[CFWorkers] Updated route ${rootPattern} → ${scriptName}`);
            }
          } else {
            // Create new route
            await fetch(
              `${cfBase}/zones/${zoneId}/workers/routes`,
              {
                method: "POST",
                headers: { ...auth, "Content-Type": "application/json" },
                body: JSON.stringify({ pattern: rootPattern, script: scriptName }),
              }
            );
            console.log(`[CFWorkers] Created route ${rootPattern} → ${scriptName}`);
          }

          // 4. Upsert route for tracking subdomain: t.{domain}/*
          const pixelPattern = `t.${site.domain}/*`;
          const existingPixel = routes.find(r => r.pattern === pixelPattern);
          if (existingPixel) {
            if (existingPixel.script !== scriptName) {
              await fetch(
                `${cfBase}/zones/${zoneId}/workers/routes/${existingPixel.id}`,
                {
                  method: "PUT",
                  headers: { ...auth, "Content-Type": "application/json" },
                  body: JSON.stringify({ pattern: pixelPattern, script: scriptName }),
                }
              );
              console.log(`[CFWorkers] Updated route ${pixelPattern} → ${scriptName}`);
            }
          } else {
            await fetch(
              `${cfBase}/zones/${zoneId}/workers/routes`,
              {
                method: "POST",
                headers: { ...auth, "Content-Type": "application/json" },
                body: JSON.stringify({ pattern: pixelPattern, script: scriptName }),
              }
            );
            console.log(`[CFWorkers] Created route ${pixelPattern} → ${scriptName}`);
          }

          routeCreated = true;
          console.log(`[CFWorkers] ✅ Workers Routes configured for ${site.domain} (zone: ${zoneName || zoneId})`);
        } else {
          routeError = `Zone not found for ${site.domain} in selected Cloudflare account`;
          console.warn(`[CFWorkers] ⚠️ ${routeError}`);
        }
      } catch (e) {
        routeError = e.message;
        console.warn(`[CFWorkers] ⚠️ Workers Route creation failed:`, e.message);
      }
    }

    return { success: true, url, deployId: scriptName, target: "cf-workers", routeCreated, routeError };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

