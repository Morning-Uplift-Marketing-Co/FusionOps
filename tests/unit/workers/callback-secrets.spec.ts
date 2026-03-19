import { describe, expect, it } from 'vitest';
import { hashCallbackToken, validateToken } from '../../../apps/worker/src/lib/validation';
import type { AccountConfig } from '../../../apps/worker/src/types';

function baseAccount(overrides: Partial<AccountConfig> = {}): AccountConfig {
  return {
    account_id: 'acct-1',
    callback_token: 'legacy-secret',
    voluum_api_key: 'voluum-plaintext',
    domains: '["example.com"]',
    active: 1,
    ...overrides,
  };
}

describe('callback token secret migration compatibility', () => {
  it('accepts migrated hash credentials when token matches', async () => {
    const hashed = await hashCallbackToken('migrated-secret', {
      iterations: 10_000,
      saltHex: '00112233445566778899aabbccddeeff',
    });
    const account = baseAccount({
      callback_token: 'legacy-secret',
      callback_token_hash: hashed,
      callback_token_version: 1,
      callback_token_migrated_at: new Date().toISOString(),
    });

    const result = await validateToken('migrated-secret', account);
    expect(result.valid).toBe(true);
    expect(result.statusCode).toBe(200);
  });

  it('rejects migrated hash credentials when token is wrong', async () => {
    const hashed = await hashCallbackToken('migrated-secret', {
      iterations: 10_000,
      saltHex: '00112233445566778899aabbccddeeff',
    });
    const account = baseAccount({
      callback_token_hash: hashed,
      callback_token_version: 1,
    });

    const result = await validateToken('wrong-token', account);
    expect(result.valid).toBe(false);
    expect(result.statusCode).toBe(401);
    expect(result.error).toBe('Unauthorized');
  });

  it('falls back to legacy plaintext callback token when hash is absent', async () => {
    const account = baseAccount({
      callback_token_hash: null,
      callback_token_version: null,
      callback_token_migrated_at: null,
    });

    const ok = await validateToken('legacy-secret', account);
    const denied = await validateToken('wrong-token', account);

    expect(ok.valid).toBe(true);
    expect(denied.valid).toBe(false);
    expect(denied.statusCode).toBe(401);
    expect(denied.error).toBe('Unauthorized');
  });

  it('does not bypass migrated hash path even if legacy token matches', async () => {
    const hashed = await hashCallbackToken('migrated-secret', {
      iterations: 10_000,
      saltHex: '00112233445566778899aabbccddeeff',
    });
    const account = baseAccount({
      callback_token: 'legacy-secret',
      callback_token_hash: hashed,
      callback_token_version: 1,
    });

    const result = await validateToken('legacy-secret', account);
    expect(result.valid).toBe(false);
    expect(result.statusCode).toBe(401);
  });
});
