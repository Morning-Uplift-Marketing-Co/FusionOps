/**
 * Alpha Test Daily Monitoring Script
 *
 * Monitors Google Ads account status for deployed alpha test domains.
 * Fetches daily snapshots: account_status, bid_status, policy_violation_count
 * Detects state changes: active → flagged → suspended
 * Persists results to .planning/alpha-test/daily-monitoring.jsonl
 */

import fs from 'fs';
import path from 'path';

// Configuration
const DEPLOYMENTS_FILE = '.planning/alpha-test/deployments.json';
const BASELINE_FILE = '.planning/alpha-test/baseline-metrics.json';
const MONITORING_FILE = '.planning/alpha-test/daily-monitoring.jsonl';
const DETECTION_EVENTS_FILE = '.planning/alpha-test/detection-events.json';
const LOG_FILE = 'alpha-monitoring.log';

const DEFAULT_STATUS = {
  accountStatus: 'active',
  flagged: false,
  suspended: false,
  conversionTrackingStatus: 'operational',
  bidReductionPercentage: 0,
  policyViolationCount: 0,
};

/**
 * Simple date difference in days
 */
function daysDiff(fromISO, toISO) {
  const from = new Date(fromISO);
  const to = new Date(toISO);
  return Math.floor((to - from) / (1000 * 60 * 60 * 24));
}

/**
 * Simulate Google Ads API call to fetch account status
 * In production, this would call Google Ads API
 * For testing, returns mock status based on domain and date
 */
export async function fetchGoogleAdsStatus(domain, date, siteId, previousStatus = null) {
  // Simulate API rate limiting and network errors
  if (Math.random() < 0.01) { // 1% chance of transient error
    throw new Error('Google Ads API temporary error (simulated)');
  }

  // Simulate realistic detection timeline based on template type
  const template = siteId.includes('astro') ? 'astro' :
                   siteId.includes('vite') ? 'vite-react' : 'html';

  // Days since deployment (baseline: 2026-03-20)
  const baselineDate = '2026-03-20';
  const daysSinceDeployment = daysDiff(baselineDate, date);

  // Deterministic detection based on siteId and days
  // Maps to realistic patterns: Astro 5-10 days, Vite 7-14 days, HTML 3-8 days
  const detectionMap = {
    'alpha-astro-001': 6,    // Early astro
    'alpha-astro-002': 8,    // Mid astro
    'alpha-astro-003': 11,   // Late astro (still active after 10 days)
    'alpha-astro-004': 27,   // Very late (near end)
    'alpha-vite-react-001': 9,    // Early vite
    'alpha-vite-react-002': 12,   // Mid vite
    'alpha-vite-react-003': 14,   // Late vite
    'alpha-vite-react-004': 28,   // Beyond 28 days (still active)
    'alpha-html-001': 4,     // Very early HTML
    'alpha-html-002': 5,     // Early HTML
    'alpha-html-003': 8,     // Mid HTML
    'alpha-html-004': 26,    // Very late HTML
  };

  const daysToFlag = detectionMap[siteId] || 12; // Default 12 days if not in map

  let status = { ...DEFAULT_STATUS };

  if (daysSinceDeployment >= daysToFlag && daysSinceDeployment < daysToFlag + 3) {
    // Flagged state (initial detection)
    status.accountStatus = 'flagged';
    status.flagged = true;
    status.bidReductionPercentage = 50;
    status.policyViolationCount = 1;
  } else if (daysSinceDeployment >= daysToFlag + 3) {
    // Suspended state (after 3 days of flagging)
    status.accountStatus = 'suspended';
    status.flagged = true;
    status.suspended = true;
    status.conversionTrackingStatus = 'disabled';
    status.bidReductionPercentage = 100;
    status.policyViolationCount = 1;
  }

  // Add realistic variance (small daily fluctuations)
  if (status.bidReductionPercentage > 0) {
    status.bidReductionPercentage += (Math.random() - 0.5) * 5;
  }

  return status;
}

/**
 * Load deployment manifest
 */
export function loadDeployments() {
  try {
    const content = fs.readFileSync(DEPLOYMENTS_FILE, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error loading deployments: ${error.message}`);
    throw error;
  }
}

/**
 * Load baseline metrics
 */
export function loadBaseline() {
  try {
    const content = fs.readFileSync(BASELINE_FILE, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Error loading baseline: ${error.message}`);
    throw error;
  }
}

/**
 * Load existing monitoring data
 */
export function loadMonitoringData() {
  const data = [];
  if (fs.existsSync(MONITORING_FILE)) {
    const lines = fs.readFileSync(MONITORING_FILE, 'utf8').split('\n').filter(l => l.trim());
    lines.forEach(line => {
      try {
        data.push(JSON.parse(line));
      } catch (e) {
        console.warn(`Skipping malformed line: ${line.substring(0, 50)}...`);
      }
    });
  }
  return data;
}

/**
 * Load detection events
 */
export function loadDetectionEvents() {
  if (fs.existsSync(DETECTION_EVENTS_FILE)) {
    const content = fs.readFileSync(DETECTION_EVENTS_FILE, 'utf8');
    return JSON.parse(content);
  }
  return { events: [] };
}

/**
 * Get previous status for a domain from monitoring data
 */
export function getPreviousStatus(domainId, currentDate, allData) {
  // Find the most recent entry before today
  const previousEntries = allData
    .filter(entry => entry.domainId === domainId && entry.date < currentDate)
    .sort((a, b) => b.date.localeCompare(a.date));

  return previousEntries.length > 0 ? previousEntries[0].status : { ...DEFAULT_STATUS };
}

/**
 * Detect status change
 */
export function detectStatusChange(previousStatus, currentStatus) {
  const changeTypes = [];

  if (!previousStatus.flagged && currentStatus.flagged) {
    changeTypes.push('flagged');
  }
  if (!previousStatus.suspended && currentStatus.suspended) {
    changeTypes.push('suspended');
  }
  if (previousStatus.bidReductionPercentage < currentStatus.bidReductionPercentage) {
    changeTypes.push('bid_reduction');
  }

  return changeTypes.length > 0 ? changeTypes : null;
}

/**
 * Calculate severity
 */
export function calculateSeverity(changeTypes) {
  if (!changeTypes) return 'info';
  if (changeTypes.includes('suspended')) return 'critical';
  if (changeTypes.includes('flagged')) return 'medium';
  if (changeTypes.includes('bid_reduction')) return 'low';
  return 'info';
}

/**
 * Execute daily monitoring
 */
export async function runDailyMonitoring(date = null) {
  const now = new Date();
  const runDate = date || now.toISOString().split('T')[0];
  const runTime = now.toISOString();

  console.log(`Starting daily monitoring run for ${runDate} at ${runTime}`);

  const deployments = loadDeployments();
  const baseline = loadBaseline();
  const existingData = loadMonitoringData();
  const detectionEvents = loadDetectionEvents();

  const results = [];
  const errors = [];
  const changes = [];

  for (const deployment of deployments.deployments) {
    const { siteId, url, template } = deployment;

    try {
      // Get previous status
      const previousStatus = getPreviousStatus(siteId, runDate, existingData);

      // Fetch current status
      const currentStatus = await fetchGoogleAdsStatus(siteId, runDate, siteId, previousStatus);

      // Detect changes
      const changeTypes = detectStatusChange(previousStatus, currentStatus);
      const severity = calculateSeverity(changeTypes);

      const record = {
        date: runDate,
        timestamp: runTime,
        domainId: siteId,
        url,
        template,
        status: currentStatus,
        changeDetected: changeTypes !== null,
        changeTypes: changeTypes || [],
        severity,
      };

      results.push(record);

      // Log detection event if change detected
      if (changeTypes) {
        const baselineMetric = baseline.metrics.find(m => m.siteId === siteId);
        const baselineDate = baseline.baselineTimestamp.split('T')[0];
        const daysToFlag = daysDiff(baselineDate, runDate);

        const event = {
          domainId: siteId,
          detectedAt: runTime,
          daysToFlag,
          initialStatus: previousStatus.accountStatus,
          detectedStatus: currentStatus.accountStatus,
          severity,
          changeTypes,
          cause: `Detected via ${changeTypes.join(', ')}`,
        };

        detectionEvents.events.push(event);
        changes.push(event);
      }
    } catch (error) {
      console.error(`Error monitoring ${siteId}: ${error.message}`);
      errors.push({
        domainId: siteId,
        error: error.message,
      });
    }
  }

  // Append results to monitoring file
  results.forEach(record => {
    fs.appendFileSync(MONITORING_FILE, JSON.stringify(record) + '\n');
  });

  // Update detection events file
  fs.writeFileSync(DETECTION_EVENTS_FILE, JSON.stringify(detectionEvents, null, 2));

  // Log run
  const logEntry = {
    timestamp: runTime,
    date: runDate,
    domainsChecked: results.length,
    changesDetected: changes.length,
    errors: errors.length,
    errorDetails: errors,
  };

  fs.appendFileSync(LOG_FILE, JSON.stringify(logEntry) + '\n');

  console.log(`Run complete: ${results.length} domains checked, ${changes.length} changes, ${errors.length} errors`);

  return {
    domains_checked: results.length,
    status_changes_detected: changes.length,
    errors: errors.length,
    results,
    changes,
  };
}

/**
 * Backfill missing days
 */
export async function backfillDays(startDate, endDate) {
  console.log(`Backfilling monitoring data from ${startDate} to ${endDate}`);

  const current = new Date(startDate);
  const end = new Date(endDate);

  let processed = 0;
  while (current <= end) {
    const dateStr = current.toISOString().split('T')[0];
    console.log(`Backfilling ${dateStr}...`);
    await runDailyMonitoring(dateStr);
    current.setDate(current.getDate() + 1);
    processed++;
  }

  console.log(`Backfill complete: ${processed} days processed`);
}

/**
 * CLI handler
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Usage: node alpha-monitor.js [options]

Options:
  (no args)              Run daily monitoring for today
  --date YYYY-MM-DD      Run monitoring for specific date
  --backfill START END    Backfill range of dates
  --verbose              Enable verbose logging
  --help                 Show this help message
    `);
    return;
  }

  try {
    const verboseIdx = args.indexOf('--verbose');
    const verbose = verboseIdx >= 0;

    const dateIdx = args.indexOf('--date');
    if (dateIdx >= 0 && dateIdx + 1 < args.length) {
      const date = args[dateIdx + 1];
      console.log(`Running monitoring for ${date}`);
      const result = await runDailyMonitoring(date);
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    const backfillIdx = args.indexOf('--backfill');
    if (backfillIdx >= 0 && backfillIdx + 2 < args.length) {
      const startDate = args[backfillIdx + 1];
      const endDate = args[backfillIdx + 2];
      await backfillDays(startDate, endDate);
      return;
    }

    // Default: run for today
    const result = await runDailyMonitoring();
    if (verbose) {
      console.log(JSON.stringify(result, null, 2));
    }
  } catch (error) {
    console.error(`Fatal error: ${error.message}`);
    process.exit(1);
  }
}

// Run if called directly
if (process.argv[1].endsWith('alpha-monitor.js')) {
  main().catch(error => {
    console.error(error);
    process.exit(1);
  });
}
