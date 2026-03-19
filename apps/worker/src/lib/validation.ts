// ============================================================
// Request Validation — Token + Payload + Timestamp
// ============================================================

import type { AccountConfig, CallbackValidationResult, LeadsGateCallback } from '../types';

const MAX_CALLBACK_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
const UNAUTHORIZED_MESSAGE = 'Unauthorized';
const PBKDF2_PREFIX = 'pbkdf2_sha256';
const PBKDF2_DERIVED_BITS = 256;

/**
 * Validate the X-Callback-Token header against the account's stored token.
 * Timing-safe comparison to prevent timing attacks.
 */
export async function validateToken(
  headerToken: string | null,
  account: AccountConfig
): Promise<CallbackValidationResult> {
  if (!headerToken) {
    return { valid: false, error: UNAUTHORIZED_MESSAGE, statusCode: 401 };
  }

  if (!account.active) {
    return { valid: false, error: UNAUTHORIZED_MESSAGE, statusCode: 401 };
  }

  // Preferred path: migrated hash verification
  if (account.callback_token_hash) {
    const valid = await verifyHashedCallbackToken(headerToken, account.callback_token_hash);
    if (!valid) {
      return { valid: false, error: UNAUTHORIZED_MESSAGE, statusCode: 401 };
    }
    return { valid: true, statusCode: 200 };
  }

  // Compatibility path: legacy plaintext verification
  const expected = new TextEncoder().encode(account.callback_token || '');
  const received = new TextEncoder().encode(headerToken);
  if (!timingSafeEqual(expected, received)) {
    return { valid: false, error: UNAUTHORIZED_MESSAGE, statusCode: 401 };
  }
  return { valid: true, statusCode: 200 };
}

function timingSafeEqual(expected: Uint8Array, received: Uint8Array): boolean {
  if (expected.byteLength !== received.byteLength) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.byteLength; i++) {
    mismatch |= expected[i] ^ received[i];
  }
  return mismatch === 0;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array | null {
  if (!hex || hex.length % 2 !== 0 || /[^a-fA-F0-9]/.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return out;
}

async function derivePbkdf2Sha256(token: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(token),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    baseKey,
    PBKDF2_DERIVED_BITS
  );
  return new Uint8Array(derived);
}

export async function hashCallbackToken(
  token: string,
  opts: { iterations?: number; saltHex?: string } = {}
): Promise<string> {
  const iterations = opts.iterations ?? 100_000;
  const salt = opts.saltHex
    ? hexToBytes(opts.saltHex)
    : crypto.getRandomValues(new Uint8Array(16));
  if (!salt) throw new Error('Invalid salt hex');
  const derived = await derivePbkdf2Sha256(token, salt, iterations);
  return `${PBKDF2_PREFIX}$${iterations}$${bytesToHex(salt)}$${bytesToHex(derived)}`;
}

async function verifyHashedCallbackToken(token: string, storedHash: string): Promise<boolean> {
  try {
    const [prefix, iterRaw, saltHex, hashHex] = storedHash.split('$');
    if (prefix !== PBKDF2_PREFIX || !iterRaw || !saltHex || !hashHex) return false;
    const iterations = Number(iterRaw);
    if (!Number.isFinite(iterations) || iterations <= 0) return false;
    const salt = hexToBytes(saltHex);
    const expected = hexToBytes(hashHex);
    if (!salt || !expected) return false;
    const derived = await derivePbkdf2Sha256(token, salt, iterations);
    return timingSafeEqual(expected, derived);
  } catch {
    return false;
  }
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
