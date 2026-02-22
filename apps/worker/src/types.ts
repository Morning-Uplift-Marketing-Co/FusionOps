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
  voluum_api_key: string;
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
