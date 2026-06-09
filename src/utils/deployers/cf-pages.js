/**
 * Cloudflare Pages Deploy (P1 - Primary)
 *
 * Uses the correct Wrangler-compatible Direct Upload flow:
 *   1. Ensure project exists
 *   2. Get upload JWT token
 *   3. Check which file hashes are missing (MD5)
 *   4. Upload missing files via JWT
 *   5. Register hashes (upsert-hashes)
 *   6. Create deployment with manifest
 *   7. Update DNS records if domain is configured
 *
 * IMPORTANT: CF Pages uses MD5 hashes, NOT SHA-256.
 */

import { getCfApiBase } from "../api-proxy.js";
import { updateDnsAfterDeploy as updateCfDns, ensurePixelSubdomain } from "../../services/cloudflare-dns.js";
import { resolvePixelScriptName, evaluateDeployTrackingGate } from "./deploy-tracking-gate.js";

/* ── MD5 implementation (browser-compatible) ─────────────────────── */
function md5(data) {
  // Accepts Uint8Array, returns hex string
  const K = [
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee,
    0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
    0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa,
    0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed,
    0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
    0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05,
    0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039,
    0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
    0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
  ];
  const S = [
    7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,
    5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,
    4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,
    6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21,
  ];

  // Pre-processing: add padding
  const origLen = data.length;
  const bitLen = origLen * 8;
  // Pad to 56 mod 64 bytes, then add 8-byte length
  let padded = new Uint8Array(origLen + 1 + ((55 - origLen % 64 + 64) % 64) + 8);
  padded.set(data);
  padded[origLen] = 0x80;
  // Little-endian 64-bit bit length
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, bitLen >>> 0, true);
  view.setUint32(padded.length - 4, (bitLen / 0x100000000) >>> 0, true);

  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;

  for (let i = 0; i < padded.length; i += 64) {
    const M = new Uint32Array(16);
    for (let j = 0; j < 16; j++) {
      M[j] = view.getUint32(i + j * 4, true);
    }
    let A = a0, B = b0, C = c0, D = d0;
    for (let j = 0; j < 64; j++) {
      let F, g;
      if (j < 16) { F = (B & C) | (~B & D); g = j; }
      else if (j < 32) { F = (D & B) | (~D & C); g = (5 * j + 1) % 16; }
      else if (j < 48) { F = B ^ C ^ D; g = (3 * j + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * j) % 16; }
      F = (F + A + K[j] + M[g]) >>> 0;
      A = D; D = C; C = B;
      B = (B + ((F << S[j]) | (F >>> (32 - S[j])))) >>> 0;
    }
    a0 = (a0 + A) >>> 0;
    b0 = (b0 + B) >>> 0;
    c0 = (c0 + C) >>> 0;
    d0 = (d0 + D) >>> 0;
  }

  // Output as little-endian hex
  const hex = (v) => {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, v, true);
    return Array.from(b).map(x => x.toString(16).padStart(2, "0")).join("");
  };
  return hex(a0) + hex(b0) + hex(c0) + hex(d0);
}

/* ── Helper: call CF API with JSON response ──────────────────────── */
async function cfFetch(url, opts = {}) {
  const res = await fetch(url, opts);
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

/** Match github-actions deploy config: site.cfPagesProject || lp-{domain-slug} */
export function resolvePagesProjectName(site) {
  const fromSite = String(site?.cfPagesProject || "").trim();
  if (fromSite) return fromSite;
  const slug = (site?.domain || site?.brand || "lp")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return `lp-${slug}`;
}

/** CF Pages manifest: keep /index.html + /apply.html; drop bare / and /apply duplicates */
export function normalizePagesFileEntries(fileEntries) {
  const entries = { ...fileEntries };
  if (entries["/index.html"] != null && entries["/"] != null) {
    delete entries["/"];
  }
  if (entries["/apply.html"] != null && entries["/apply"] != null) {
    delete entries["/apply"];
  }
  return entries;
}

function inferContentType(filePath) {
  const p = String(filePath || "").toLowerCase();
  if (p === "/" || p === "/apply" || p.endsWith("/")) return "text/html; charset=utf-8";
  if (p.endsWith(".html") || p.endsWith(".htm")) return "text/html; charset=utf-8";
  if (p.endsWith(".js") || p.endsWith(".mjs")) return "application/javascript; charset=utf-8";
  if (p.endsWith(".css")) return "text/css; charset=utf-8";
  if (p.endsWith(".json")) return "application/json; charset=utf-8";
  if (p.endsWith(".svg")) return "image/svg+xml";
  if (p.endsWith(".png")) return "image/png";
  if (p.endsWith(".jpg") || p.endsWith(".jpeg")) return "image/jpeg";
  if (p.endsWith(".webp")) return "image/webp";
  if (p.endsWith(".gif")) return "image/gif";
  if (p.endsWith(".ico")) return "image/x-icon";
  if (p.endsWith(".txt")) return "text/plain; charset=utf-8";
  return "application/octet-stream";
}

async function upsertWorkerRoute({ cfBase, apiAuth, zoneId, pattern, scriptName }) {
  const listRes = await fetchWithRateLimitRetry(`${cfBase}/zones/${zoneId}/workers/routes`, {
    headers: { ...apiAuth, "Content-Type": "application/json" },
  });
  if (!listRes.ok) {
    const errText = await listRes.text().catch(() => "");
    throw new Error(`Route list failed (${listRes.status}): ${errText.slice(0, 200)}`);
  }
  const listData = await listRes.json().catch(() => ({}));
  const routes = Array.isArray(listData.result) ? listData.result : [];
  const existing = routes.find((r) => r.pattern === pattern);

  if (existing) {
    if (existing.script === scriptName) return { created: false, updated: false };
    const updateRes = await fetchWithRateLimitRetry(`${cfBase}/zones/${zoneId}/workers/routes/${existing.id}`, {
      method: "PUT",
      headers: { ...apiAuth, "Content-Type": "application/json" },
      body: JSON.stringify({ pattern, script: scriptName }),
    });
    if (!updateRes.ok) {
      const errText = await updateRes.text().catch(() => "");
      throw new Error(`Route update failed for ${pattern} (${updateRes.status}): ${errText.slice(0, 200)}`);
    }
    return { created: false, updated: true };
  }

  const createRes = await fetchWithRateLimitRetry(`${cfBase}/zones/${zoneId}/workers/routes`, {
    method: "POST",
    headers: { ...apiAuth, "Content-Type": "application/json" },
    body: JSON.stringify({ pattern, script: scriptName }),
  });
  if (!createRes.ok) {
    const errText = await createRes.text().catch(() => "");
    throw new Error(`Route create failed for ${pattern} (${createRes.status}): ${errText.slice(0, 200)}`);
  }
  return { created: true, updated: false };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelayMs(res, attempt) {
  const retryAfter = Number(res?.headers?.get?.("Retry-After") || "");
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    return retryAfter * 1000;
  }
  // Exponential backoff with a sane cap.
  return Math.min(2000 * 2 ** Math.max(0, attempt - 1), 12000);
}

async function fetchWithRateLimitRetry(url, opts = {}, maxAttempts = 4) {
  let lastRes = null;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const res = await fetch(url, opts);
    lastRes = res;
    if (res.status !== 429) return res;
    if (attempt < maxAttempts) {
      const waitMs = getRetryDelayMs(res, attempt);
      await sleep(waitMs);
    }
  }
  return lastRes;
}

async function cfFetchWithRateLimitRetry(url, opts = {}, maxAttempts = 4) {
  const res = await fetchWithRateLimitRetry(url, opts, maxAttempts);
  const json = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, json };
}

export async function deploy(content, site, settings) {
  const cfApiToken = (settings.cfApiToken || "").trim();
  const cfAccountId = (settings.cfAccountId || "").trim();
  const pixelScriptName = resolvePixelScriptName(settings);
  if (!cfApiToken || !cfAccountId) {
    return { success: false, error: "Missing Cloudflare API Token or Account ID. Configure in Settings." };
  }
  if (!/^[0-9a-f]{32}$/i.test(cfAccountId)) {
    return { success: false, error: `Invalid Account ID: must be exactly 32 hex characters (got ${cfAccountId.length}). Check Settings.` };
  }

  // Normalize content: string → single file, object → multi-file
  const fileEntries = normalizePagesFileEntries(
    typeof content === "string"
      ? { "/index.html": content }
      : Object.fromEntries(
          Object.entries(content).map(([k, v]) => [k.startsWith("/") ? k : `/${k}`, v])
        )
  );

  const projectName = resolvePagesProjectName(site);

  const apiAuth = { Authorization: `Bearer ${cfApiToken}` };
  const cfBase = getCfApiBase();
  const projectsUrl = `${cfBase}/accounts/${cfAccountId}/pages/projects`;

  try {
    // ── Step 1: Ensure project exists ──────────────────────────────
    const checkRes = await fetchWithRateLimitRetry(`${projectsUrl}/${projectName}`, { headers: apiAuth });

    if (checkRes.status === 404 || !checkRes.ok) {
      const createRes = await fetchWithRateLimitRetry(projectsUrl, {
        method: "POST",
        headers: { ...apiAuth, "Content-Type": "application/json" },
        body: JSON.stringify({ name: projectName, production_branch: "main" }),
      });
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        if (createRes.status !== 409) {
          return { success: false, error: `Create project failed: ${err.errors?.[0]?.message || createRes.statusText}` };
        }
      }
    }

    // ── Step 2: Compute MD5 hashes for all files ─────────────────
    const encoder = new TextEncoder();
    const fileDataMap = {}; // { path: { data, hash } }
    const allHashes = [];
    
    for (const [filePath, fileContent] of Object.entries(fileEntries)) {
      const data = encoder.encode(fileContent);
      const hash = md5(data);
      fileDataMap[filePath] = { data, hash };
      allHashes.push(hash);
    }

    // ── Step 3: Get upload JWT token ───────────────────────────────
    const tokenRes = await cfFetchWithRateLimitRetry(
      `${projectsUrl}/${projectName}/upload-token`,
      { headers: apiAuth }
    );
    if (!tokenRes.ok || !tokenRes.json.result?.jwt) {
      return { success: false, error: `Failed to get upload token: ${tokenRes.json.errors?.[0]?.message || tokenRes.status}` };
    }
    const jwt = tokenRes.json.result.jwt;
    const jwtAuth = { Authorization: `Bearer ${jwt}`, "Content-Type": "application/json" };

    // ── Step 4: Check which files need uploading ───────────────────
    const checkMissing = await cfFetchWithRateLimitRetry(
      `${cfBase}/pages/assets/check-missing`,
      { method: "POST", headers: jwtAuth, body: JSON.stringify({ hashes: allHashes }) }
    );
    const missingHashes = checkMissing.json?.result || [];

    // ── Step 5: Upload missing files ───────────────────────────────
    if (missingHashes.length > 0) {
      const uploadPayload = [];
      const seenHashes = new Set();
      for (const [filePath, file] of Object.entries(fileDataMap)) {
        if (!missingHashes.includes(file.hash) || seenHashes.has(file.hash)) continue;
        seenHashes.add(file.hash);
        // Convert file content to base64 safely (spread operator fails > 65KB)
        let b64 = "";
        const CHUNK = 0x8000; // 32KB chunks
        for (let i = 0; i < file.data.length; i += CHUNK) {
          b64 += String.fromCharCode.apply(null, file.data.subarray(i, i + CHUNK));
        }
        b64 = btoa(b64);
        uploadPayload.push({
          key: file.hash,
          value: b64,
          metadata: { contentType: inferContentType(filePath) },
          base64: true,
        });
      }

      if (uploadPayload.length > 0) {
        const uploadRes = await cfFetchWithRateLimitRetry(
          `${cfBase}/pages/assets/upload`,
          { method: "POST", headers: jwtAuth, body: JSON.stringify(uploadPayload) }
        );
        if (!uploadRes.ok) {
          const cfErr = uploadRes.json?.errors?.[0];
          const detail =
            cfErr?.message ||
            cfErr?.code ||
            (uploadRes.json && Object.keys(uploadRes.json).length
              ? JSON.stringify(uploadRes.json).slice(0, 300)
              : null) ||
            uploadRes.status;
          return { success: false, error: `File upload failed: ${detail}` };
        }
      }
    }

    // ── Step 6: Register hashes (upsert) ───────────────────────────
    await cfFetchWithRateLimitRetry(
      `${cfBase}/pages/assets/upsert-hashes`,
      { method: "POST", headers: jwtAuth, body: JSON.stringify({ hashes: allHashes }) }
    );

    // ── Step 7: Create deployment ──────────────────────────────────
    const manifest = {};
    for (const [filePath, file] of Object.entries(fileDataMap)) {
      manifest[filePath] = file.hash;
    }
    const formData = new FormData();
    formData.append("manifest", JSON.stringify(manifest));
    formData.append("branch", "main");
    formData.append("commit_message", `Deploy ${site.domain || site.brand || "LP"} — ${new Date().toISOString()}`);

    const deployRes = await fetchWithRateLimitRetry(
      `${projectsUrl}/${projectName}/deployments`,
      { method: "POST", headers: apiAuth, body: formData }
    );

    if (!deployRes.ok) {
      const errBody = await deployRes.text().catch(() => "");
      let errMsg = `HTTP ${deployRes.status}`;
      try {
        const j = JSON.parse(errBody);
        errMsg = j.errors?.[0]?.message || errMsg;
      } catch (e) {
        console.warn("[CFPages] Failed to parse error response:", e?.message || e);
        errMsg = errBody.slice(0, 200) || errMsg;
      }
      if (deployRes.status === 429) {
        return { success: false, error: "Cloudflare Pages is rate limiting deploys (429). Please wait a bit and retry." };
      }
      return { success: false, error: `Deploy failed: ${errMsg}` };
    }

    const deployData = await deployRes.json();
    const deployId = deployData.result?.id;
    const url = deployData.result?.url || `https://${projectName}.pages.dev`;

    // ═════════════════════════════════════════════════════════════════════
    // Step 7b: Add custom domain to CF Pages project (if not already)
    // Without this, CF Pages won't serve content for the domain even
    // if DNS CNAME is correctly pointing to the pages.dev project.
    // ═════════════════════════════════════════════════════════════════════
    let customDomainAdded = false;
    let customDomainError = null;

    if (site.domain && cfAccountId && cfApiToken) {
      const domainsToAdd = [site.domain];
      // Also add www variant
      if (!site.domain.startsWith("www.")) {
        domainsToAdd.push(`www.${site.domain}`);
      }

      for (const domainName of domainsToAdd) {
        try {
          const addDomainRes = await fetchWithRateLimitRetry(
            `${projectsUrl}/${projectName}/domains`,
            {
              method: "POST",
              headers: { ...apiAuth, "Content-Type": "application/json" },
              body: JSON.stringify({ name: domainName }),
            }
          );
          if (addDomainRes.ok) {
            customDomainAdded = true;
          } else {
            const errData = await addDomainRes.json().catch(() => ({}));
            const errMsg = errData.errors?.[0]?.message || "";
            // 409 = domain already exists on the project — that's fine
            if (addDomainRes.status === 409 || errMsg.includes("already")) {
              customDomainAdded = true;
            } else {
              customDomainError = `${domainName}: ${errMsg || addDomainRes.status}`;
            }
          }
        } catch (e) {
          customDomainError = `${domainName}: ${e.message}`;
        }
      }
    }

    // ═════════════════════════════════════════════════════════════════════
    // Step 8: Update DNS records if custom domain is configured
    // ═════════════════════════════════════════════════════════════════════
    let dnsUpdated = false;
    let dnsError = null;

    if (site.domain && cfAccountId && cfApiToken) {
      try {
        const dnsResult = await updateCfDns({
          domain: site.domain,
          cfAccountId,
          cfApiToken,
          deployTarget: "cf-pages",
          deployUrl: url,
          proxied: true,
        });
        dnsUpdated = dnsResult.success;
        dnsError = dnsResult.error;
      } catch (e) {
        dnsError = e.message;
      }
    }

    // ═════════════════════════════════════════════════════════════════════
    // Step 9: Auto-provision pixel subdomain (t.{domain} → pixel worker)
    // ═════════════════════════════════════════════════════════════════════
    let pixelProvisioned = false;
    let pixelError = null;

    if (site.domain && cfAccountId && cfApiToken) {
      try {
        const pixelResult = await ensurePixelSubdomain({
          domain: site.domain,
          cfAccountId,
          cfApiToken,
          pixelScriptName,
        });
        pixelProvisioned = pixelResult.success;
        pixelError = pixelResult.error;
      } catch (e) {
        pixelError = e.message;
      }
    }

    // ═════════════════════════════════════════════════════════════════════
    // Step 10: Ensure pixel Workers Route (t.{domain}/* -> pixel worker)
    // ═════════════════════════════════════════════════════════════════════
    let pixelRouteCreated = false;
    let pixelRouteError = null;
    if (!pixelProvisioned && site.domain && cfAccountId && cfApiToken && pixelScriptName) {
      try {
        const zonesRes = await fetchWithRateLimitRetry(
          `${cfBase}/zones?name=${encodeURIComponent(site.domain)}&account.id=${encodeURIComponent(cfAccountId)}`,
          { headers: { ...apiAuth, "Content-Type": "application/json" } }
        );
        if (!zonesRes.ok) {
          const errText = await zonesRes.text().catch(() => "");
          throw new Error(`Zone lookup failed (${zonesRes.status}): ${errText.slice(0, 200)}`);
        }
        const zonesData = await zonesRes.json().catch(() => ({}));
        const zoneId = zonesData?.result?.[0]?.id;
        if (!zoneId) {
          throw new Error(`Zone not found for ${site.domain}`);
        }

        const routePattern = `t.${site.domain}/*`;
        await upsertWorkerRoute({
          cfBase,
          apiAuth,
          zoneId,
          pattern: routePattern,
          scriptName: pixelScriptName,
        });
        pixelRouteCreated = true;
      } catch (e) {
        pixelRouteError = e.message;
      }
    }

    // ═════════════════════════════════════════════════════════════════════
    // Step 11: Health-check pixel endpoint t.{domain}/e
    // ═════════════════════════════════════════════════════════════════════
    let pixelHealthOk = false;
    let pixelHealthError = null;
    if (site.domain) {
      try {
        const pixelUrl = `https://t.${site.domain}/e?e=healthcheck&ts=${Date.now()}`;
        const hc = await fetch(pixelUrl, { method: "GET", signal: AbortSignal.timeout(5000) });
        pixelHealthOk = hc.status < 400;
        if (!pixelHealthOk) {
          pixelHealthError = `Pixel endpoint returned HTTP ${hc.status}. Ensure Workers Route t.${site.domain}/* → pixel worker is set.`;
        }
      } catch (e) {
        pixelHealthError = `Pixel endpoint unreachable: ${e.message}. Ensure Workers Route t.${site.domain}/* → pixel worker is set.`;
      }
    }

    const gate = evaluateDeployTrackingGate({
      domain: site.domain,
      pixelRouteCreated: pixelRouteCreated || pixelProvisioned,
      pixelRouteError: pixelRouteError || pixelError,
      pixelHealthOk,
      pixelHealthError,
    });

    return {
      success: gate.success,
      error: gate.error,
      url,
      deployId,
      target: "cf-pages",
      customDomainAdded,
      customDomainError,
      dnsUpdated,
      dnsError,
      pixelProvisioned,
      pixelError,
      pixelRouteCreated,
      pixelRouteError,
      pixelHealthOk: gate.pixelHealthOk,
      pixelHealthError: gate.pixelHealthError,
      trackingError: gate.trackingError,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export async function checkDeployStatus(site, settings) {
  const { cfApiToken, cfAccountId } = settings;
  if (!cfApiToken || !cfAccountId) return { success: false, error: "Missing CF credentials" };

  const projectName = resolvePagesProjectName(site);

  const cfBase = getCfApiBase();
  const authH = { Authorization: `Bearer ${cfApiToken}` };

  try {
    const res = await fetch(
      `${cfBase}/accounts/${cfAccountId}/pages/projects/${projectName}/deployments?per_page=1`,
      { headers: authH }
    );
    if (!res.ok) return { success: false, error: `CF Pages API: ${res.status}` };
    const data = await res.json();
    const latest = data.result?.[0];
    if (!latest) return { success: true, status: "no_deploys", platform: "cf-pages" };

    const stateMap = { success: "live", failure: "failed", canceled: "failed", running: "building", queued: "pending" };
    return {
      success: true,
      status: stateMap[latest.latest_stage?.status] || stateMap[latest.deployment_trigger?.type] || "unknown",
      url: latest.url || `https://${projectName}.pages.dev`,
      deployId: latest.id,
      createdAt: latest.created_on,
      platform: "cf-pages",
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}
