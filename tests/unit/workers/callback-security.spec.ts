import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleLeadsGateCallback } from '../../../apps/worker/src/handlers/callback';

vi.mock('../../../apps/worker/src/lib/dedup', () => ({
  generateDedupKey: vi.fn().mockResolvedValue('dedup-key'),
  claimConversion: vi.fn().mockResolvedValue({ claimed: true, status: 'pending' }),
  completeConversionClaim: vi.fn().mockResolvedValue(undefined),
  failConversionClaim: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../../../apps/worker/src/lib/voluum', () => ({
  uploadConversion: vi.fn().mockResolvedValue({ success: true }),
}));

type AccountRow = {
  account_id: string;
  callback_token: string;
  voluum_api_key: string;
  domains: string;
  active: number;
};

function createMockDb(account: AccountRow | null) {
  const state = {
    rawPayloadInserted: null as string | null,
  };

  const db = {
    prepare: vi.fn((sql: string) => ({
      bind: (...args: unknown[]) => ({
        first: vi.fn(async () => {
          if (sql.includes('SELECT * FROM accounts')) {
            return account;
          }
          return null;
        }),
        run: vi.fn(async () => {
          if (sql.includes('INSERT INTO lead_callbacks')) {
            state.rawPayloadInserted = (args[6] as string) || '';
          }
          return { success: true };
        }),
      }),
    })),
  };

  return { db, state };
}

function buildCallbackBody(extraPayload = {}) {
  return JSON.stringify({
    type: 'soldLead',
    lead_id: 'lead-1',
    click_id: 'click-1',
    price: 42,
    created: new Date().toISOString(),
    ...extraPayload,
  });
}

describe('handleLeadsGateCallback security hardening', () => {
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

  it('returns unauthorized for missing account and invalid token with a uniform status/body', async () => {
    const missingDb = createMockDb(null);
    const missingEnv = { DB: missingDb.db } as any;
    const missingReq = new Request('https://api.example.com/callback/acct-1/leadsgate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: buildCallbackBody(),
    });

    const missingRes = await handleLeadsGateCallback(missingReq, missingEnv, 'acct-1');
    const missingBody = await missingRes.json();

    const invalidDb = createMockDb(account);
    const invalidEnv = { DB: invalidDb.db } as any;
    const invalidReq = new Request('https://api.example.com/callback/acct-1/leadsgate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Callback-Token': 'wrong-token',
      },
      body: buildCallbackBody(),
    });

    const invalidRes = await handleLeadsGateCallback(invalidReq, invalidEnv, 'acct-1');
    const invalidBody = await invalidRes.json();

    expect(missingRes.status).toBe(401);
    expect(invalidRes.status).toBe(401);
    expect(missingBody).toEqual(invalidBody);
    expect(missingBody).toEqual({ error: 'Unauthorized' });
  });

  it('returns unauthorized for missing callback token', async () => {
    const { db } = createMockDb(account);
    const env = { DB: db } as any;
    const req = new Request('https://api.example.com/callback/acct-1/leadsgate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: buildCallbackBody(),
    });

    const res = await handleLeadsGateCallback(req, env, 'acct-1');
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  it('rejects oversized callback payloads with 413 before parsing', async () => {
    const { db } = createMockDb(account);
    const env = { DB: db } as any;
    const oversizedField = 'x'.repeat(70_000);
    const req = new Request('https://api.example.com/callback/acct-1/leadsgate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Callback-Token': 'secret-token',
      },
      body: buildCallbackBody({ note: oversizedField }),
    });

    const res = await handleLeadsGateCallback(req, env, 'acct-1');
    const body = await res.json();

    expect(res.status).toBe(413);
    expect(body).toEqual({ error: 'Payload too large' });
  });

  it('stores bounded raw payloads in lead callback logging', async () => {
    const { db, state } = createMockDb(account);
    const env = { DB: db } as any;
    const oversizedField = 'x'.repeat(12_000);

    const req = new Request('https://api.example.com/callback/acct-1/leadsgate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Callback-Token': 'secret-token',
      },
      body: buildCallbackBody({ note: oversizedField }),
    });

    const res = await handleLeadsGateCallback(req, env, 'acct-1');
    expect(res.status).toBe(200);

    expect(state.rawPayloadInserted).toBeTruthy();
    expect((state.rawPayloadInserted || '').length).toBeLessThanOrEqual(10_014);
    expect(state.rawPayloadInserted?.endsWith('...[truncated]')).toBe(true);
  });
});
