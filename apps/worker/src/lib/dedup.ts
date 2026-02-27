// ============================================================
// Dedup Engine — SHA-256 based deduplication
// ============================================================

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
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Check if a dedup key already exists for the given account.
 * Returns true if the conversion has already been processed.
 */
export async function isDuplicate(
  db: D1Database,
  dedupKey: string,
  accountId: string
): Promise<boolean> {
  const result = await db
    .prepare('SELECT 1 FROM dedup_keys WHERE dedup_key = ? AND account_id = ?')
    .bind(dedupKey, accountId)
    .first();

  return result !== null;
}

/**
 * Insert dedup key after successful Voluum upload.
 * This must ONLY be called after confirmed successful upload.
 */
export async function insertDedupKey(
  db: D1Database,
  dedupKey: string,
  accountId: string
): Promise<void> {
  await db
    .prepare('INSERT INTO dedup_keys (dedup_key, account_id) VALUES (?, ?)')
    .bind(dedupKey, accountId)
    .run();
}
