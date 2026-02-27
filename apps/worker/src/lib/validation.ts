// ============================================================
// Request Validation — Token + Payload + Timestamp
// ============================================================

import type { AccountConfig, CallbackValidationResult, LeadsGateCallback } from '../types';

const MAX_CALLBACK_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Validate the X-Callback-Token header against the account's stored token.
 * Timing-safe comparison to prevent timing attacks.
 */
export function validateToken(
  headerToken: string | null,
  account: AccountConfig
): CallbackValidationResult {
  if (!headerToken) {
    return { valid: false, error: 'Missing X-Callback-Token header', statusCode: 401 };
  }

  if (!account.active) {
    return { valid: false, error: 'Account is inactive', statusCode: 403 };
  }

  // Constant-time comparison
  const expected = new TextEncoder().encode(account.callback_token);
  const received = new TextEncoder().encode(headerToken);

  if (expected.byteLength !== received.byteLength) {
    return { valid: false, error: 'Invalid callback token', statusCode: 401 };
  }

  let mismatch = 0;
  for (let i = 0; i < expected.byteLength; i++) {
    mismatch |= expected[i] ^ received[i];
  }

  if (mismatch !== 0) {
    return { valid: false, error: 'Invalid callback token', statusCode: 401 };
  }

  return { valid: true, statusCode: 200 };
}

/**
 * Validate the callback payload has required fields and timestamp is within 24h.
 */
export function validatePayload(
  payload: Partial<LeadsGateCallback>
): CallbackValidationResult {
  if (!payload.type || typeof payload.type !== 'string') {
    return { valid: false, error: 'Missing or invalid "type" field', statusCode: 400 };
  }

  if (!payload.click_id || typeof payload.click_id !== 'string') {
    return { valid: false, error: 'Missing or invalid "click_id" field', statusCode: 400 };
  }

  if (!payload.lead_id || typeof payload.lead_id !== 'string') {
    return { valid: false, error: 'Missing or invalid "lead_id" field', statusCode: 400 };
  }

  if (payload.type === 'soldLead') {
    if (typeof payload.price !== 'number' || payload.price < 0) {
      return { valid: false, error: 'Missing or invalid "price" for soldLead', statusCode: 400 };
    }
  }

  // Timestamp validation: must be within 24 hours
  if (payload.created) {
    const callbackTime = new Date(payload.created).getTime();
    if (isNaN(callbackTime)) {
      return { valid: false, error: 'Invalid "created" timestamp format', statusCode: 400 };
    }

    const now = Date.now();
    const age = now - callbackTime;

    if (age > MAX_CALLBACK_AGE_MS) {
      return { valid: false, error: 'Callback timestamp exceeds 24h threshold', statusCode: 400 };
    }

    if (age < -MAX_CALLBACK_AGE_MS) {
      return { valid: false, error: 'Callback timestamp is in the future beyond tolerance', statusCode: 400 };
    }
  }

  return { valid: true, statusCode: 200 };
}
