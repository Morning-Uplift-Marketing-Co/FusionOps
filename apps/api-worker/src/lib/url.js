// ============================================================
// URL parsing utilities for FusionOps API Worker
// ============================================================
// Extracted from worker.js (Phase 1: utility extraction).
// ============================================================

/**
 * Extract a normalized hostname from a URL or raw host string.
 * Returns lowercase hostname without port/path.
 * Falls back to manual parsing if URL constructor throws.
 */
export function extractHost(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch (_e) {
    return raw.replace(/^https?:\/\//i, '').split('/')[0].split(':')[0].toLowerCase();
  }
}
