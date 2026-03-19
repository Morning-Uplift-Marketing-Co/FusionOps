import { describe, expect, it, vi } from 'vitest';
import callbackWorker from '../../../apps/worker/src/index';
import pixelWorker from '../../../apps/pixel-worker/src/index';

function createCallbackEnv(domains: string[] = ['example.com']) {
  return {
    DB: {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(async () => ({ domains: JSON.stringify(domains) })),
          run: vi.fn(async () => ({ success: true })),
        })),
      })),
    },
  } as any;
}

function createPixelEnv() {
  return {
    DB: {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          run: vi.fn(async () => ({ success: true })),
        })),
        run: vi.fn(async () => ({ success: true })),
      })),
    },
    ENVIRONMENT: 'test',
  } as any;
}

function createExecutionContext() {
  return { waitUntil: vi.fn() } as any;
}

function requestLike(input: {
  url: string;
  method: string;
  origin?: string;
  contentLength?: string;
  body?: string;
}) {
  const headerMap = new Map<string, string>();
  if (input.origin) headerMap.set('origin', input.origin);
  if (input.contentLength) headerMap.set('content-length', input.contentLength);
  return {
    url: input.url,
    method: input.method,
    headers: {
      get: (name: string) => headerMap.get(name.toLowerCase()) ?? null,
    },
    text: async () => input.body ?? '',
  } as unknown as Request;
}

describe('worker CORS and payload security boundaries', () => {
  it('does not emit wildcard callback CORS and only allows explicit origins', async () => {
    const env = createCallbackEnv(['example.com']);
    const ctx = createExecutionContext();

    const allowedReq = requestLike({
      url: 'https://api.example.com/callback/acct-1/leadsgate',
      method: 'OPTIONS',
      origin: 'https://example.com',
    });
    const allowedRes = await callbackWorker.fetch(allowedReq, env, ctx);
    expect(allowedRes.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');

    const blockedReq = requestLike({
      url: 'https://api.example.com/callback/acct-1/leadsgate',
      method: 'OPTIONS',
      origin: 'https://evil.example',
    });
    const blockedRes = await callbackWorker.fetch(blockedReq, env, ctx);
    expect(blockedRes.headers.get('Access-Control-Allow-Origin')).toBeNull();

    const noOriginReq = requestLike({
      url: 'https://api.example.com/callback/acct-1/leadsgate',
      method: 'OPTIONS',
    });
    const noOriginRes = await callbackWorker.fetch(noOriginReq, env, ctx);
    expect(noOriginRes.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('allows only explicit first-party pixel origins', async () => {
    const env = createPixelEnv();
    const ctx = createExecutionContext();

    const allowedReq = requestLike({
      url: 'https://t.example.com/e',
      method: 'OPTIONS',
      origin: 'https://example.com',
    });
    const allowedRes = await pixelWorker.fetch(allowedReq, env, ctx);
    expect(allowedRes.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');

    const blockedReq = requestLike({
      url: 'https://t.example.com/e',
      method: 'OPTIONS',
      origin: 'https://evil.example',
    });
    const blockedRes = await pixelWorker.fetch(blockedReq, env, ctx);
    expect(blockedRes.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('rejects oversized pixel payloads with 413', async () => {
    const env = createPixelEnv();
    const ctx = createExecutionContext();
    const req = requestLike({
      url: 'https://t.example.com/e',
      method: 'POST',
      contentLength: '70000',
      body: JSON.stringify({ e: 'pv', sid: 's1' }),
    });

    const res = await pixelWorker.fetch(req, env, ctx);
    const body = await res.json();

    expect(res.status).toBe(413);
    expect(body).toEqual({ error: 'Payload too large' });
  });
});
