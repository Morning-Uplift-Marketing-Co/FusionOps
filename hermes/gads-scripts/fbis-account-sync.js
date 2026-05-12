/**
 * FBIS Account Sync — Google Ads Script
 * ──────────────────────────────────────
 * ติดตั้ง: Google Ads UI → Tools → Scripts → + New Script
 * ตั้ง schedule: Daily (รันตอนเช้าก่อน HERMES nightly run เวลา 02:13)
 *
 * สิ่งที่ script นี้ทำ:
 *  1. ดึงข้อมูล account ปัจจุบัน (name, customer ID)
 *  2. หา site domain จาก Final URL ของ active ads
 *  3. ดึง spend 30d, 24h จาก campaign stats
 *  4. POST ไปที่ FBIS API /api/analysis/accounts/sync
 *
 * ถ้าต้องการรันใน MCC (หลาย accounts): ดู fbis-account-sync-mcc.js
 */

var FBIS_API = 'https://lp-factory-api.misty-feather-556e.workers.dev';
var SYNC_ENDPOINT = FBIS_API + '/api/analysis/accounts/sync';

// ── Main ──────────────────────────────────────────────────────────────────────

function main() {
  var account = AdsApp.currentAccount();
  var customerId = account.getCustomerId();   // "123-456-7890"
  var accountName = account.getName();

  Logger.log('=== FBIS Account Sync ===');
  Logger.log('Account: ' + accountName + ' (' + customerId + ')');

  // 1. Spend last 30d + 24h
  var spend30d = getSpend('LAST_30_DAYS');
  var spend24h  = getSpend('TODAY');

  // 2. Site domain from active ads final URLs
  var siteDomain = getSiteDomain();

  // 3. Campaign stats
  var campaignStats = getCampaignStats();

  // 4. Build payload
  var payload = {
    account_id:             customerId,
    label:                  accountName,
    email:                  '',           // Google Ads Script ไม่ expose email
    status:                 'active',
    site_domain:            siteDomain,
    spend_24h:              spend24h,
    spend_30d:              spend30d,
    daily_budget_total:     campaignStats.dailyBudget,
    campaign_count:         campaignStats.total,
    active_campaign_count:  campaignStats.active,
    synced_at:              new Date().toISOString(),
  };

  Logger.log('Payload: ' + JSON.stringify(payload));

  // 5. POST to FBIS
  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  var response = UrlFetchApp.fetch(SYNC_ENDPOINT, options);
  var code = response.getResponseCode();
  var body = response.getContentText();

  Logger.log('Response ' + code + ': ' + body);

  if (code === 200) {
    var result = JSON.parse(body);
    Logger.log('✅ Synced ' + result.upserted + ' account(s) to FBIS');
  } else {
    Logger.log('❌ Sync failed: ' + body);
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * ดึง total spend สำหรับ date range ที่กำหนด
 * @param {string} dateRange  "LAST_30_DAYS" | "TODAY" | "LAST_7_DAYS"
 * @returns {number} spend in account currency
 */
function getSpend(dateRange) {
  var report = AdsApp.report(
    'SELECT metrics.cost_micros ' +
    'FROM customer ' +
    'WHERE segments.date DURING ' + dateRange
  );
  var rows = report.rows();
  var total = 0;
  while (rows.hasNext()) {
    var row = rows.next();
    var micros = parseFloat(row['metrics.cost_micros'] || '0');
    total += micros / 1e6;
  }
  return Math.round(total * 100) / 100;
}

/**
 * หา domain จาก Final URL ของ active expanded text ads หรือ responsive search ads
 * เลือก domain ที่ใช้งานบ่อยที่สุด
 */
function getSiteDomain() {
  var domainCount = {};

  // Responsive Search Ads
  var adIterator = AdsApp.ads()
    .withCondition('ad_group_ad.status = ENABLED')
    .withCondition('campaign.status = ENABLED')
    .withCondition('ad_group.status = ENABLED')
    .get();

  while (adIterator.hasNext()) {
    var ad = adIterator.next();
    try {
      var urls = ad.urls();
      var finalUrl = urls.getFinalUrl();
      if (finalUrl) {
        var domain = extractDomain(finalUrl);
        if (domain) {
          domainCount[domain] = (domainCount[domain] || 0) + 1;
        }
      }
    } catch (e) {
      // Some ad types may not expose urls()
    }
  }

  // Return most-common domain
  var topDomain = '';
  var topCount = 0;
  for (var d in domainCount) {
    if (domainCount[d] > topCount) {
      topCount = domainCount[d];
      topDomain = d;
    }
  }

  Logger.log('Site domain: ' + topDomain + ' (' + topCount + ' ads)');
  return topDomain;
}

/**
 * ดึง campaign count + daily budget รวม
 */
function getCampaignStats() {
  var campaigns = AdsApp.campaigns()
    .withCondition('campaign.status != REMOVED')
    .get();

  var total = 0;
  var active = 0;
  var dailyBudget = 0;

  while (campaigns.hasNext()) {
    var c = campaigns.next();
    total++;
    if (c.isEnabled()) {
      active++;
      try {
        dailyBudget += c.getBudget().getAmount();
      } catch (e) { /* shared budget */ }
    }
  }

  return {
    total: total,
    active: active,
    dailyBudget: Math.round(dailyBudget * 100) / 100,
  };
}

/**
 * Extract hostname from URL, strip www.
 * "https://www.example.com/loan" → "example.com"
 */
function extractDomain(url) {
  try {
    var match = url.match(/^https?:\/\/([^/?#]+)/i);
    if (!match) return '';
    return match[1].replace(/^www\./, '');
  } catch (e) {
    return '';
  }
}
