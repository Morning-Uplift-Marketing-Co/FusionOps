// ============================================================
// Bot Detection — 4-signal Google Ads/Search Bot Classifier
// ============================================================
// Signals (weighted composite, 0-1):
//   1. IP CIDR match     (35%) — Compare vs bot_ip_ranges cache
//   2. Reverse DNS       (35%) — Forward-confirmed PTR record
//   3. User-Agent regex  (20%) — Match Googlebot|AdsBot patterns
//   4. CF bot management (10%) — Cloudflare verified-bot score
//
// Composite score >= 0.7 → confirmed bot
// Records to D1 bot_visits table
// ============================================================

export interface CfBotManagement {
  score?: number;        // 0-99 = bot, 100 = human (per CF)
  verifiedBot?: boolean;
  staticResource?: boolean;
  ja3Hash?: string;
}

export interface BotDetectionResult {
  is_bot: boolean;
  composite_score: number;
  bot_type: string;
  confidence: string;
  signals: {
    sig_ip_match: number;
    sig_ptr_match: number;
    sig_ua_match: number;
    sig_behavior: number;
  };
  ip: string;
  user_agent: string;
  ptr_record: string;
  ptr_verified: boolean;
  asn: number;
  org: string;
  country: string;
  cf_threat_score: number;
  cf_bot_score: number;
}

// ============================================================
// User-Agent patterns
// ============================================================

const GOOGLE_UA_PATTERNS: Array<{ pattern: RegExp; type: string }> = [
  { pattern: /AdsBot-Google-Mobile/i, type: 'adsbot' },
  { pattern: /AdsBot-Google/i, type: 'adsbot' },
  { pattern: /Googlebot-Image/i, type: 'googlebot' },
  { pattern: /Googlebot-News/i, type: 'googlebot' },
  { pattern: /Googlebot-Video/i, type: 'googlebot' },
  { pattern: /Googlebot/i, type: 'googlebot' },
  { pattern: /Mediapartners-Google/i, type: 'mediapartners' },
  { pattern: /Google-InspectionTool/i, type: 'inspection' },
  { pattern: /Google-Read-Aloud/i, type: 'other' },
  { pattern: /Google-Site-Verification/i, type: 'verification' },
  { pattern: /APIs-Google/i, type: 'other' },
  { pattern: /FeedFetcher-Google/i, type: 'other' },
  { pattern: /GoogleProducer/i, type: 'other' },
];

// ============================================================
// Reverse DNS suffixes (forward-confirmed)
// ============================================================

const GOOGLE_PTR_SUFFIXES = [
  '.googlebot.com',
  '.google.com',
  '.googleusercontent.com',
];

// ============================================================
// IP utilities — IPv4 to integer for CIDR matching
// ============================================================

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    result = (result << 8) | n;
  }
  return result >>> 0; // Unsigned 32-bit
}

function detectIpVersion(ip: string): number {
  if (ip.includes(':')) return 6;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(ip)) return 4;
  return 0;
}

// ============================================================
// Signal 1: IP CIDR Match (via D1 lookup)
// ============================================================

interface BotRangeRow {
  cidr: string;
  bot_type: string;
}

async function signalIpMatch(
  ip: string,
  db: D1Database
): Promise<{ score: number; bot_type: string }> {
  const version = detectIpVersion(ip);

  if (version === 4) {
    const ipInt = ipv4ToInt(ip);
    if (ipInt === null) return { score: 0, bot_type: 'unknown' };

    try {
      const row = await db
        .prepare(
          `SELECT cidr, bot_type FROM bot_ip_ranges
           WHERE ip_version = 4 AND ip_start <= ? AND ip_end >= ?
           LIMIT 1`
        )
        .bind(ipInt, ipInt)
        .first<BotRangeRow>();

      if (row) {
        return { score: 1.0, bot_type: row.bot_type };
      }
    } catch {
      // Table may not exist yet — return 0
    }
  }
  // IPv6: skip CIDR check for simplicity (relies on PTR + UA instead)

  return { score: 0, bot_type: 'unknown' };
}

// ============================================================
// Signal 2: Reverse DNS Verification (forward-confirmed)
// ============================================================

async function signalReverseDns(ip: string): Promise<{
  score: number;
  ptr_record: string;
  verified: boolean;
}> {
  try {
    // Cloudflare DOH (DNS-over-HTTPS) for PTR lookup
    const reverseName = ipToReverseDnsName(ip);
    if (!reverseName) return { score: 0, ptr_record: '', verified: false };

    const ptrResp = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${reverseName}&type=PTR`,
      {
        headers: { Accept: 'application/dns-json' },
        cf: { cacheTtl: 86400, cacheEverything: true },
      } as RequestInit & { cf?: { cacheTtl?: number; cacheEverything?: boolean } }
    );

    if (!ptrResp.ok) return { score: 0, ptr_record: '', verified: false };

    const ptrData: { Answer?: Array<{ data: string }> } = await ptrResp.json();
    const ptrRecords = ptrData.Answer?.map((a) => a.data.replace(/\.$/, '')) || [];

    if (ptrRecords.length === 0) return { score: 0, ptr_record: '', verified: false };

    // Check if PTR matches Google suffixes
    const matchedPtr = ptrRecords.find((ptr) =>
      GOOGLE_PTR_SUFFIXES.some((suffix) => ptr.toLowerCase().endsWith(suffix))
    );

    if (!matchedPtr) return { score: 0, ptr_record: ptrRecords[0], verified: false };

    // Forward-confirm: resolve the PTR back to A/AAAA records
    const forwardResp = await fetch(
      `https://cloudflare-dns.com/dns-query?name=${matchedPtr}&type=A`,
      {
        headers: { Accept: 'application/dns-json' },
        cf: { cacheTtl: 86400 },
      } as RequestInit & { cf?: { cacheTtl?: number } }
    );

    if (forwardResp.ok) {
      const forwardData: { Answer?: Array<{ data: string }> } = await forwardResp.json();
      const forwardIps = forwardData.Answer?.map((a) => a.data) || [];
      const verified = forwardIps.includes(ip);
      return {
        score: verified ? 1.0 : 0.5,
        ptr_record: matchedPtr,
        verified,
      };
    }

    // Got matching PTR but couldn't forward-confirm
    return { score: 0.5, ptr_record: matchedPtr, verified: false };
  } catch {
    return { score: 0, ptr_record: '', verified: false };
  }
}

function ipToReverseDnsName(ip: string): string | null {
  if (detectIpVersion(ip) === 4) {
    return ip.split('.').reverse().join('.') + '.in-addr.arpa';
  }
  // Skip IPv6 reverse DNS — complex nibble format
  return null;
}

// ============================================================
// Signal 3: User-Agent Pattern Match
// ============================================================

function signalUaMatch(userAgent: string): { score: number; bot_type: string } {
  if (!userAgent) return { score: 0, bot_type: 'unknown' };

  for (const { pattern, type } of GOOGLE_UA_PATTERNS) {
    if (pattern.test(userAgent)) {
      return { score: 1.0, bot_type: type };
    }
  }

  // Other common search bots
  if (/Bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot/i.test(userAgent)) {
    return { score: 1.0, bot_type: 'other-search' };
  }

  // Generic bot indicators
  if (/bot|crawler|spider|crawling/i.test(userAgent)) {
    return { score: 0.5, bot_type: 'generic-bot' };
  }

  return { score: 0, bot_type: 'unknown' };
}

// ============================================================
// Signal 4: Cloudflare Bot Management
// ============================================================

function signalBehavior(cfBot: CfBotManagement | undefined): number {
  if (!cfBot) return 0;

  // CF score: 1-99 = bot, 100 = human
  if (cfBot.verifiedBot) return 1.0;
  if (typeof cfBot.score === 'number') {
    if (cfBot.score >= 90) return 0;          // Likely human
    if (cfBot.score >= 30) return 0.3;        // Possibly automated
    return 0.7;                                // Very likely bot
  }
  return 0;
}

// ============================================================
// Main Detection Function
// ============================================================

export async function detectBot(
  request: Request & { cf?: any },
  url: URL,
  env: { DB: D1Database }
): Promise<BotDetectionResult> {
  const ip = request.headers.get('CF-Connecting-IP') || '';
  const userAgent = request.headers.get('User-Agent') || '';
  const cf = request.cf || {};

  // Parallelize signals 1 & 2 (network-bound)
  const [ipResult, ptrResult] = await Promise.all([
    signalIpMatch(ip, env.DB),
    signalReverseDns(ip),
  ]);

  const uaResult = signalUaMatch(userAgent);
  const behaviorScore = signalBehavior(cf.botManagement);

  // Weighted composite
  const composite =
    ipResult.score * 0.35 +
    ptrResult.score * 0.35 +
    uaResult.score * 0.2 +
    behaviorScore * 0.1;

  // Determine bot_type — prefer specific over generic
  let botType = 'unknown';
  if (uaResult.bot_type !== 'unknown' && uaResult.bot_type !== 'generic-bot') {
    botType = uaResult.bot_type;
  } else if (ipResult.bot_type !== 'unknown') {
    botType = ipResult.bot_type;
  } else if (uaResult.bot_type !== 'unknown') {
    botType = uaResult.bot_type;
  }

  // Confidence label
  let confidence = 'low';
  if (composite >= 0.85) confidence = 'high';
  else if (composite >= 0.6) confidence = 'medium';

  return {
    is_bot: composite >= 0.7,
    composite_score: Number(composite.toFixed(3)),
    bot_type: botType,
    confidence,
    signals: {
      sig_ip_match: ipResult.score,
      sig_ptr_match: ptrResult.score,
      sig_ua_match: uaResult.score,
      sig_behavior: behaviorScore,
    },
    ip,
    user_agent: userAgent,
    ptr_record: ptrResult.ptr_record,
    ptr_verified: ptrResult.verified,
    asn: cf.asn || 0,
    org: cf.asOrganization || '',
    country: cf.country || '',
    cf_threat_score: cf.threatScore || 0,
    cf_bot_score: cf.botManagement?.score ?? 100,
  };
}

// ============================================================
// Persist bot visit to D1
// ============================================================

export async function recordBotVisit(
  db: D1Database,
  result: BotDetectionResult,
  context: {
    url: string;
    path: string;
    site_domain: string;
    campaign_id?: string;
    visit_id?: string;
  }
): Promise<void> {
  // Ensure table exists (idempotent — auto-creates on first traffic)
  await db
    .prepare(
      `CREATE TABLE IF NOT EXISTS bot_visits (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        visit_id TEXT, timestamp INTEGER NOT NULL,
        campaign_id TEXT DEFAULT '', site_domain TEXT DEFAULT '',
        url TEXT DEFAULT '', path TEXT DEFAULT '',
        ip TEXT NOT NULL, ip_version INTEGER DEFAULT 4,
        user_agent TEXT DEFAULT '', asn INTEGER DEFAULT 0,
        org TEXT DEFAULT '', country TEXT DEFAULT '',
        ptr_record TEXT DEFAULT '', ptr_verified INTEGER DEFAULT 0,
        sig_ip_match REAL DEFAULT 0, sig_ptr_match REAL DEFAULT 0,
        sig_ua_match REAL DEFAULT 0, sig_behavior REAL DEFAULT 0,
        composite_score REAL DEFAULT 0,
        bot_type TEXT DEFAULT 'unknown', confidence TEXT DEFAULT 'low',
        cf_threat_score INTEGER DEFAULT 0, cf_bot_score INTEGER DEFAULT 100,
        created_at TEXT DEFAULT (datetime('now'))
      )`
    )
    .run();

  await db
    .prepare(
      `INSERT INTO bot_visits (
        visit_id, timestamp, campaign_id, site_domain, url, path,
        ip, ip_version, user_agent, asn, org, country,
        ptr_record, ptr_verified,
        sig_ip_match, sig_ptr_match, sig_ua_match, sig_behavior, composite_score,
        bot_type, confidence, cf_threat_score, cf_bot_score
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      context.visit_id || '',
      Math.floor(Date.now() / 1000),
      context.campaign_id || '',
      context.site_domain,
      context.url,
      context.path,
      result.ip,
      detectIpVersion(result.ip),
      result.user_agent,
      result.asn,
      result.org,
      result.country,
      result.ptr_record,
      result.ptr_verified ? 1 : 0,
      result.signals.sig_ip_match,
      result.signals.sig_ptr_match,
      result.signals.sig_ua_match,
      result.signals.sig_behavior,
      result.composite_score,
      result.bot_type,
      result.confidence,
      result.cf_threat_score,
      result.cf_bot_score
    )
    .run();
}
