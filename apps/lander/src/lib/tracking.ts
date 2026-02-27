// ============================================================
// Tracking Library — Minimal Client-Side Tracking
// ============================================================
// Rules:
// - sessionStorage ONLY (no cookies, no localStorage)
// - No PII storage
// - navigator.sendBeacon for fire-and-forget events
// - Captures: click_id, zip, amount, utm_*, gclid
// ============================================================

const STORAGE_KEYS = ['zip', 'amount', 'click_id', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'gclid'] as const;

type StorageKey = typeof STORAGE_KEYS[number];

/**
 * Initialize tracking: parse URL params and persist to sessionStorage.
 * Called once on page load.
 */
export function initTracking(): void {
  const params = new URLSearchParams(window.location.search);

  // Capture click_id from Voluum (typically passed as 'click_id' or 'cid')
  const clickId = params.get('click_id') || params.get('cid') || '';
  if (clickId) {
    sessionStorage.setItem('click_id', clickId);
  }

  // Capture UTM parameters
  const utmKeys: StorageKey[] = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  for (const key of utmKeys) {
    const value = params.get(key);
    if (value) {
      sessionStorage.setItem(key, value);
    }
  }

  // Capture gclid
  const gclid = params.get('gclid');
  if (gclid) {
    sessionStorage.setItem('gclid', gclid);
  }
}

/**
 * Store a value in sessionStorage. Only allowed keys.
 */
export function setTrackingValue(key: StorageKey, value: string): void {
  sessionStorage.setItem(key, value);
}

/**
 * Get a value from sessionStorage.
 */
export function getTrackingValue(key: StorageKey): string {
  return sessionStorage.getItem(key) || '';
}

/**
 * Get all tracking data as a plain object.
 */
export function getTrackingData(): Record<string, string> {
  const data: Record<string, string> = {};
  for (const key of STORAGE_KEYS) {
    const value = sessionStorage.getItem(key);
    if (value) {
      data[key] = value;
    }
  }
  return data;
}

/**
 * Send a tracking beacon via navigator.sendBeacon.
 * Fire-and-forget — does not block the page.
 */
export function sendBeacon(event: string, extra?: Record<string, string>): void {
  const trackingEndpoint = (window as any).__TRACK_URL__ || '/track';

  const payload = {
    event,
    timestamp: new Date().toISOString(),
    click_id: getTrackingValue('click_id'),
    account_id: (window as any).__ACCOUNT_ID__ || '',
    page: window.location.pathname,
    ...extra,
  };

  try {
    const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
    navigator.sendBeacon(trackingEndpoint, blob);
  } catch {
    // Swallow errors — tracking must never break the page
  }
}
