// ============================================================
// LeadsGate Callback Handler
// ============================================================
// Route: POST /callback/:account_id/leadsgate
//
// Flow:
// 1. Resolve account from D1 by account_id
// 2. Validate X-Callback-Token
// 3. Parse and validate payload
// 4. Log raw callback to lead_callbacks (always)
// 5. If type != soldLead → return 200
// 6. Generate dedup_key = sha256(click_id + ":" + lead_id)
// 7. Check dedup_keys for duplicate
// 8. Upload conversion to Voluum
// 9. On success: insert dedup_key + log success
// 10. On failure: log failure, return 500
// ============================================================

import type { AccountConfig, Env, LeadsGateCallback } from '../types';
import { validatePayload, validateToken } from '../lib/validation';
import {
  claimConversion,
  completeConversionClaim,
  failConversionClaim,
  generateDedupKey,
} from '../lib/dedup';
import { uploadConversion } from '../lib/voluum';

const MAX_CALLBACK_BODY_BYTES = 64 * 1024;
const MAX_RAW_PAYLOAD_CHARS = 10_000;
const JSON_HEADERS = { 'Content-Type': 'application/json' } as const;
const CALLBACK_ERROR = 'callback_processing_error';
const CALLBACK_REJECTION = 'callback_rejected';

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function unauthorizedResponse(): Response {
  return jsonResponse({ error: 'Unauthorized' }, 401);
}

function payloadTooLargeResponse(): Response {
  return jsonResponse({ error: 'Payload too large' }, 413);
}

function parseContentLength(request: Request): number | null {
  const header = request.headers.get('Content-Length');
  if (!header) return null;
  const parsed = Number(header);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function toBoundedRawPayload(rawBody: string): string {
  if (rawBody.length <= MAX_RAW_PAYLOAD_CHARS) return rawBody;
  return `${rawBody.slice(0, MAX_RAW_PAYLOAD_CHARS)}...[truncated]`;
}

function toErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

function logCallbackError(
  stage: string,
  context: Record<string, unknown>,
  error: unknown
): void {
  console.error(CALLBACK_ERROR, {
    stage,
    ...context,
    message: toErrorMessage(error),
    timestamp: new Date().toISOString(),
  });
}

function logCallbackRejection(stage: string, context: Record<string, unknown>): void {
  console.warn(CALLBACK_REJECTION, {
    stage,
    ...context,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Resolve account configuration from D1.
 */
async function resolveAccount(
  db: D1Database,
  accountId: string
): Promise<AccountConfig | null> {
  return db
    .prepare('SELECT * FROM accounts WHERE account_id = ?')
    .bind(accountId)
    .first<AccountConfig>();
}

/**
 * Log raw callback payload to D1. This ALWAYS runs, regardless of type.
 */
async function logRawCallback(
  db: D1Database,
  accountId: string,
  payload: LeadsGateCallback,
  rawBody: string
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO lead_callbacks (account_id, type, lead_id, click_id, price, created, raw_payload)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      accountId,
      payload.type,
      payload.lead_id || null,
      payload.click_id || null,
      payload.price ?? null,
      payload.created || null,
      rawBody
    )
    .run();
}

/**
 * Log conversion upload result to D1.
 */
async function logConversionUpload(
  db: D1Database,
  accountId: string,
  clickId: string,
  leadId: string,
  payout: number,
  status: 'success' | 'failed',
  errorMessage?: string
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO conversion_uploads (account_id, click_id, lead_id, payout, status, error_message)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .bind(accountId, clickId, leadId, payout, status, errorMessage || null)
    .run();
}

/**
 * Main callback handler.
 */
export async function handleLeadsGateCallback(
  request: Request,
  env: Env,
  accountId: string
): Promise<Response> {
  const db = env.DB;

  // --- Step 1: Resolve account ---
  const account = await resolveAccount(db, accountId);
  if (!account) {
    logCallbackRejection('account_lookup', { account_id: accountId, reason: 'account_not_found' });
    return unauthorizedResponse();
  }

  // --- Step 2: Validate token ---
  const token = request.headers.get('X-Callback-Token');
  const tokenResult = await validateToken(token, account);
  if (!tokenResult.valid) {
    logCallbackRejection('auth', { account_id: accountId, reason: 'invalid_token' });
    return unauthorizedResponse();
  }

  const declaredLength = parseContentLength(request);
  if (declaredLength !== null && declaredLength > MAX_CALLBACK_BODY_BYTES) {
    return payloadTooLargeResponse();
  }

  // --- Step 3: Parse body ---
  let rawBody: string;
  let payload: LeadsGateCallback;

  try {
    rawBody = await request.text();
    if (byteLength(rawBody) > MAX_CALLBACK_BODY_BYTES) {
      return payloadTooLargeResponse();
    }
    payload = JSON.parse(rawBody) as LeadsGateCallback;
  } catch (error) {
    logCallbackError('payload_parse', { account_id: accountId }, error);
    return jsonResponse({ error: 'Invalid JSON body' }, 400);
  }

  // --- Step 4: Validate payload ---
  const payloadResult = validatePayload(payload);
  if (!payloadResult.valid) {
    logCallbackRejection('payload_validate', {
      account_id: accountId,
      error: payloadResult.error,
      status_code: payloadResult.statusCode,
    });
    return jsonResponse({ error: payloadResult.error }, payloadResult.statusCode);
  }

  // --- Step 5: Always log raw callback ---
  try {
    await logRawCallback(db, accountId, payload, toBoundedRawPayload(rawBody));
  } catch (err) {
    logCallbackError(
      'raw_log_insert',
      { account_id: accountId, type: payload.type, click_id: payload.click_id, lead_id: payload.lead_id },
      err
    );
  }

  // --- Step 6: Non-soldLead → return 200 ---
  if (payload.type !== 'soldLead') {
    return jsonResponse({ status: 'ok', type: payload.type }, 200);
  }

  // --- Step 7: Generate dedup key ---
  const dedupKey = await generateDedupKey(payload.click_id, payload.lead_id);

  // --- Step 8: Atomically claim conversion ---
  const claim = await claimConversion(db, dedupKey, accountId);
  if (!claim.claimed) {
    logCallbackRejection('dedup_duplicate', {
      account_id: accountId,
      click_id: payload.click_id,
      lead_id: payload.lead_id,
      dedup_key: dedupKey,
      claim_status: claim.status,
    });
    return jsonResponse({ status: 'ok', deduplicated: true, claim_status: claim.status }, 200);
  }

  // --- Step 9: Upload to Voluum ---
  const conversionResult = await uploadConversion({
    cid: payload.click_id,
    payout: payload.price,
    txid: payload.lead_id,
  });

  // --- Step 10: Handle result ---
  if (conversionResult.success) {
    // Finalize claim after successful upload
    try {
      await completeConversionClaim(db, dedupKey, accountId);
    } catch (err) {
      logCallbackError(
        'claim_finalize_completed',
        { account_id: accountId, click_id: payload.click_id, lead_id: payload.lead_id, dedup_key: dedupKey },
        err
      );
    }

    // Log success
    try {
      await logConversionUpload(
        db,
        accountId,
        payload.click_id,
        payload.lead_id,
        payload.price,
        'success'
      );
    } catch (err) {
      logCallbackError(
        'conversion_log_insert_success',
        { account_id: accountId, click_id: payload.click_id, lead_id: payload.lead_id, dedup_key: dedupKey },
        err
      );
    }

    return new Response(
      JSON.stringify({ status: 'ok', conversion: 'uploaded' }),
      { status: 200, headers: JSON_HEADERS }
    );
  }

  // Upload failed
  logCallbackError(
    'conversion_upload',
    {
      account_id: accountId,
      click_id: payload.click_id,
      lead_id: payload.lead_id,
      dedup_key: dedupKey,
      claim_status: 'failed',
    },
    conversionResult.error || 'Unknown conversion upload failure'
  );

  try {
    await failConversionClaim(
      db,
      dedupKey,
      accountId,
      conversionResult.error || 'Unknown conversion upload failure'
    );
  } catch (err) {
    logCallbackError(
      'claim_finalize_failed',
      { account_id: accountId, click_id: payload.click_id, lead_id: payload.lead_id, dedup_key: dedupKey },
      err
    );
  }

  try {
    await logConversionUpload(
      db,
      accountId,
      payload.click_id,
      payload.lead_id,
      payload.price,
      'failed',
      conversionResult.error
    );
  } catch (err) {
    logCallbackError(
      'conversion_log_insert_failed',
      { account_id: accountId, click_id: payload.click_id, lead_id: payload.lead_id, dedup_key: dedupKey },
      err
    );
  }

  return jsonResponse(
    { error: 'Conversion upload failed', detail: conversionResult.error, claim_status: 'failed' },
    500
  );
}
