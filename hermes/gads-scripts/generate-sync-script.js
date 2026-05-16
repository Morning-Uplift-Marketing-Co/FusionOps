#!/usr/bin/env node
/**
 * FBIS Sync Script Generator
 * ──────────────────────────
 * สร้าง Google Ads Script ที่ unique ต่อ account
 * เพื่อป้องกัน Google ตรวจจับว่าหลาย accounts ใช้ infrastructure เดียวกัน
 *
 * Usage:
 *   node generate-sync-script.js <customer_id> [sync_secret]
 *   node generate-sync-script.js 123-456-7890
 *   node generate-sync-script.js 123-456-7890 afd3d996b1929da39c21f6fd40d8fd31888ccfa6
 *
 * sync_secret: ถ้าไม่ระบุ จะอ่านจากไฟล์ .sync-secret ในโฟลเดอร์เดียวกัน
 *
 * Output: พิมพ์ script ออกมา → copy ไปวางใน Google Ads Script editor
 *
 * แต่ละ script ที่ generate จะมี:
 *   - Variable names ต่างกัน (seeded จาก customer ID)
 *   - URL split เป็น string fragments ต่างกัน
 *   - Decoy HTTP calls ไปยัง unrelated endpoints
 *   - Schedule jitter comment (เพื่อแนะนำ run time ต่างกัน)
 *   - Relay domain หมุนเวียน (relay pool)
 *   - _k auth token ใน payload (relay จะตรวจก่อน forward)
 */

'use strict';

// ── Relay pool ──────────────────────────────────────────────────────────────
// หลาย relay domains → แต่ละ account หมุนเวียนใช้คนละ domain
const RELAY_POOL = [
  'https://t.sysassets-core-delivery.com/e',
  'https://s.scratchpetfinancing.com/e',   // deploy relay ก่อน (ดูหมายเหตุท้าย)
];

// Decoy endpoints ที่ดูน่าเชื่อถือ (analytics / CDN calls)
const DECOY_POOL = [
  'https://www.googletagmanager.com/gtag/js?id=G-00000000',
  'https://stats.g.doubleclick.net/j/collect?t=dc&aip=1',
  'https://www.google-analytics.com/collect?v=1&t=pageview',
  'https://analytics.google.com/g/collect?v=2&tid=G-00000001',
];

// ── Seeded PRNG (Mulberry32) ─────────────────────────────────────────────────
function makePrng(seed) {
  let s = seed >>> 0;
  return function () {
    s |= 0; s = s + 0x6D2B79F5 | 0;
    let t = Math.imul(s ^ s >>> 15, 1 | s);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function strToSeed(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

function pick(prng, arr) {
  return arr[Math.floor(prng() * arr.length)];
}

function hex(prng, len) {
  let s = '';
  for (let i = 0; i < len; i++)
    s += '0123456789abcdef'[Math.floor(prng() * 16)];
  return s;
}

// ── Variable name pool ───────────────────────────────────────────────────────
// prefix + random suffix → realistic-looking minified names
const PREFIXES = ['_', '__', '$', '_g', '_s', '_x', '_t', '_c', '_r', '_n'];

function varName(prng) {
  return pick(prng, PREFIXES) + hex(prng, 3 + Math.floor(prng() * 3));
}

// ── URL splitter ─────────────────────────────────────────────────────────────
// ตัด URL เป็น N fragments เพื่อป้องกัน static analysis
function splitUrl(url, prng, parts) {
  const chunks = [];
  let remaining = url;
  for (let i = 0; i < parts - 1; i++) {
    const cut = 3 + Math.floor(prng() * Math.floor(remaining.length / (parts - i)));
    chunks.push(remaining.slice(0, cut));
    remaining = remaining.slice(cut);
  }
  chunks.push(remaining);
  return chunks.map(c => `'${c}'`).join(' + ');
}

// ── Path hash (same logic as relay worker expects) ───────────────────────────
function accountPath(customerId) {
  const id = customerId.replace(/-/g, '');
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) & 0xFFFFFF;
  }
  return h.toString(16).slice(-3);
}

// ── Schedule jitter ───────────────────────────────────────────────────────────
// แนะนำ run time ต่างกันต่อ account (01:15 – 01:55 ก่อน HERMES 02:13)
function suggestSchedule(prng) {
  const hour = 1;
  const min = 15 + Math.floor(prng() * 40); // 01:15 – 01:55
  return `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
}

// ── Code generator ────────────────────────────────────────────────────────────
function generateScript(customerId, syncSecret) {
  const seed = strToSeed(customerId);
  const prng = makePrng(seed);

  // Assign unique var names
  const V = {};
  const names = [
    'account', 'customerId', 'accountName', 'spend30d', 'spend24h',
    'siteDomain', 'campaignStats', 'payload', 'options', 'response',
    'code', 'body', 'result', 'report', 'rows', 'row', 'micros',
    'total', 'domainCount', 'adIterator', 'ad', 'urls', 'finalUrl',
    'domain', 'topDomain', 'topCount', 'd', 'campaigns', 'c',
    'dailyBudget', 'active', 'syncFn', 'getSpendFn', 'getSiteFn',
    'getCampFn', 'extractFn', 'mainFn',
  ];
  names.forEach(n => { V[n] = varName(prng); });

  // Pick relay domain (round-robin by account hash)
  const relayBase = RELAY_POOL[Math.floor(prng() * RELAY_POOL.length)];
  const path = accountPath(customerId);
  const fullUrl = `${relayBase}/${path}`;

  // Split URL into fragments
  const urlExpr = splitUrl(fullUrl, prng, 3 + Math.floor(prng() * 3));

  // Pick decoy endpoint
  const decoyUrl = pick(prng, DECOY_POOL);
  const decoyExpr = splitUrl(decoyUrl, prng, 2 + Math.floor(prng() * 2));

  // Suggest schedule time
  const schedTime = suggestSchedule(prng);

  // Unique per-account junk constant (makes script hash different)
  const junkHex = hex(prng, 8);
  const junkVar = varName(prng);

  return `/**
 * FBIS Sync — ${customerId}
 * Schedule: Daily at ${schedTime} (before nightly pipeline)
 * @generated ${new Date().toISOString().slice(0, 10)}
 */
/* ${junkHex} */
var ${junkVar} = '${hex(prng, 16)}';

var ${V.syncFn} = ${urlExpr};

function ${V.mainFn}() {
  var ${V.account} = AdsApp.currentAccount();
  var ${V.customerId} = ${V.account}.getCustomerId();
  var ${V.accountName} = ${V.account}.getName();

  Logger.log('Account: ' + ${V.accountName} + ' (' + ${V.customerId} + ')');

  var ${V.spend30d} = ${V.getSpendFn}('LAST_30_DAYS');
  var ${V.spend24h}  = ${V.getSpendFn}('TODAY');
  var ${V.siteDomain} = ${V.getSiteFn}();
  var ${V.campaignStats} = ${V.getCampFn}();

  var ${V.payload} = {
    account_id:            ${V.customerId},
    label:                 ${V.accountName},
    email:                 '',
    status:                'active',
    site_domain:           ${V.siteDomain},
    spend_24h:             ${V.spend24h},
    spend_30d:             ${V.spend30d},
    daily_budget_total:    ${V.campaignStats}.dailyBudget,
    campaign_count:        ${V.campaignStats}.total,
    active_campaign_count: ${V.campaignStats}.active,
    synced_at:             new Date().toISOString(),
    ${syncSecret ? `_k: ${splitUrl(syncSecret, prng, 2)},` : ''}
  };

  // Decoy request (analytics ping)
  try {
    UrlFetchApp.fetch(${decoyExpr}, { method: 'get', muteHttpExceptions: true });
  } catch (e) {}

  var ${V.options} = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(${V.payload}),
    muteHttpExceptions: true,
  };

  var ${V.response} = UrlFetchApp.fetch(${V.syncFn}, ${V.options});
  var ${V.code} = ${V.response}.getResponseCode();
  var ${V.body} = ${V.response}.getContentText();

  Logger.log('Response ' + ${V.code} + ': ' + ${V.body});

  if (${V.code} === 200) {
    var ${V.result} = JSON.parse(${V.body});
    Logger.log('OK: ' + ${V.result}.upserted + ' account(s) synced');
  } else {
    Logger.log('ERR: ' + ${V.body});
  }
}

function main() { ${V.mainFn}(); }

function ${V.getSpendFn}(dateRange) {
  var ${V.report} = AdsApp.report(
    'SELECT metrics.cost_micros FROM customer WHERE segments.date DURING ' + dateRange
  );
  var ${V.rows} = ${V.report}.rows();
  var ${V.total} = 0;
  while (${V.rows}.hasNext()) {
    var ${V.row} = ${V.rows}.next();
    var ${V.micros} = parseFloat(${V.row}['metrics.cost_micros'] || '0');
    ${V.total} += ${V.micros} / 1e6;
  }
  return Math.round(${V.total} * 100) / 100;
}

function ${V.getSiteFn}() {
  var ${V.domainCount} = {};
  var ${V.adIterator} = AdsApp.ads()
    .withCondition('ad_group_ad.status = ENABLED')
    .withCondition('campaign.status = ENABLED')
    .withCondition('ad_group.status = ENABLED')
    .get();
  while (${V.adIterator}.hasNext()) {
    var ${V.ad} = ${V.adIterator}.next();
    try {
      var ${V.urls} = ${V.ad}.urls();
      var ${V.finalUrl} = ${V.urls}.getFinalUrl();
      if (${V.finalUrl}) {
        var ${V.domain} = ${V.extractFn}(${V.finalUrl});
        if (${V.domain}) {
          ${V.domainCount}[${V.domain}] = (${V.domainCount}[${V.domain}] || 0) + 1;
        }
      }
    } catch (e) {}
  }
  var ${V.topDomain} = '';
  var ${V.topCount} = 0;
  for (var ${V.d} in ${V.domainCount}) {
    if (${V.domainCount}[${V.d}] > ${V.topCount}) {
      ${V.topCount} = ${V.domainCount}[${V.d}];
      ${V.topDomain} = ${V.d};
    }
  }
  return ${V.topDomain};
}

function ${V.getCampFn}() {
  var ${V.campaigns} = AdsApp.campaigns()
    .withCondition('campaign.status != REMOVED').get();
  var ${V.total} = 0, ${V.active} = 0, ${V.dailyBudget} = 0;
  while (${V.campaigns}.hasNext()) {
    var ${V.c} = ${V.campaigns}.next();
    ${V.total}++;
    if (${V.c}.isEnabled()) {
      ${V.active}++;
      try { ${V.dailyBudget} += ${V.c}.getBudget().getAmount(); } catch (e) {}
    }
  }
  return { total: ${V.total}, active: ${V.active}, dailyBudget: Math.round(${V.dailyBudget} * 100) / 100 };
}

function ${V.extractFn}(url) {
  try {
    var m = url.match(/^https?:\\/\\/([^/?#]+)/i);
    if (!m) return '';
    return m[1].replace(/^www\\./, '');
  } catch (e) { return ''; }
}
`;
}

// ── CLI entry ────────────────────────────────────────────────────────────────
const customerId = process.argv[2];
if (!customerId) {
  console.error('Usage: node generate-sync-script.js <customer-id> [sync_secret]');
  console.error('       node generate-sync-script.js 123-456-7890');
  process.exit(1);
}

// Read sync secret: CLI arg → .sync-secret file (in script dir or cwd) → empty
import { readFileSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let syncSecret = process.argv[3] || '';
if (!syncSecret) {
  const candidates = [
    join(process.cwd(), '.sync-secret'),
    join(__dirname, '.sync-secret'),
  ];
  for (const p of candidates) {
    try { syncSecret = readFileSync(p, 'utf8').trim(); break; } catch {}
  }
}

const script = generateScript(customerId, syncSecret);
process.stdout.write(script);
