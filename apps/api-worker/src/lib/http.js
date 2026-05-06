// ============================================================
// HTTP utilities for FusionOps API Worker
// ============================================================
// Provides shared CORS headers, JSON response wrapper, and ID
// generation. Extracted from worker.js (Phase 1: utility extraction).
// ============================================================

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-api-key, cwauth-token, x-csrf-token, x-cf-api-token, anthropic-version, anthropic-dangerous-direct-browser-access',
  'Access-Control-Max-Age': '86400',
};

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

export function uid() {
  return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
}

/** UTF-8 safe base64 encoder (btoa() can't handle non-Latin1 chars). */
export function toBase64(text) {
  const bytes = new TextEncoder().encode(String(text ?? ''));
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
