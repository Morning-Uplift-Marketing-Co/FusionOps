// ============================================================
// Worker Types — Callback Engine
// ============================================================

export interface Env {
  DB: D1Database;
  ENVIRONMENT: string;
}

export interface AccountConfig {
  account_id: string;
  callback_token: string;
  callback_token_hash?: string | null;
  callback_token_version?: number | null;
  callback_token_migrated_at?: string | null;
  voluum_api_key: string;
  voluum_api_key_enc?: string | null;
  voluum_api_key_version?: number | null;
  voluum_api_key_migrated_at?: string | null;
  domains: string;
  active: number;
}

export interface LeadsGateCallback {
  type: string;
  lead_id: string;
  click_id: string;
  price: number;
  created: string;
  // Additional fields may be present in raw payload
  [key: string]: unknown;
}

export interface VoluumConversionPayload {
  cid: string;
  payout: number;
  txid: string;
}

export interface CallbackValidationResult {
  valid: boolean;
  error?: string;
  statusCode: number;
}

export interface ConversionUploadResult {
  success: boolean;
  error?: string;
}
