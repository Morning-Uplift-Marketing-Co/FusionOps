import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sendBeacon } from '../../../apps/lander/src/lib/tracking';

describe('client tracking beacon observability', () => {
  beforeEach(() => {
    sessionStorage.clear();
    (window as any).__TRACK_URL__ = '/track';
    (window as any).__TRACK_DEBUG__ = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    delete (window as any).__TRACK_URL__;
    delete (window as any).__TRACK_DEBUG__;
  });

  it('emits debug warning when sendBeacon returns false', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    Object.defineProperty(window.navigator, 'sendBeacon', {
      configurable: true,
      value: vi.fn().mockReturnValue(false),
    });
    (window as any).__TRACK_DEBUG__ = true;

    sendBeacon('page_view');

    expect(warnSpy).toHaveBeenCalledWith(
      'tracking_beacon_rejected',
      expect.objectContaining({
        event: 'page_view',
        endpoint: '/track',
      })
    );
  });

  it('emits debug error when sendBeacon throws', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    Object.defineProperty(window.navigator, 'sendBeacon', {
      configurable: true,
      value: vi.fn(() => {
        throw new Error('sendBeacon unavailable');
      }),
    });
    (window as any).__TRACK_DEBUG__ = true;

    expect(() => sendBeacon('form_submit')).not.toThrow();
    expect(errorSpy).toHaveBeenCalledWith(
      'tracking_beacon_failed',
      expect.objectContaining({
        event: 'form_submit',
        endpoint: '/track',
        message: 'sendBeacon unavailable',
      })
    );
  });

  it('stays silent in non-debug mode when beacon is rejected', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    Object.defineProperty(window.navigator, 'sendBeacon', {
      configurable: true,
      value: vi.fn().mockReturnValue(false),
    });
    (window as any).__TRACK_DEBUG__ = false;

    expect(() => sendBeacon('page_view')).not.toThrow();
    expect(warnSpy).not.toHaveBeenCalled();
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
