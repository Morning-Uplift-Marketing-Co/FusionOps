// ============================================================
// Dedup Engine - SHA-256 based deduplication
// ============================================================

export type ConversionClaimStatus = 'pending' | 'completed' | 'failed';

export interface ConversionClaimResult {
  claimed: boolean;
  status: ConversionClaimStatus | 'duplicate';
}

/**
 * Generate dedup key: sha256(click_id + ":" + lead_id)
 * Uses Web Crypto API available in Cloudflare Workers.
 */
export async function generateDedupKey(clickId: string, leadId: string): Promise<string> {
  const input = `${clickId}:${leadId}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Atomically claim a conversion before upload to avoid check-then-insert races.
 * Returns claimed=false when another request already owns this key.
 */
export async function claimConversion(
  db: D1Database,
  dedupKey: string,
  accountId: string
): Promise<ConversionClaimResult> {
  const result = await db
    .prepare(
      `INSERT INTO conversion_claims (dedup_key, account_id, status, created_at, updated_at)
       VALUES (?, ?, 'pending', strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
       ON CONFLICT(dedup_key, account_id) DO NOTHING`
    )
    .bind(dedupKey, accountId)
    .run();

  const changes = (result as { meta?: { changes?: number } })?.meta?.changes ?? 0;
  if (changes > 0) {
    return { claimed: true, status: 'pending' };
  }

  const existing = await db
    .prepare('SELECT status FROM conversion_claims WHERE dedup_key = ? AND account_id = ?')
    .bind(dedupKey, accountId)
    .first<{ status: ConversionClaimStatus }>();

  if (!existing) return { claimed: false, status: 'duplicate' };
  return { claimed: false, status: existing.status };
}

export async function completeConversionClaim(
  db: D1Database,
  dedupKey: string,
  accountId: string
): Promise<void> {
  await db
    .prepare(
      `UPDATE conversion_claims
       SET status = 'completed', last_error = NULL, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE dedup_key = ? AND account_id = ?`
    )
    .bind(dedupKey, accountId)
    .run();
}

export async function failConversionClaim(
  db: D1Database,
  dedupKey: string,
  accountId: string,
  errorMessage: string
): Promise<void> {
  await db
    .prepare(
      `UPDATE conversion_claims
       SET status = 'failed', last_error = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
       WHERE dedup_key = ? AND account_id = ?`
    )
    .bind(errorMessage.slice(0, 1000), dedupKey, accountId)
    .run();
}

/**
 * Legacy helper kept for backwards compatibility with prior code/tests.
 * Returns true when any claim already exists for the account + key.
 */
export async function isDuplicate(
  db: D1Database,
  dedupKey: string,
  accountId: string
): Promise<boolean> {
  const result = await db
    .prepare('SELECT 1 FROM conversion_claims WHERE dedup_key = ? AND account_id = ?')
    .bind(dedupKey, accountId)
    .first();

  return result !== null;
}

/**
 * Legacy helper kept for backwards compatibility with prior code/tests.
 * Inserts a completed claim row when one doesn't exist.
 */
export async function insertDedupKey(
  db: D1Database,
  dedupKey: string,
  accountId: string
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO conversion_claims (dedup_key, account_id, status, created_at, updated_at)
       VALUES (?, ?, 'completed', strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
       ON CONFLICT(dedup_key, account_id) DO NOTHING`
    )
    .bind(dedupKey, accountId)
    .run();
}
