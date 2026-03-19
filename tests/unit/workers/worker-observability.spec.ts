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

function createFailingWorkerDb() {
  return {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn(() => ({
        first: vi.fn(async () => null),
        run: vi.fn(async () => {
          if (sql.includes('INSERT INTO lead_callbacks')) {
            throw new Error('db write failed');
          }
          return { success: true };
        }),
      })),
      run: vi.fn(async () => ({ success: true })),
    })),
  } as any;
}

function createFailingPixelDb() {
  return {
    prepare: vi.fn((sql: string) => ({
      bind: vi.fn(() => ({
        run: vi.fn(async () => {
          if (sql.includes('INSERT INTO pixel_events')) {
            throw new Error('pixel insert failed');
          }
          return { success: true };
        }),
      })),
      run: vi.fn(async () => ({ success: true })),
    })),
  } as any;
}

describe('worker observability for async tracking failures', () => {
  it('logs structured async errors for /track failures without blocking response', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const env = { DB: createFailingWorkerDb() } as any;
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
    const errorCall = errorSpy.mock.calls.find(call => call[0] === 'worker_tracking_async_error');
    expect(errorCall).toBeTruthy();
    expect(errorCall?.[1]).toMatchObject({
      flow: 'track',
      stage: 'db_write',
      account_id: 'acct-1',
      event: 'page_view',
      click_id: 'click-1',
      path: '/track',
    });
    errorSpy.mockRestore();
  });

  it('logs structured async errors for worker /e failures without blocking response', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const env = { DB: createFailingWorkerDb() } as any;
    const { ctx, tasks } = createExecutionContext();

    const req = new Request('https://api.example.com/e', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'e=pv&sid=s-1&cid=click-2',
    });

    const res = await callbackWorker.fetch(req, env, ctx);
    await flushTasks(tasks);

    expect(res.status).toBe(204);
    const errorCall = errorSpy.mock.calls.find(
      call => call[0] === 'worker_tracking_async_error' && (call[1] as any)?.flow === 'pixel_proxy'
    );
    expect(errorCall).toBeTruthy();
    expect(errorCall?.[1]).toMatchObject({
      flow: 'pixel_proxy',
      stage: 'db_write',
      click_id: 'click-2',
      path: '/e',
    });
    errorSpy.mockRestore();
  });

  it('logs structured async errors for pixel-worker /e failures without blocking response', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const env = { DB: createFailingPixelDb(), ENVIRONMENT: 'test' } as any;
    const { ctx, tasks } = createExecutionContext();

    const req = new Request('https://t.example.com/e', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        e: 'pv',
        sid: 'session-1',
        cid: 'click-3',
        domain: 'example.com',
      }),
    });

    const res = await pixelWorker.fetch(req, env, ctx);
    await flushTasks(tasks);

    expect(res.status).toBe(204);
    const errorCall = errorSpy.mock.calls.find(call => call[0] === 'pixel_worker_async_error');
    expect(errorCall).toBeTruthy();
    expect(errorCall?.[1]).toMatchObject({
      flow: 'pixel_worker',
      stage: 'db_write',
      event: 'pv',
      click_id: 'click-3',
      path: '/e',
    });
    errorSpy.mockRestore();
  });
});
