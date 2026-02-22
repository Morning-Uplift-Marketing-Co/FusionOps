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
import { updateDnsAfterDeploy as updateCfDns } from "../../services/cloudflare-dns.js";

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
  if (!cfApiToken || !cfAccountId) {
    return { success: false, error: "Missing Cloudflare API Token or Account ID. Configure in Settings." };
  }
  if (!/^[0-9a-f]{32}$/i.test(cfAccountId)) {
    return { success: false, error: `Invalid Account ID: must be exactly 32 hex characters (got ${cfAccountId.length}). Check Settings.` };
  }

  // Normalize content: string → single file, object → multi-file
  const fileEntries = typeof content === "string"
    ? { "/index.html": content }
    : Object.fromEntries(
        Object.entries(content).map(([k, v]) => [k.startsWith("/") ? k : `/${k}`, v])
      );

  const slug = (site.domain || site.brand || "lp")
    .toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").slice(0, 40);
  const projectName = `lp-${slug}-${(site.id || "x").slice(0, 6)}`;
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
      for (const [, file] of Object.entries(fileDataMap)) {
        if (!missingHashes.includes(file.hash)) continue;
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
          metadata: { contentType: "text/html" },
          base64: true,
        });
      }

      if (uploadPayload.length > 0) {
        const uploadRes = await cfFetchWithRateLimitRetry(
          `${cfBase}/pages/assets/upload`,
          { method: "POST", headers: jwtAuth, body: JSON.stringify(uploadPayload) }
        );
        if (!uploadRes.ok) {
          return { success: false, error: `File upload failed: ${uploadRes.json.errors?.[0]?.message || uploadRes.status}` };
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

    return {
      success: true,
      url,
      deployId,
      target: "cf-pages",
      dnsUpdated,
      dnsError,
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

export async function checkDeployStatus(site, settings) {
  const { cfApiToken, cfAccountId } = settings;
  if (!cfApiToken || !cfAccountId) return { success: false, error: "Missing CF credentials" };

  const projectName = (site.domain || site.brand || "lp")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 28) + "-" + String(site.id || "x").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);

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
