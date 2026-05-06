// ============================================================
// Case conversion + secret-key utilities for FusionOps API Worker
// ============================================================
// Extracted from worker.js (Phase 2: utility extraction).
// ============================================================

// Secret keys that should never be returned in API responses
export const SECRET_KEYS = new Set([
  'apiKey',
  'geminiKey',
  'netlifyToken',
  'lcToken',
  'mlToken',
  'mlPassword',
  'githubToken',
  'adspowerApiKey',
]);

export function redactSettings(obj) {
  const safe = {};
  for (const [k, v] of Object.entries(obj)) {
    safe[k] = SECRET_KEYS.has(k) ? (v ? '••••' : '') : v;
  }
  return safe;
}

/** Convert snake_case DB columns to camelCase for frontend. */
export function snakeToCamel(obj) {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const camel = key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
    result[camel] = value;
  }
  return result;
}

export function camelToSnake(str) {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

/** Returns true if value is a placeholder mask (e.g. "••••" returned by redactSettings). */
export function isMaskedSecret(value) {
  return /^[•*]+$/.test(String(value || '').trim());
}
