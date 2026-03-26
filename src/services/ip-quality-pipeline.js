/**
 * IP Quality Pipeline — 5-Step Validation Engine
 *
 * Validates proxy IPs before they are used with Multilogin profiles.
 *
 * Steps:
 *   1. Latency Test      — quick ip-api metadata RTT for exit IP (not Worker/proxy hop)
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

function readStoredSettings() {
  try {
    const host = typeof window !== "undefined" ? `${window.location.hostname}${window.location.port ? `:${window.location.port}` : ""}` : "";
    const namespaced = host ? localStorage.getItem(`lpf2:${host}:settings`) : null;
    const legacy = localStorage.getItem("lpf2-settings");
    const old = localStorage.getItem("lp_settings");
    return JSON.parse(namespaced || legacy || old || "{}");
  } catch {
    return {};
  }
}

/** Merge form / preview keys over persisted settings (Settings page tests before Save). */
export function effectiveQualitySettings(settingsMerge) {
  const base = readStoredSettings();
  return settingsMerge && typeof settingsMerge === "object" ? { ...base, ...settingsMerge } : base;
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

/**
 * Lightweight RTT to public IP metadata (NOT via residential proxy).
 * Never call Worker resolve-ip with exit `ip` as host — that was wrong and could stall health flows.
 */
async function checkLatency(ip) {
  const start = Date.now();
  try {
    const fields = "status,query";
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=${fields}`, {
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = Date.now() - start;
    if (!res.ok) {
      return { passed: false, latencyMs, error: `ip-api HTTP ${res.status}` };
    }
    const data = await res.json();
    const ok = data?.status === "success";
    return {
      passed: ok && latencyMs < 2000,
      latencyMs,
      warning: latencyMs > 1000,
      source: "ip-api",
    };
  } catch (e) {
    const latencyMs = Date.now() - start;
    return { passed: false, latencyMs, error: e.message };
  }
}

/* ────────────────── Step 2: ASN/ISP Check (IPinfo) ────────────────── */

async function checkASN(ip, cfg) {
  const token = (cfg || readStoredSettings()).ipinfoToken;

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

async function checkFraud(ip, cfg) {
  const key = (cfg || readStoredSettings()).scamalyticsKey;

  // Fallback to IPQS if available
  if (!key) {
    return checkFraudFallback(ip, cfg);
  }

  try {
    // Scamalytics V3 URL structure (based on user config)
    // Settings fields:
    //   - scamalyticsKey: e.g. "a30b2f..."
    //   - scamalyticsUsername: e.g. "api11.scamalytics.com/v3/69b454433fb5e" 
    //     (or we construct it if they just enter the "69b..." ID)
    
    let url = "";
    if (cfg.scamalyticsUsername && cfg.scamalyticsUsername.includes("/")) {
      // If user pastes the full prefix e.g. api11.scamalytics.com/v3/69b454433fb5e
      url = `https://${cfg.scamalyticsUsername.replace(/^https?:\/\//, "").replace(/\/$/, "")}/?key=${key}&ip=${ip}`;
    } else if (cfg.scamalyticsUsername) {
      // If user just pasted the ID e.g. 69b454433fb5e
      url = `https://api11.scamalytics.com/v3/${cfg.scamalyticsUsername}/?key=${key}&ip=${ip}`;
    } else {
      // Legacy V2 fallback
      url = `https://api11.scamalytics.com/ip/${ip}?key=${key}`;
    }

    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      console.warn(`[Scamalytics] API failed (${res.status}) on ${url}. Falling back to IPQS.`);
      return checkFraudFallback(ip, cfg);
    }

    const data = await res.json();
    
    // Parse V3 response vs Legacy V2 response
    const score = data.scamalytics ? Number(data.scamalytics.scamalytics_score) : (data.score != null ? Number(data.score) : -1);
    const riskLevel = data.scamalytics ? data.scamalytics.scamalytics_risk : (data.risk || "");

    return {
      passed: score >= 0 && score < 40,
      fraudScore: score,
      riskLevel: riskLevel,
      source: "Scamalytics",
    };
  } catch (e) {
    return checkFraudFallback(ip, cfg);
  }
}

async function checkFraudFallback(ip, cfg) {
  const apiKey = (cfg || readStoredSettings()).ipqsApiKey;
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

async function checkProxyVPN(ip, cfg) {
  const key = (cfg || readStoredSettings()).ip2locationKey;

  // Fallback to IPQS
  if (!key) {
    return checkProxyVPNFallback(ip, cfg);
  }

  try {
    const res = await fetch(`https://api.ip2location.io/?key=${key}&ip=${ip}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return checkProxyVPNFallback(ip, cfg);

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
    return checkProxyVPNFallback(ip, cfg);
  }
}

async function checkProxyVPNFallback(ip, cfg) {
  const apiKey = (cfg || readStoredSettings()).ipqsApiKey;
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
export async function runQualityPipeline(ip, expectedGeo = {}, opts = {}, settingsMerge) {
  const cfg = effectiveQualitySettings(settingsMerge);
  const steps = [];

  // Step 1: Latency (direct metadata fetch — proxy path already proved reachability in resolve-ip)
  const latencyResult = await checkLatency(ip);
  steps.push({
    name: "latency",
    label: "Connectivity Test",
    ...latencyResult,
  });

  // Steps 2-4: Run in parallel
  const [asnResult, fraudResult, proxyResult] = await Promise.all([
    checkASN(ip, cfg),
    checkFraud(ip, cfg),
    checkProxyVPN(ip, cfg),
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

export async function quickASNCheck(ip, settingsMerge) {
  return checkASN(ip, effectiveQualitySettings(settingsMerge));
}

export async function quickFraudCheck(ip, settingsMerge) {
  return checkFraud(ip, effectiveQualitySettings(settingsMerge));
}

/* ────────────────── Export ────────────────── */

export const ipQualityPipeline = {
  runQualityPipeline,
  effectiveQualitySettings,
  quickASNCheck,
  quickFraudCheck,
  checkTimezoneGeo,
  HOSTING_ASNS,
  TH_RESIDENTIAL_ASNS,
  COUNTRY_TIMEZONES,
};
