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
import { updateDnsAfterDeploy } from "../../services/cloudflare-dns.js";
import { api } from "../../services/api.js";
import {
  resolvePixelScriptName,
  evaluateDeployTrackingGate,
  normalizeTrackingVerifyResponse,
} from "./deploy-tracking-gate.js";

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

  // Base64 encode each asset to avoid JS injection / escaping issues
  // (HTML with </script>, backticks, or unicode would break inline JSON)
  // Use browser btoa with UTF-8 safe encoding
  const b64encode = (str) => {
    try {
      // browser environment
      return btoa(unescape(encodeURIComponent(str)));
    } catch {
      // fallback: strip non-latin1 chars
      return btoa(str.replace(/[\u0080-\uFFFF]/g, '?'));
    }
  };
  const encodedMap = {};
  for (const [k, v] of Object.entries(assetMap)) {
    encodedMap[k] = b64encode(String(v));
  }
  const assetString = JSON.stringify(encodedMap);

  return `
// Auto-generated Worker — serves LP with edge logic
// Assets are base64-encoded to prevent JS injection from HTML content
const ASSETS_B64 = ${assetString};

function decodeAsset(b64) {
  try {
    return decodeURIComponent(escape(atob(b64)));
  } catch {
    return atob(b64);
  }
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    let path = url.pathname;

    // Health check
    if (path === "/__health") {
      return new Response("ok", { status: 200 });
    }

    // Normalize root path to index.html
    if (path === "/" || path === "") {
      path = "/index.html";
    }

    // Lookup asset (b64 encoded)
    let encoded = ASSETS_B64[path];

    // Fallback: try without .html extension
    if (!encoded && path.endsWith(".html")) {
      const basePath = path.slice(0, -5);
      encoded = ASSETS_B64[basePath] || ASSETS_B64[basePath + "/index.html"];
    }

    // Fallback: if path is directory-like, try appending index.html
    if (!encoded && path.endsWith("/")) {
      encoded = ASSETS_B64[path + "index.html"];
    }

    // Fallback: 404
    if (!encoded) {
      return new Response("Not Found", { status: 404 });
    }

    const content = decodeAsset(encoded);

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
    });

    return new Response(content, { status: 200, headers });
  }
};
`;
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
  const pixelScriptName = resolvePixelScriptName(settings);
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

    // ── Step: Ensure DNS records for Workers custom domain ──────────
    // Creates/updates:
    //   - A @ -> 192.0.2.1 (proxied)
    //   - A t -> 192.0.2.1 (proxied)
    //   - CNAME trk -> site.voluumCfCname (dns only)
    let dnsUpdated = false;
    let dnsError = null;
    if (site.domain && cfAccountId && cfApiToken) {
      try {
        const dnsResult = await updateDnsAfterDeploy({
          domain: site.domain,
          cfAccountId,
          cfApiToken,
          deployTarget: "cf-workers",
          deployUrl: url,
          voluumCfCname: site.voluumCfCname,
          proxied: true,
        });
        dnsUpdated = dnsResult.success;
        dnsError = dnsResult.error || null;
      } catch (e) {
        dnsError = e.message;
      }
    }

    // ── Step: Create Workers Routes for custom domain ──────────────
    // The A record (192.0.2.1 proxied) created by updateDnsAfterDeploy
    // only works when a Workers Route maps the domain to this script.
    let routeCreated = false;
    let routeError = null;
    if (site.domain) {
      try {
        // 1. Resolve zone ID for the domain
        const zonesRes = await fetch(
          `${cfBase}/zones?name=${encodeURIComponent(site.domain)}`,
          { headers: { ...auth, "Content-Type": "application/json" } }
        );
        if (!zonesRes.ok) {
          const errText = await zonesRes.text().catch(() => "");
          throw new Error(`Zone lookup failed (${zonesRes.status}): ${errText.slice(0, 200)}`);
        }
        const zonesData = await zonesRes.json();
        const zoneId = zonesData.result?.[0]?.id;

        if (zoneId) {
          // 2. List existing routes for this zone
          const existingRoutesRes = await fetch(
            `${cfBase}/zones/${zoneId}/workers/routes`,
            { headers: { ...auth, "Content-Type": "application/json" } }
          );
          if (!existingRoutesRes.ok) {
            const errText = await existingRoutesRes.text().catch(() => "");
            throw new Error(`Route list failed (${existingRoutesRes.status}): ${errText.slice(0, 200)}`);
          }
          const existingRoutes = await existingRoutesRes.json();
          const routes = existingRoutes.result || [];
          const upsertRoute = async (pattern, targetScript) => {
            const existing = routes.find(r => r.pattern === pattern);
            if (existing) {
              if (existing.script === targetScript) return;
              const updateRes = await fetch(
                `${cfBase}/zones/${zoneId}/workers/routes/${existing.id}`,
                {
                  method: "PUT",
                  headers: { ...auth, "Content-Type": "application/json" },
                  body: JSON.stringify({ pattern, script: targetScript }),
                }
              );
              if (!updateRes.ok) {
                const errText = await updateRes.text().catch(() => "");
                throw new Error(`Route update failed for ${pattern} (${updateRes.status}): ${errText.slice(0, 200)}`);
              }
              console.log(`[CFWorkers] Updated route ${pattern} → ${targetScript}`);
              return;
            }

            const createRes = await fetch(
              `${cfBase}/zones/${zoneId}/workers/routes`,
              {
                method: "POST",
                headers: { ...auth, "Content-Type": "application/json" },
                body: JSON.stringify({ pattern, script: targetScript }),
              }
            );
            if (!createRes.ok) {
              const errText = await createRes.text().catch(() => "");
              throw new Error(`Route create failed for ${pattern} (${createRes.status}): ${errText.slice(0, 200)}`);
            }
            console.log(`[CFWorkers] Created route ${pattern} → ${targetScript}`);
          };

          // 3. Upsert route for root domain: {domain}/*
          const rootPattern = `${site.domain}/*`;
          await upsertRoute(rootPattern, scriptName);

          // 4. Upsert route for tracking subdomain: t.{domain}/* -> pixel worker
          const pixelPattern = `t.${site.domain}/*`;
          await upsertRoute(pixelPattern, pixelScriptName);

          routeCreated = true;
          console.log(`[CFWorkers] ✅ Workers Routes configured for ${site.domain}`);
        } else {
          routeError = `Zone not found for ${site.domain} — add it to Cloudflare first`;
          console.warn(`[CFWorkers] ⚠️ ${routeError}`);
        }
      } catch (e) {
        routeError = e.message;
        console.warn(`[CFWorkers] ⚠️ Workers Route creation failed:`, e.message);
      }
    }

    let trackingVerification = null;
    if (site?.domain) {
      try {
        const verifyRaw = await api.post("/automation/tracking/verify", {
          domain: site.domain,
          workerUrl: url,
        });
        trackingVerification = normalizeTrackingVerifyResponse(verifyRaw);
      } catch (e) {
        trackingVerification = { success: false, error: e?.message || "Tracking verification call failed" };
      }
    }

    const gate = evaluateDeployTrackingGate({
      domain: site.domain,
      routeCreated,
      routeError,
      trackingVerification,
    });

    return {
      success: gate.success,
      error: gate.error,
      url,
      deployId: scriptName,
      target: "cf-workers",
      dnsUpdated,
      dnsError,
      routeCreated,
      routeError,
      trackingVerification,
      pixelHealthOk: gate.pixelHealthOk,
      pixelHealthError: gate.pixelHealthError,
      trackingError: gate.trackingError,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

