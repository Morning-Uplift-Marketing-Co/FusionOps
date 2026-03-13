/**
 * IP Quality Pipeline — 5-Step Validation Engine
 *
 * Validates proxy IPs before they are used with Multilogin profiles.
 *
 * Steps:
 *   1. Latency Test      — TCP round-trip < 2000ms
 *   2. ASN/ISP Check     — IPinfo: reject hosting ASNs, accept residential
 *   3. Fraud Reputation  — Scamalytics: fraud score < 40
 *   4. Proxy/VPN Detect  — IP2Location: not proxy, not VPN
 *   5. Timezone + Geo    — IPinfo timezone must match billing geo + MLX profile
 *
 * Score: 0–100
 *   >= 70 → APPROVE
 *   < 70  → REJECT
 *
 * Graceful degradation: skips steps when API keys are missing,
 * falls back to IPQS + ip-api.com (from existing proxy-checker.js)
 */

/* ────────────────── Settings ────────────────── */

function getSettings() {
  try {
    return JSON.parse(localStorage.getItem("lp_settings") || "{}");
  } catch {
    return {};
  }
}

/* ────────────────── ASN Blacklist (Hosting/DC) ────────────────── */

export const HOSTING_ASNS = {
  // Major Cloud
  "AS16509": "Amazon AWS",
  "AS14618": "Amazon AWS",
  "AS15169": "Google Cloud",
  "AS396982": "Google Cloud",
  "AS8075": "Microsoft Azure",
  "AS14061": "DigitalOcean",
  "AS13335": "Cloudflare",
  // Hosting Providers
  "AS16276": "OVH",
  "AS63949": "Linode/Akamai",
  "AS24940": "Hetzner",
  "AS20473": "Vultr/Choopa",
  "AS46606": "Unified Layer",
  "AS36352": "ColoCrossing",
  "AS55286": "B2 Net Solutions",
  "AS62567": "DigitalOcean",
  "AS132203": "Tencent Cloud",
  "AS45102": "Alibaba Cloud",
  "AS9009": "M247 (proxy farm)",
  "AS206092": "Datacamp",
  "AS395954": "GoDaddy",
  "AS26496": "GoDaddy",
  "AS19871": "Network Solutions",
  "AS30633": "Leaseweb",
};

/* ────────────────── Thai Residential ASN Whitelist ────────────────── */

export const TH_RESIDENTIAL_ASNS = {
  "AS131090": "AIS",
  "AS17552": "AIS / NT",
  "AS7470": "TRUE Corp",
  "AS38040": "TRUE Corp",
  "AS24378": "DTAC / Telenor",
  "AS45629": "3BB",
  "AS23969": "TOT",
  "AS9737": "TOT",
  "AS4651": "CAT Telecom",
  "AS132061": "CSLoxinfo",
  "AS45430": "TRUE Online",
};

/* ────────────────── Country Timezone Map ────────────────── */

export const COUNTRY_TIMEZONES = {
  "TH": ["Asia/Bangkok"],
  "US": ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Anchorage", "Pacific/Honolulu"],
  "GB": ["Europe/London"],
  "AU": ["Australia/Sydney", "Australia/Melbourne", "Australia/Brisbane", "Australia/Perth", "Australia/Adelaide"],
  "SG": ["Asia/Singapore"],
  "MY": ["Asia/Kuala_Lumpur"],
  "PH": ["Asia/Manila"],
  "IN": ["Asia/Kolkata"],
  "JP": ["Asia/Tokyo"],
  "KR": ["Asia/Seoul"],
  "DE": ["Europe/Berlin"],
  "FR": ["Europe/Paris"],
  "CA": ["America/Toronto", "America/Vancouver", "America/Edmonton", "America/Winnipeg", "America/Halifax"],
  "ID": ["Asia/Jakarta", "Asia/Makassar", "Asia/Jayapura"],
  "VN": ["Asia/Ho_Chi_Minh"],
  "TW": ["Asia/Taipei"],
  "HK": ["Asia/Hong_Kong"],
  "NZ": ["Pacific/Auckland"],
  "BR": ["America/Sao_Paulo", "America/Manaus"],
  "MX": ["America/Mexico_City", "America/Tijuana"],
};

/* ────────────────── Step 1: Latency Test ────────────────── */

async function checkLatency(ip, port) {
  const start = Date.now();
  try {
    // Use fetch to a known endpoint through proxy worker
    const settings = getSettings();
    const apiBase = settings.apiBase || "";
    const workerBase = apiBase.endsWith("/api") ? apiBase.slice(0, -4) : apiBase;

    const res = await fetch(`${workerBase}/api/proxy/resolve-ip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host: ip, port: parseInt(port) || 80, testOnly: true }),
      signal: AbortSignal.timeout(5000),
    });

    const latency = Date.now() - start;
    return { passed: latency < 2000, latencyMs: latency, warning: latency > 1000 };
  } catch (e) {
    const latency = Date.now() - start;
    // If worker isn't available, estimate with direct fetch
    return { passed: false, latencyMs: latency, error: e.message };
  }
}

/* ────────────────── Step 2: ASN/ISP Check (IPinfo) ────────────────── */

async function checkASN(ip) {
  const token = getSettings().ipinfoToken;

  // Fallback to ip-api.com (free, no key needed)
  if (!token) {
    return checkASNFallback(ip);
  }

  try {
    const res = await fetch(`https://ipinfo.io/${ip}?token=${token}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return checkASNFallback(ip);

    const data = await res.json();
    const asn = data.org ? data.org.split(" ")[0] : "";
    const isp = data.org ? data.org.replace(/^AS\d+\s*/, "") : "";
    const isHosting = !!HOSTING_ASNS[asn];
    const country = (data.country || "").toUpperCase();

    return {
      passed: !isHosting,
      asn,
      isp,
      country,
      city: data.city || "",
      region: data.region || "",
      timezone: data.timezone || "",
      source: "IPinfo",
      hostingName: isHosting ? HOSTING_ASNS[asn] : null,
    };
  } catch (e) {
    return checkASNFallback(ip);
  }
}

async function checkASNFallback(ip) {
  try {
    const fields = "status,country,countryCode,region,regionName,city,isp,org,as,proxy,hosting,timezone,query";
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=${fields}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return { passed: false, error: `ip-api HTTP ${res.status}`, source: "ip-api" };

    const data = await res.json();
    if (data.status !== "success") return { passed: false, error: data.message, source: "ip-api" };

    const asn = data.as ? data.as.split(" ")[0] : "";
    const isHosting = data.hosting === true || !!HOSTING_ASNS[asn];

    return {
      passed: !isHosting,
      asn,
      isp: data.isp || "",
      country: (data.countryCode || "").toUpperCase(),
      city: data.city || "",
      region: data.regionName || "",
      timezone: data.timezone || "",
      source: "ip-api",
      hostingName: isHosting ? (HOSTING_ASNS[asn] || "hosting/DC") : null,
    };
  } catch (e) {
    return { passed: false, error: e.message, source: "ip-api" };
  }
}

/* ────────────────── Step 3: Fraud Reputation (Scamalytics) ────────────────── */

async function checkFraud(ip) {
  const key = getSettings().scamalyticsKey;

  // Fallback to IPQS if available
  if (!key) {
    return checkFraudFallback(ip);
  }

  try {
    const res = await fetch(`https://api11.scamalytics.com/ip/${ip}?key=${key}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return checkFraudFallback(ip);

    const data = await res.json();
    const score = data.score != null ? Number(data.score) : -1;

    return {
      passed: score >= 0 && score < 40,
      fraudScore: score,
      riskLevel: data.risk || "",
      source: "Scamalytics",
    };
  } catch (e) {
    return checkFraudFallback(ip);
  }
}

async function checkFraudFallback(ip) {
  const apiKey = getSettings().ipqsApiKey;
  if (!apiKey) return { passed: true, skipped: true, source: "none", fraudScore: -1 };

  try {
    const res = await fetch(
      `https://ipqualityscore.com/api/json/ip/${apiKey}/${ip}?strictness=1&allow_public_access_points=true`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return { passed: true, skipped: true, source: "IPQS-error", fraudScore: -1 };

    const data = await res.json();
    const score = data.fraud_score != null ? Number(data.fraud_score) : -1;

    return {
      passed: score >= 0 && score < 40,
      fraudScore: score,
      source: "IPQS",
    };
  } catch (e) {
    return { passed: true, skipped: true, source: "IPQS-error", fraudScore: -1 };
  }
}

/* ────────────────── Step 4: Proxy/VPN Detection (IP2Location) ────────────────── */

async function checkProxyVPN(ip) {
  const key = getSettings().ip2locationKey;

  // Fallback to IPQS
  if (!key) {
    return checkProxyVPNFallback(ip);
  }

  try {
    const res = await fetch(`https://api.ip2location.io/?key=${key}&ip=${ip}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return checkProxyVPNFallback(ip);

    const data = await res.json();
    const isProxy = data.is_proxy === true || data.is_proxy === "true";
    const isVpn = data.is_vpn === true || data.is_vpn === "true";

    return {
      passed: !isProxy && !isVpn,
      isProxy,
      isVpn,
      proxyType: data.proxy_type || "",
      source: "IP2Location",
    };
  } catch (e) {
    return checkProxyVPNFallback(ip);
  }
}

async function checkProxyVPNFallback(ip) {
  const apiKey = getSettings().ipqsApiKey;
  if (!apiKey) return { passed: true, skipped: true, source: "none" };

  try {
    const res = await fetch(
      `https://ipqualityscore.com/api/json/ip/${apiKey}/${ip}?strictness=1`,
      { signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return { passed: true, skipped: true, source: "IPQS-error" };

    const data = await res.json();
    return {
      passed: !data.proxy && !data.vpn,
      isProxy: !!data.proxy,
      isVpn: !!data.vpn,
      source: "IPQS",
    };
  } catch {
    return { passed: true, skipped: true, source: "IPQS-error" };
  }
}

/* ────────────────── Step 5: Timezone + Geo Consistency ────────────────── */

function checkTimezoneGeo(asnResult, expectedGeo) {
  if (!expectedGeo || !expectedGeo.country) {
    return { passed: true, skipped: true, reason: "No expected geo provided" };
  }

  const ipCountry = (asnResult.country || "").toUpperCase();
  const expectedCountry = (expectedGeo.country || "").toUpperCase();
  const ipTimezone = asnResult.timezone || "";

  // Check 1: Country match
  const countryMatch = ipCountry === expectedCountry;

  // Check 2: Timezone match
  const expectedTimezones = COUNTRY_TIMEZONES[expectedCountry] || [];
  let timezoneMatch = false;

  if (expectedTimezones.length === 0) {
    // Unknown country — accept if country matches
    timezoneMatch = countryMatch;
  } else if (expectedTimezones.length === 1) {
    // Single timezone country (e.g., TH) — must exact match
    timezoneMatch = ipTimezone === expectedTimezones[0];
  } else {
    // Multi-timezone country (e.g., US) — IP timezone must be in list
    timezoneMatch = expectedTimezones.includes(ipTimezone);
  }

  // Check 3: State/region match (if specified)
  let regionMatch = true;
  if (expectedGeo.state && asnResult.region) {
    const ipRegion = asnResult.region.toLowerCase().replace(/\s+/g, "_");
    const expectedRegion = expectedGeo.state.toLowerCase().replace(/\s+/g, "_");
    regionMatch = ipRegion.includes(expectedRegion) || expectedRegion.includes(ipRegion);
  }

  // Special: Thai residential ASN whitelist
  let thResidential = null;
  if (expectedCountry === "TH" && asnResult.asn) {
    thResidential = !!TH_RESIDENTIAL_ASNS[asnResult.asn];
  }

  const passed = countryMatch && timezoneMatch;

  return {
    passed,
    countryMatch,
    timezoneMatch,
    regionMatch,
    ipCountry,
    ipTimezone,
    expectedCountry,
    expectedTimezones,
    thResidential,
    source: asnResult.source || "derived",
  };
}

/* ────────────────── Main Pipeline ────────────────── */

/**
 * Run the full 5-step IP quality pipeline.
 *
 * @param {string} ip - IP address to validate
 * @param {object} [expectedGeo] - { country: "TH", state: "", city: "" }
 * @param {object} [opts] - { port: "8080" }
 * @returns {object} { score, verdict, steps[] }
 */
export async function runQualityPipeline(ip, expectedGeo = {}, opts = {}) {
  const steps = [];

  // Step 1: Latency
  const latencyResult = await checkLatency(ip, opts.port || "80");
  steps.push({
    name: "latency",
    label: "Connectivity Test",
    ...latencyResult,
  });

  // Steps 2-4: Run in parallel
  const [asnResult, fraudResult, proxyResult] = await Promise.all([
    checkASN(ip),
    checkFraud(ip),
    checkProxyVPN(ip),
  ]);

  steps.push({
    name: "asn",
    label: "IP Intelligence (ASN/ISP)",
    ...asnResult,
  });

  steps.push({
    name: "fraud",
    label: "Fraud Reputation",
    ...fraudResult,
  });

  steps.push({
    name: "proxy_vpn",
    label: "Proxy/VPN Detection",
    ...proxyResult,
  });

  // Step 5: Timezone + Geo (uses ASN result)
  const geoResult = checkTimezoneGeo(asnResult, expectedGeo);
  steps.push({
    name: "timezone_geo",
    label: "Timezone & Geo Consistency",
    ...geoResult,
  });

  // Calculate score
  const score = calculateScore(steps);
  const verdict = score >= 70 ? "APPROVE" : "REJECT";

  return {
    ip,
    score,
    verdict,
    steps,
    // Convenience fields
    asn: asnResult.asn || "",
    isp: asnResult.isp || "",
    country: asnResult.country || "",
    city: asnResult.city || "",
    timezone: asnResult.timezone || "",
    fraudScore: fraudResult.fraudScore ?? -1,
    latencyMs: latencyResult.latencyMs ?? -1,
    isProxy: proxyResult.isProxy ?? false,
  };
}

/* ────────────────── Score Calculation ────────────────── */

function calculateScore(steps) {
  let score = 0;
  let maxScore = 0;

  // Latency: 10 pts
  const latency = steps.find(s => s.name === "latency");
  if (latency && !latency.skipped) {
    maxScore += 10;
    if (latency.passed) {
      score += latency.latencyMs < 500 ? 10 : latency.latencyMs < 1000 ? 8 : 5;
    }
  }

  // ASN: 25 pts (critical)
  const asn = steps.find(s => s.name === "asn");
  if (asn && !asn.skipped) {
    maxScore += 25;
    if (asn.passed) score += 25;
    // Hosting ASN = instant major penalty
  }

  // Fraud: 25 pts
  const fraud = steps.find(s => s.name === "fraud");
  if (fraud && !fraud.skipped) {
    maxScore += 25;
    if (fraud.passed) {
      const fs = fraud.fraudScore;
      score += fs < 10 ? 25 : fs < 20 ? 20 : fs < 30 ? 15 : 10;
    }
  }

  // Proxy/VPN: 20 pts
  const proxy = steps.find(s => s.name === "proxy_vpn");
  if (proxy && !proxy.skipped) {
    maxScore += 20;
    if (proxy.passed) score += 20;
  }

  // Timezone + Geo: 20 pts (critical)
  const geo = steps.find(s => s.name === "timezone_geo");
  if (geo && !geo.skipped) {
    maxScore += 20;
    if (geo.passed) {
      score += 20;
      // Bonus for Thai residential ASN
      if (geo.thResidential) score = Math.min(100, score + 5);
    } else if (geo.countryMatch) {
      score += 10; // Country correct but timezone wrong
    }
  }

  // Normalize to 0-100 if some steps were skipped
  if (maxScore > 0 && maxScore < 100) {
    score = Math.round((score / maxScore) * 100);
  }

  return Math.min(100, Math.max(0, score));
}

/* ────────────────── Quick Single-Check Helpers ────────────────── */

export async function quickASNCheck(ip) {
  return checkASN(ip);
}

export async function quickFraudCheck(ip) {
  return checkFraud(ip);
}

/* ────────────────── Export ────────────────── */

export const ipQualityPipeline = {
  runQualityPipeline,
  quickASNCheck,
  quickFraudCheck,
  checkTimezoneGeo,
  HOSTING_ASNS,
  TH_RESIDENTIAL_ASNS,
  COUNTRY_TIMEZONES,
};
