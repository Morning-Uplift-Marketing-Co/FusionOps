/**
 * Proxy Checker — 5-Point Pre-flight Validation Engine
 *
 * Runs 5 checks in parallel before allowing a Multilogin profile to launch:
 *   1. IP Blacklist     — Check against ip-api.com + IPQualityScore
 *   2. Geo Verification — Compare proxy IP location vs expected billing geo
 *   3. DNS Leak Test    — Verify DNS resolves through proxy, not local
 *   4. Latency Check    — Measure round-trip time through proxy
 *   5. IP Type Check    — Ensure residential/mobile (not datacenter)
 *
 * Trust Score: 0–100
 *   90–100 → ✅ AUTO-LAUNCH
 *   70–89  → ⚠️ WARNING (show details, user decides)
 *   0–69   → ❌ BLOCKED (must rotate IP)
 */

/* ────────────────── Settings ────────────────── */

function getSettings() {
  try {
    return JSON.parse(localStorage.getItem("lp_settings") || "{}");
  } catch {
    return {};
  }
}

/* ────────────────── Check 1: IP Blacklist ────────────────── */

/**
 * Query ip-api.com for basic IP info + proxy/hosting flags.
 * Free tier: 45 req/min (no key needed).
 */
async function checkIpApi(ip) {
  try {
    const fields = "status,message,country,countryCode,region,regionName,city,isp,org,as,proxy,hosting,query";
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=${fields}`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return { error: `ip-api HTTP ${res.status}` };
    return res.json();
  } catch (e) {
    return { error: e.message };
  }
}

/**
 * Query IPQualityScore for fraud scoring.
 * Requires API key in settings (ipqsApiKey).
 */
async function checkIPQS(ip) {
  const apiKey = getSettings().ipqsApiKey;
  if (!apiKey) return { skipped: true, reason: "No IPQS API key configured" };

  try {
    const res = await fetch(
      `https://ipqualityscore.com/api/json/ip/${apiKey}/${ip}?strictness=1&allow_public_access_points=true`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return { error: `IPQS HTTP ${res.status}` };
    return res.json();
  } catch (e) {
    return { error: e.message };
  }
}

async function runBlacklistCheck(ip) {
  const [ipApi, ipqs] = await Promise.allSettled([
    checkIpApi(ip),
    checkIPQS(ip),
  ]);

  const ipApiResult = ipApi.status === "fulfilled" ? ipApi.value : { error: ipApi.reason?.message };
  const ipqsResult = ipqs.status === "fulfilled" ? ipqs.value : { error: ipqs.reason?.message };

  const issues = [];
  let penalty = 0;

  // ip-api checks
  if (ipApiResult.proxy === true) {
    issues.push("IP flagged as proxy by ip-api");
    penalty += 25;
  }
  if (ipApiResult.hosting === true) {
    issues.push("IP flagged as hosting/datacenter by ip-api");
    penalty += 20;
  }

  // IPQS checks
  if (!ipqsResult.skipped && !ipqsResult.error) {
    if (ipqsResult.fraud_score > 75) {
      issues.push(`High fraud score: ${ipqsResult.fraud_score}`);
      penalty += 30;
    } else if (ipqsResult.fraud_score > 50) {
      issues.push(`Elevated fraud score: ${ipqsResult.fraud_score}`);
      penalty += Math.round((ipqsResult.fraud_score - 50) * 0.5);
    }
    if (ipqsResult.is_tor) {
      issues.push("IP is a Tor exit node");
      penalty += 50;
    }
    if (ipqsResult.recent_abuse) {
      issues.push("IP has recent abuse history");
      penalty += 20;
    }
  }

  return {
    name: "IP Blacklist",
    pass: penalty === 0,
    penalty,
    issues,
    data: {
      ipApi: ipApiResult.error ? null : ipApiResult,
      ipqs: ipqsResult.skipped || ipqsResult.error ? null : ipqsResult,
    },
  };
}

/* ────────────────── Check 2: Geo Verification ────────────────── */

/**
 * Compare proxy IP geolocation against expected billing location.
 * Uses ip-api data from Check 1 (passed in to avoid duplicate request).
 */
function runGeoCheck(ipApiData, expectedCountry, expectedState) {
  const issues = [];
  let penalty = 0;

  if (!ipApiData) {
    return { name: "Geo Verification", pass: true, penalty: 0, issues: ["Skipped — no IP data"], data: null };
  }

  const ipCountry = (ipApiData.countryCode || "").toUpperCase();
  const expCountry = (expectedCountry || "").toUpperCase();

  if (expCountry && ipCountry !== expCountry) {
    issues.push(`Country mismatch: proxy=${ipCountry}, expected=${expCountry}`);
    penalty += 30;
  }

  // State check only for US accounts
  if (expCountry === "US" && expectedState && ipApiData.regionName) {
    const ipState = ipApiData.regionName.toLowerCase();
    const expState = expectedState.toLowerCase();
    if (!ipState.includes(expState) && !expState.includes(ipState)) {
      issues.push(`State mismatch: proxy=${ipApiData.regionName}, expected=${expectedState}`);
      penalty += 10; // Warning only, not a hard fail
    }
  }

  return {
    name: "Geo Verification",
    pass: penalty < 30,
    penalty,
    issues,
    data: {
      proxyCountry: ipApiData.countryCode,
      proxyRegion: ipApiData.regionName,
      proxyCity: ipApiData.city,
      expectedCountry: expCountry,
      expectedState: expectedState || "",
    },
  };
}

/* ────────────────── Check 3: DNS Leak Test ────────────────── */

/**
 * DNS leak detection — checks if DNS resolves through the proxy.
 * Routes through our Worker endpoint.
 */
async function runDnsLeakCheck(proxyConfig) {
  try {
    const apiBase = getSettings().apiBase || "";
    const workerBase = apiBase.endsWith("/api") ? apiBase.slice(0, -4) : apiBase;

    const res = await fetch(`${workerBase}/api/proxy/dns-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: proxyConfig.host,
        port: proxyConfig.port,
        username: proxyConfig.username,
        password: proxyConfig.password,
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      return { name: "DNS Leak", pass: true, penalty: 0, issues: ["DNS check endpoint unavailable — skipped"], data: null };
    }

    const data = await res.json();
    const issues = [];
    let penalty = 0;

    if (data.leak_detected) {
      issues.push(`DNS leak: DNS server country (${data.dns_country}) ≠ proxy country (${data.proxy_country})`);
      penalty += 15;
    }

    return { name: "DNS Leak", pass: !data.leak_detected, penalty, issues, data };
  } catch (e) {
    // DNS check is non-critical — degrade gracefully
    return { name: "DNS Leak", pass: true, penalty: 0, issues: [`DNS check failed: ${e.message} — skipped`], data: null };
  }
}

/* ────────────────── Check 4: Latency ────────────────── */

/**
 * Measure proxy latency by timing a request through the proxy.
 */
async function runLatencyCheck(proxyConfig) {
  try {
    const apiBase = getSettings().apiBase || "";
    const workerBase = apiBase.endsWith("/api") ? apiBase.slice(0, -4) : apiBase;

    const start = performance.now();
    const res = await fetch(`${workerBase}/api/proxy/latency-check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        host: proxyConfig.host,
        port: proxyConfig.port,
        username: proxyConfig.username,
        password: proxyConfig.password,
      }),
      signal: AbortSignal.timeout(10000),
    });

    const elapsed = Math.round(performance.now() - start);
    const issues = [];
    let penalty = 0;

    if (!res.ok) {
      return { name: "Latency", pass: false, penalty: 25, issues: [`Proxy connection failed: HTTP ${res.status}`], data: { latencyMs: null } };
    }

    const data = await res.json();
    const latency = data.latencyMs || elapsed;

    if (latency > 2000) {
      issues.push(`Very high latency: ${latency}ms`);
      penalty += 25;
    } else if (latency > 1000) {
      issues.push(`High latency: ${latency}ms`);
      penalty += 10;
    }

    return {
      name: "Latency",
      pass: latency <= 2000,
      penalty,
      issues,
      data: { latencyMs: latency },
    };
  } catch (e) {
    return { name: "Latency", pass: false, penalty: 25, issues: [`Latency check failed: ${e.message}`], data: { latencyMs: null } };
  }
}

/* ────────────────── Check 5: IP Type ────────────────── */

/**
 * Verify IP is residential or mobile — NOT datacenter.
 * Uses ip-api + IPQS data from Check 1.
 */
function runIpTypeCheck(ipApiData, ipqsData) {
  const issues = [];
  let penalty = 0;

  // ip-api hosting flag
  if (ipApiData?.hosting === true) {
    issues.push("IP identified as datacenter/hosting by ip-api");
    penalty += 40;
  }

  // IPQS detailed check
  if (ipqsData && !ipqsData.skipped) {
    if (ipqsData.is_proxy && ipqsData.proxy_type === "VPN") {
      issues.push("IP identified as VPN by IPQS");
      penalty += 20;
    }
    if (ipqsData.connection_type === "Corporate" || ipqsData.connection_type === "Data Center") {
      issues.push(`Connection type: ${ipqsData.connection_type}`);
      penalty += 40;
    }
    // Residential and Mobile are good
    if (ipqsData.connection_type === "Residential" || ipqsData.connection_type === "Mobile") {
      // Bonus: no penalty
    }
  }

  // If no data available, give benefit of doubt
  if (!ipApiData && !ipqsData) {
    return { name: "IP Type", pass: true, penalty: 0, issues: ["IP type check skipped — no data"], data: null };
  }

  return {
    name: "IP Type",
    pass: penalty === 0,
    penalty,
    issues,
    data: {
      hosting: ipApiData?.hosting,
      isp: ipApiData?.isp,
      org: ipApiData?.org,
      connectionType: ipqsData?.connection_type,
    },
  };
}

/* ────────────────── Trust Score Calculator ────────────────── */

/**
 * Calculate trust score from all check results.
 * Score = 100 - sum of penalties, clamped to 0–100.
 */
function calculateTrustScore(checks) {
  const totalPenalty = checks.reduce((sum, c) => sum + (c.penalty || 0), 0);
  const score = Math.max(0, Math.min(100, 100 - totalPenalty));

  let verdict;
  if (score >= 90) verdict = "AUTO_LAUNCH";
  else if (score >= 70) verdict = "WARNING";
  else verdict = "BLOCKED";

  return { score, verdict, totalPenalty };
}

/* ────────────────── Main: Run All Checks ────────────────── */

/**
 * Run all 5 pre-flight checks on a proxy IP.
 *
 * @param {string} ip              - The resolved proxy IP address
 * @param {object} proxyConfig     - The proxy config (for DNS/latency checks)
 * @param {object} expected        - { country, state } from billing info
 * @returns {object} { score, verdict, checks[], ip, timestamp }
 */
async function runPreflightCheck(ip, proxyConfig, expected = {}) {
  const startTime = performance.now();

  // Run Check 1 (blacklist) first since Checks 2 & 5 reuse its data
  const blacklistResult = await runBlacklistCheck(ip);
  const ipApiData = blacklistResult.data?.ipApi || null;
  const ipqsData = blacklistResult.data?.ipqs || null;

  // Run remaining checks in parallel
  const [dnsResult, latencyResult] = await Promise.allSettled([
    runDnsLeakCheck(proxyConfig),
    runLatencyCheck(proxyConfig),
  ]);

  // Sync checks (use data from blacklist)
  const geoResult = runGeoCheck(ipApiData, expected.country, expected.state);
  const ipTypeResult = runIpTypeCheck(ipApiData, ipqsData);

  const checks = [
    blacklistResult,
    geoResult,
    dnsResult.status === "fulfilled" ? dnsResult.value : { name: "DNS Leak", pass: true, penalty: 0, issues: ["Check failed"], data: null },
    latencyResult.status === "fulfilled" ? latencyResult.value : { name: "Latency", pass: false, penalty: 25, issues: ["Check failed"], data: null },
    ipTypeResult,
  ];

  const { score, verdict, totalPenalty } = calculateTrustScore(checks);
  const elapsed = Math.round(performance.now() - startTime);

  return {
    ip,
    score,
    verdict,
    totalPenalty,
    checks,
    elapsed,
    timestamp: new Date().toISOString(),
    proxyConfig: {
      host: proxyConfig.host,
      port: proxyConfig.port,
      sessionId: proxyConfig.sessionId,
    },
  };
}

/* ────────────────── Public API ────────────────── */

export const proxyChecker = {
  runPreflightCheck,
  calculateTrustScore,

  // Individual checks (for testing/debugging)
  runBlacklistCheck,
  runGeoCheck,
  runDnsLeakCheck,
  runLatencyCheck,
  runIpTypeCheck,

  // Thresholds
  SCORE_AUTO_LAUNCH: 90,
  SCORE_WARNING: 70,
  SCORE_BLOCKED: 0,
};
