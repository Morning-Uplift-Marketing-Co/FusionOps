import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleLeadsGateCallback } from '../../../apps/worker/src/handlers/callback';
import {
  claimConversion,
  completeConversionClaim,
  failConversionClaim,
} from '../../../apps/worker/src/lib/dedup';
import { uploadConversion } from '../../../apps/worker/src/lib/voluum';

vi.mock('../../../apps/worker/src/lib/dedup', () => ({
  generateDedupKey: vi.fn().mockResolvedValue('dedup-key'),
  claimConversion: vi.fn(),
  completeConversionClaim: vi.fn().mockResolvedValue(undefined),
  failConversionClaim: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../apps/worker/src/lib/voluum', () => ({
  uploadConversion: vi.fn(),
}));

type AccountRow = {
  account_id: string;
  callback_token: string;
  callback_token_hash?: string | null;
  voluum_api_key: string;
  domains: string;
  active: number;
};

function createMockDb(account: AccountRow | null) {
  const db = {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn(() => ({
        first: vi.fn(async () => {
          if (sql.includes('SELECT * FROM accounts')) return account;
          return null;
        }),
        run: vi.fn(async () => ({ success: true, meta: { changes: 1 } })),
      })),
    })),
  };
  return db;
}

function buildReq() {
  return new Request('https://api.example.com/callback/acct-1/leadsgate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Callback-Token': 'secret-token',
    },
    body: JSON.stringify({
      type: 'soldLead',
      lead_id: 'lead-1',
      click_id: 'click-1',
      price: 42,
      created: new Date().toISOString(),
    }),
  });
}

describe('callback idempotent claim-first flow', () => {
  const account: AccountRow = {
    account_id: 'acct-1',
    callback_token: 'secret-token',
    voluum_api_key: 'voluum-key',
    domains: '["example.com"]',
    active: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns benign deduplicated success when claim already exists', async () => {
    vi.mocked(claimConversion).mockResolvedValue({ claimed: false, status: 'completed' });

    const env = { DB: createMockDb(account) } as any;
    const res = await handleLeadsGateCallback(buildReq(), env, 'acct-1');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({
      status: 'ok',
      deduplicated: true,
      claim_status: 'completed',
    });
    expect(uploadConversion).not.toHaveBeenCalled();
    expect(completeConversionClaim).not.toHaveBeenCalled();
    expect(failConversionClaim).not.toHaveBeenCalled();
  });

  it('uploads once and completes claim on fresh callback', async () => {
    vi.mocked(claimConversion).mockResolvedValue({ claimed: true, status: 'pending' });
    vi.mocked(uploadConversion).mockResolvedValue({ success: true });

    const env = { DB: createMockDb(account) } as any;
    const res = await handleLeadsGateCallback(buildReq(), env, 'acct-1');
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ status: 'ok', conversion: 'uploaded' });
    expect(uploadConversion).toHaveBeenCalledTimes(1);
    expect(completeConversionClaim).toHaveBeenCalledTimes(1);
    expect(failConversionClaim).not.toHaveBeenCalled();
  });
});
