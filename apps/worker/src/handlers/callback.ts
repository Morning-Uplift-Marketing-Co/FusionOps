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
import { generateDedupKey, insertDedupKey, isDuplicate } from '../lib/dedup';
import { uploadConversion } from '../lib/voluum';

/**
 * Resolve account configuration from D1.
 */
async function resolveAccount(
  db: D1Database,
  accountId: string
): Promise<AccountConfig | null> {
  return db
    .prepare('SELECT * FROM accounts WHERE account_id = ? AND active = 1')
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
    return new Response(JSON.stringify({ error: 'Account not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // --- Step 2: Validate token ---
  const token = request.headers.get('X-Callback-Token');
  const tokenResult = validateToken(token, account);
  if (!tokenResult.valid) {
    return new Response(JSON.stringify({ error: tokenResult.error }), {
      status: tokenResult.statusCode,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // --- Step 3: Parse body ---
  let rawBody: string;
  let payload: LeadsGateCallback;

  try {
    rawBody = await request.text();
    payload = JSON.parse(rawBody) as LeadsGateCallback;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // --- Step 4: Validate payload ---
  const payloadResult = validatePayload(payload);
  if (!payloadResult.valid) {
    return new Response(JSON.stringify({ error: payloadResult.error }), {
      status: payloadResult.statusCode,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // --- Step 5: Always log raw callback ---
  try {
    await logRawCallback(db, accountId, payload, rawBody);
  } catch (err) {
    // Log failure should not block processing, but we note it
    console.error('Failed to log raw callback:', err);
  }

  // --- Step 6: Non-soldLead → return 200 ---
  if (payload.type !== 'soldLead') {
    return new Response(JSON.stringify({ status: 'ok', type: payload.type }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // --- Step 7: Generate dedup key ---
  const dedupKey = await generateDedupKey(payload.click_id, payload.lead_id);

  // --- Step 8: Check for duplicate ---
  const duplicate = await isDuplicate(db, dedupKey, accountId);
  if (duplicate) {
    return new Response(
      JSON.stringify({ status: 'ok', deduplicated: true }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // --- Step 9: Upload to Voluum ---
  const conversionResult = await uploadConversion({
    cid: payload.click_id,
    payout: payload.price,
    txid: payload.lead_id,
  });

  // --- Step 10: Handle result ---
  if (conversionResult.success) {
    // Insert dedup key ONLY after successful upload
    try {
      await insertDedupKey(db, dedupKey, accountId);
    } catch (err) {
      // Dedup insert failed after successful upload.
      // This is a rare race condition. Log it but don't fail the response.
      // The next retry will hit the dedup check and return 200.
      console.error('Dedup insert failed after successful upload:', err);
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
      console.error('Failed to log successful conversion:', err);
    }

    return new Response(
      JSON.stringify({ status: 'ok', conversion: 'uploaded' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Upload failed
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
    console.error('Failed to log failed conversion:', err);
  }

  return new Response(
    JSON.stringify({ error: 'Conversion upload failed', detail: conversionResult.error }),
    {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    }
  );
}
