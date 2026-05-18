import { describe, expect, it, beforeEach, vi } from 'vitest';
import { handleAgentStateRoute } from '../../../apps/api-worker/src/handlers/agent-state.js';

// In-memory mock of the D1 surface used by agent-state.js.
// Captures every bound statement; per-test assertions inspect `db.calls`.
function makeDb(overrides: Partial<{ allResults: any[]; runMeta: any; throwOnRun: boolean }> = {}) {
  const calls: { sql: string; params: any[] }[] = [];
  const batchCalls: { sql: string; params: any[] }[][] = [];

  const allResults = overrides.allResults ?? [];
  const runMeta = overrides.runMeta ?? { changes: 1, last_row_id: 42 };

  function makeStmt(sql: string) {
    return {
      bind: (...params: any[]) => ({
        sql,
        params,
        run: vi.fn(async () => {
          if (overrides.throwOnRun) throw new Error('db error');
          calls.push({ sql, params });
          return { success: true, meta: runMeta };
        }),
        all: vi.fn(async () => {
          calls.push({ sql, params });
          return { results: allResults };
        }),
      }),
    } as any;
  }

  return {
    prepare: vi.fn((sql: string) => makeStmt(sql)),
    batch: vi.fn(async (stmts: any[]) => {
      batchCalls.push(stmts.map((s) => ({ sql: s.sql, params: s.params })));
      return stmts.map(() => ({ success: true, meta: runMeta }));
    }),
    calls,
    batchCalls,
  } as any;
}

function makeRequest(body: any): Request {
  return new Request('https://api.example.com/api/agents/state/x', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function urlOf(query = ''): URL {
  return new URL(`https://api.example.com/api/agents/state/x${query}`);
}

describe('handleAgentStateRoute — fingerprints', () => {
  beforeEach(() => vi.clearAllMocks());

  it('upserts single fingerprint and returns count=1', async () => {
    const db = makeDb();
    const res = await handleAgentStateRoute({
      request: makeRequest({ agent: 'AEGIS', scope: 'brand.com', fingerprint_key: 'k1', fingerprint_hash: 'h1' }),
      env: { DB: db },
      url: urlOf(),
      path: '/api/agents/state/fingerprints',
      method: 'POST',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, upserted: 1 });
    expect(db.batchCalls).toHaveLength(1);
    expect(db.batchCalls[0]).toHaveLength(1);
  });

  it('upserts batch of 3 fingerprints', async () => {
    const db = makeDb();
    const rows = [
      { agent: 'SCOUT', scope: 's', fingerprint_key: 'a', fingerprint_hash: 'x' },
      { agent: 'SCOUT', scope: 's', fingerprint_key: 'b', fingerprint_hash: 'y' },
      { agent: 'SCOUT', scope: 's', fingerprint_key: 'c', fingerprint_hash: 'z' },
    ];
    const res = await handleAgentStateRoute({
      request: makeRequest(rows),
      env: { DB: db },
      url: urlOf(),
      path: '/api/agents/state/fingerprints',
      method: 'POST',
    });
    expect(await res.json()).toMatchObject({ success: true, upserted: 3 });
    expect(db.batchCalls[0]).toHaveLength(3);
  });

  it('rejects invalid agent name', async () => {
    const db = makeDb();
    const res = await handleAgentStateRoute({
      request: makeRequest({ agent: 'EVIL', scope: 's', fingerprint_key: 'k', fingerprint_hash: 'h' }),
      env: { DB: db },
      url: urlOf(),
      path: '/api/agents/state/fingerprints',
      method: 'POST',
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Invalid agent/);
  });

  it('rejects missing required fields', async () => {
    const db = makeDb();
    const res = await handleAgentStateRoute({
      request: makeRequest({ agent: 'AEGIS', scope: 's' }),
      env: { DB: db },
      url: urlOf(),
      path: '/api/agents/state/fingerprints',
      method: 'POST',
    });
    expect(res.status).toBe(400);
  });

  it('rejects invalid JSON', async () => {
    const db = makeDb();
    const req = new Request('https://api.example.com/x', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{not json',
    });
    const res = await handleAgentStateRoute({
      request: req,
      env: { DB: db },
      url: urlOf(),
      path: '/api/agents/state/fingerprints',
      method: 'POST',
    });
    expect(res.status).toBe(400);
  });

  it('lists fingerprints with agent filter', async () => {
    const db = makeDb({ allResults: [{ id: 1, agent: 'AEGIS', scope: 's', fingerprint_key: 'k', fingerprint_hash: 'h' }] });
    const res = await handleAgentStateRoute({
      request: new Request('https://x.com'),
      env: { DB: db },
      url: urlOf('?agent=AEGIS&limit=10'),
      path: '/api/agents/state/fingerprints',
      method: 'GET',
    });
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.count).toBe(1);
    expect(db.calls[0].sql).toContain('FROM agent_fingerprints');
    expect(db.calls[0].params).toContain('AEGIS');
    expect(db.calls[0].params).toContain(10);
  });

  it('caps limit at MAX_LIMIT (500)', async () => {
    const db = makeDb({ allResults: [] });
    await handleAgentStateRoute({
      request: new Request('https://x.com'),
      env: { DB: db },
      url: urlOf('?limit=9999'),
      path: '/api/agents/state/fingerprints',
      method: 'GET',
    });
    expect(db.calls[0].params).toContain(500);
  });
});

describe('handleAgentStateRoute — baselines', () => {
  beforeEach(() => vi.clearAllMocks());

  it('upserts a baseline', async () => {
    const db = makeDb();
    const res = await handleAgentStateRoute({
      request: makeRequest({ agent: 'HERALD', metric: 'mention_count', window: '7d', value: 42.5, scope: 'brand', sample_count: 30 }),
      env: { DB: db },
      url: urlOf(),
      path: '/api/agents/state/baselines',
      method: 'POST',
    });
    expect(res.status).toBe(200);
    expect(db.calls[0].sql).toContain('INSERT INTO agent_baselines');
    expect(db.calls[0].params).toEqual(['HERALD', 'mention_count', 'brand', '7d', 42.5, 30]);
  });

  it('defaults scope to _global and sample_count to 1', async () => {
    const db = makeDb();
    await handleAgentStateRoute({
      request: makeRequest({ agent: 'HERALD', metric: 'm', window: '7d', value: 1 }),
      env: { DB: db },
      url: urlOf(),
      path: '/api/agents/state/baselines',
      method: 'POST',
    });
    expect(db.calls[0].params).toContain('_global');
    expect(db.calls[0].params).toContain(1);
  });

  it('rejects baseline missing value', async () => {
    const db = makeDb();
    const res = await handleAgentStateRoute({
      request: makeRequest({ agent: 'HERALD', metric: 'm', window: '7d' }),
      env: { DB: db },
      url: urlOf(),
      path: '/api/agents/state/baselines',
      method: 'POST',
    });
    expect(res.status).toBe(400);
  });
});

describe('handleAgentStateRoute — alerts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates an alert and returns inserted id', async () => {
    const db = makeDb({ runMeta: { changes: 1, last_row_id: 123 } });
    const res = await handleAgentStateRoute({
      request: makeRequest({ agent: 'AEGIS', severity: 'high', title: 'Brand-jack on shady.com', payload: { url: 'shady.com' } }),
      env: { DB: db },
      url: urlOf(),
      path: '/api/agents/state/alerts',
      method: 'POST',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ success: true, id: 123 });
  });

  it('rejects unknown severity', async () => {
    const db = makeDb();
    const res = await handleAgentStateRoute({
      request: makeRequest({ agent: 'AEGIS', severity: 'PANIC', title: 't', payload: {} }),
      env: { DB: db },
      url: urlOf(),
      path: '/api/agents/state/alerts',
      method: 'POST',
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/severity/);
  });

  it('lists pending alerts only when status=pending', async () => {
    const db = makeDb({ allResults: [{ id: 1, agent: 'AEGIS', ack_status: 'pending' }] });
    await handleAgentStateRoute({
      request: new Request('https://x.com'),
      env: { DB: db },
      url: urlOf('?status=pending&agent=AEGIS'),
      path: '/api/agents/state/alerts',
      method: 'GET',
    });
    expect(db.calls[0].params).toContain('pending');
    expect(db.calls[0].params).toContain('AEGIS');
  });

  it('patches alert to acked + sets acked_at', async () => {
    const db = makeDb({ runMeta: { changes: 1 } });
    const res = await handleAgentStateRoute({
      request: makeRequest({ id: 5, ack_status: 'acked', acked_by: 'kitty' }),
      env: { DB: db },
      url: urlOf(),
      path: '/api/agents/state/alerts',
      method: 'PATCH',
    });
    expect(res.status).toBe(200);
    expect(db.calls[0].sql).toContain('unixepoch()');
    expect(db.calls[0].params).toEqual(['acked', 'kitty', 5]);
  });

  it('patch returns 404 when alert id not found', async () => {
    const db = makeDb({ runMeta: { changes: 0 } });
    const res = await handleAgentStateRoute({
      request: makeRequest({ id: 999, ack_status: 'acked' }),
      env: { DB: db },
      url: urlOf(),
      path: '/api/agents/state/alerts',
      method: 'PATCH',
    });
    expect(res.status).toBe(404);
  });
});

describe('handleAgentStateRoute — oracle-keywords', () => {
  beforeEach(() => vi.clearAllMocks());

  it('upserts keyword batch', async () => {
    const db = makeDb();
    const res = await handleAgentStateRoute({
      request: makeRequest([
        { keyword: 'payday loan', source: 'dataforseo', volume: 1200 },
        { keyword: 'short term loan', source: 'dataforseo', volume: 800 },
      ]),
      env: { DB: db },
      url: urlOf(),
      path: '/api/agents/state/oracle-keywords',
      method: 'POST',
    });
    expect(await res.json()).toMatchObject({ success: true, upserted: 2 });
    expect(db.batchCalls[0]).toHaveLength(2);
  });

  it('lists keywords with source filter', async () => {
    const db = makeDb({ allResults: [{ id: 1, keyword: 'x', source: 'dataforseo' }] });
    const res = await handleAgentStateRoute({
      request: new Request('https://x.com'),
      env: { DB: db },
      url: urlOf('?source=dataforseo&since=1700000000'),
      path: '/api/agents/state/oracle-keywords',
      method: 'GET',
    });
    expect(res.status).toBe(200);
    expect(db.calls[0].params).toContain('dataforseo');
    expect(db.calls[0].params).toContain(1700000000);
  });
});

describe('handleAgentStateRoute — routing', () => {
  it('returns null for unrelated paths (delegates to next handler)', async () => {
    const db = makeDb();
    const res = await handleAgentStateRoute({
      request: new Request('https://x.com'),
      env: { DB: db },
      url: urlOf(),
      path: '/api/templates',
      method: 'GET',
    });
    expect(res).toBeNull();
  });

  it('returns 405 for unsupported method on a valid path', async () => {
    const db = makeDb();
    const res = await handleAgentStateRoute({
      request: new Request('https://x.com', { method: 'DELETE' }),
      env: { DB: db },
      url: urlOf(),
      path: '/api/agents/state/fingerprints',
      method: 'DELETE',
    });
    expect(res.status).toBe(405);
  });
});
