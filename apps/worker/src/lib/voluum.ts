// ============================================================
// Voluum S2S Conversion API Client
// ============================================================

import type { ConversionUploadResult, VoluumConversionPayload } from '../types';

const VOLUUM_CONVERSION_URL = 'https://tracking.voluum.com/conversion';
const REQUEST_TIMEOUT_MS = 10_000;

/**
 * Upload a conversion to Voluum via S2S postback.
 *
 * Uses the Voluum Conversion Tracking API:
 *   GET https://tracking.voluum.com/conversion?cid={click_id}&payout={price}&txid={lead_id}
 *
 * Returns success/failure with optional error message.
 */
export async function uploadConversion(
  payload: VoluumConversionPayload
): Promise<ConversionUploadResult> {
  const url = new URL(VOLUUM_CONVERSION_URL);
  url.searchParams.set('cid', payload.cid);
  url.searchParams.set('payout', payload.payout.toString());
  url.searchParams.set('txid', payload.txid);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(url.toString(), {
      method: 'GET',
      signal: controller.signal,
      headers: {
        'User-Agent': 'LPFactory-Worker/1.0',
      },
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return { success: true };
    }

    const body = await response.text().catch(() => 'Unable to read response body');
    return {
      success: false,
      error: `Voluum returned ${response.status}: ${body}`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error during Voluum upload';
    return { success: false, error: message };
  }
}
