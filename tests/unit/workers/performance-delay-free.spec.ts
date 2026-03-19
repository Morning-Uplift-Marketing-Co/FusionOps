import { describe, expect, it, vi } from 'vitest';
import callbackWorker from '../../../apps/worker/src/index';
import pixelWorker from '../../../apps/pixel-worker/src/index';

function createExecutionContext() {
  const tasks: Promise<unknown>[] = [];
  const ctx = {
    waitUntil: vi.fn((promise: Promise<unknown>) => {
      tasks.push(promise);
    }),
  } as any;
  return { ctx, tasks };
}

async function flushTasks(tasks: Promise<unknown>[]) {
  await Promise.allSettled(tasks);
}

function createWorkerEnv() {
  return {
    DB: {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(async () => ({ domains: '["example.com"]' })),
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

describe('performance delay cleanup', () => {
  it('does not use artificial setTimeout delays in callback-worker /track path', async () => {
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const env = createWorkerEnv();
    const { ctx, tasks } = createExecutionContext();

    const req = new Request('https://api.example.com/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'page_view',
        click_id: 'click-1',
        account_id: 'acct-1',
      }),
    });

    const res = await callbackWorker.fetch(req, env, ctx);
    await flushTasks(tasks);

    expect(res.status).toBe(204);
    expect(timeoutSpy).not.toHaveBeenCalled();
    timeoutSpy.mockRestore();
  });

  it('does not use artificial setTimeout delays in pixel-worker /e path', async () => {
    const timeoutSpy = vi.spyOn(globalThis, 'setTimeout');
    const env = createPixelEnv();
    const { ctx, tasks } = createExecutionContext();

    const req = new Request('https://t.example.com/e', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        e: 'pv',
        sid: 'session-1',
        cid: 'click-2',
      }),
    });

    const res = await pixelWorker.fetch(req, env, ctx);
    await flushTasks(tasks);

    expect(res.status).toBe(204);
    expect(timeoutSpy).not.toHaveBeenCalled();
    timeoutSpy.mockRestore();
  });
});
