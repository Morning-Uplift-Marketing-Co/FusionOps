import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleLeadsGateCallback } from '../../../apps/worker/src/handlers/callback';
import { claimConversion } from '../../../apps/worker/src/lib/dedup';
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
  voluum_api_key: string;
  domains: string;
  active: number;
};

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

function createMockDb(opts: { failRawLog?: boolean } = {}) {
  const account: AccountRow = {
    account_id: 'acct-1',
    callback_token: 'secret-token',
    voluum_api_key: 'voluum-key',
    domains: '["example.com"]',
    active: 1,
  };

  return {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn(() => ({
        first: vi.fn(async () => {
          if (sql.includes('SELECT * FROM accounts')) return account;
          return null;
        }),
        run: vi.fn(async () => {
          if (opts.failRawLog && sql.includes('INSERT INTO lead_callbacks')) {
            throw new Error('raw log insert failed');
          }
          return { success: true, meta: { changes: 1 } };
        }),
      })),
    })),
  } as any;
}

describe('callback observability diagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logs stage-aware diagnostics when raw callback persistence fails', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(claimConversion).mockResolvedValue({ claimed: false, status: 'completed' });

    const env = { DB: createMockDb({ failRawLog: true }) } as any;
    const res = await handleLeadsGateCallback(buildReq(), env, 'acct-1');

    expect(res.status).toBe(200);
    const logCall = errorSpy.mock.calls.find(
      call => call[0] === 'callback_processing_error' && (call[1] as any)?.stage === 'raw_log_insert'
    );
    expect(logCall).toBeTruthy();
    expect(logCall?.[1]).toMatchObject({
      stage: 'raw_log_insert',
      account_id: 'acct-1',
      click_id: 'click-1',
      lead_id: 'lead-1',
    });

    errorSpy.mockRestore();
  });

  it('logs conversion upload failure diagnostics with correlation context', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(claimConversion).mockResolvedValue({ claimed: true, status: 'pending' });
    vi.mocked(uploadConversion).mockResolvedValue({ success: false, error: 'voluum timeout' });

    const env = { DB: createMockDb() } as any;
    const res = await handleLeadsGateCallback(buildReq(), env, 'acct-1');
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body).toMatchObject({ claim_status: 'failed' });

    const logCall = errorSpy.mock.calls.find(
      call => call[0] === 'callback_processing_error' && (call[1] as any)?.stage === 'conversion_upload'
    );
    expect(logCall).toBeTruthy();
    expect(logCall?.[1]).toMatchObject({
      stage: 'conversion_upload',
      account_id: 'acct-1',
      click_id: 'click-1',
      lead_id: 'lead-1',
      dedup_key: 'dedup-key',
      claim_status: 'failed',
      message: 'voluum timeout',
    });

    errorSpy.mockRestore();
  });
});
