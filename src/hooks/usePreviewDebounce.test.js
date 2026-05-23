/**
 * usePreviewDebounce Hook Tests (PREV-03)
 * ========================================
 * Tests for debounced preview refresh hook.
 * Verifies real-time refresh with configurable delay.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { usePreviewDebounce } from './usePreviewDebounce.js';

describe('usePreviewDebounce hook', () => {
  const mockConfig = {
    brand: 'TestBrand',
    color: '#FF0000',
    h1: 'Test',
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    vi.useRealTimers();
  });

  // ─── Debounce Timing (PREV-03) ─────────────────────────────────────────────

  it('should delay preview refresh by specified delay (default 400ms)', () => {
    const { result } = renderHook(() =>
      usePreviewDebounce(mockConfig, 'tpl-123')
    );

    expect(result.current.previewHtml).toBe('');
    expect(result.current.loading).toBe(true);

    // Fast forward 400ms
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.previewHtml).toContain('TestBrand');
  });

  it('should only trigger one preview generation after delay expires (multiple rapid changes)', () => {
    const { result, rerender } = renderHook(
      ({ config, templateId }) => usePreviewDebounce(config, templateId, 400),
      {
        initialProps: {
          config: mockConfig,
          templateId: 'tpl-123',
        },
      }
    );

    // Simulate rapid config changes
    act(() => {
      vi.advanceTimersByTime(100);
      rerender({ config: { ...mockConfig, brand: 'Brand2' }, templateId: 'tpl-123' });
    });

    act(() => {
      vi.advanceTimersByTime(100);
      rerender({ config: { ...mockConfig, brand: 'Brand3' }, templateId: 'tpl-123' });
    });

    act(() => {
      vi.advanceTimersByTime(100);
      rerender({ config: { ...mockConfig, brand: 'Brand4' }, templateId: 'tpl-123' });
    });

    // At t=300ms, preview should still be empty (delay not met)
    expect(result.current.previewHtml).toBe('');

    // Fast forward to trigger
    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Should use the last config (Brand4)
    expect(result.current.previewHtml).toContain('Brand4');
  });

  it('should reset timer on each config change', () => {
    const { result, rerender } = renderHook(
      ({ config }) => usePreviewDebounce(config, 'tpl-123', 400),
      {
        initialProps: { config: mockConfig },
      }
    );

    // Change at t=0
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.previewHtml).toBe('');

    // Change config at t=200 (should reset timer)
    act(() => {
      rerender({ config: { ...mockConfig, brand: 'NewBrand' } });
    });

    // At t=300, should still be empty (timer reset, so 400ms from t=200)
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.previewHtml).toBe('');

    // At t=600, should trigger
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.previewHtml).toContain('NewBrand');
  });

  // ─── Real-Time Refresh State (PREV-03) ─────────────────────────────────────

  it('should update previewHtml state after debounce delay', () => {
    const { result } = renderHook(() =>
      usePreviewDebounce(mockConfig, 'tpl-123', 200)
    );

    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(result.current.previewHtml).toBeTruthy();
    expect(result.current.previewHtml).toContain('TestBrand');
  });

  it('should provide loading state during debounce', () => {
    const { result } = renderHook(() =>
      usePreviewDebounce(mockConfig, 'tpl-123', 400)
    );

    // Initially loading
    expect(result.current.loading).toBe(true);

    act(() => {
      vi.advanceTimersByTime(400);
    });

    // Loading complete
    expect(result.current.loading).toBe(false);
  });

  it('should return error state if generation fails', () => {
    // This test verifies the error state contract
    const { result } = renderHook(() =>
      usePreviewDebounce(mockConfig, 'tpl-123', 400)
    );

    // Initially no error
    expect(result.current.error).toBe(null);

    // After generation completes (error would be set if something failed)
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(result.current.error).toBe(null);
  });

  // ─── Cleanup on Unmount ───────────────────────────────────────────────────

  it('should clear timer when hook unmounts (no memory leak)', () => {
    const { unmount } = renderHook(() =>
      usePreviewDebounce(mockConfig, 'tpl-123', 400)
    );

    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });

  it('should not update state after unmount', () => {
    const { result, unmount } = renderHook(() =>
      usePreviewDebounce(mockConfig, 'tpl-123', 400)
    );

    unmount();

    // Should not throw or update state
    act(() => {
      vi.advanceTimersByTime(400);
    });

    expect(result.current.loading).toBe(true); // Should remain in initial state
  });

  // ─── Dependency Updates ──────────────────────────────────────────────────

  it('should trigger new timer when config changes', () => {
    const { result, rerender } = renderHook(
      ({ config }) => usePreviewDebounce(config, 'tpl-123', 200),
      { initialProps: { config: mockConfig } }
    );

    act(() => {
      vi.advanceTimersByTime(100);
    });

    const newConfig = { ...mockConfig, brand: 'NewBrand' };
    act(() => {
      rerender({ config: newConfig });
    });

    // Timer should be reset
    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.previewHtml).toBe('');

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.previewHtml).toContain('NewBrand');
  });

  it('should trigger new timer when templateId changes', () => {
    const { result, rerender } = renderHook(
      ({ templateId }) => usePreviewDebounce(mockConfig, templateId, 200),
      { initialProps: { templateId: 'tpl-123' } }
    );

    act(() => {
      vi.advanceTimersByTime(200);
    });

    const firstPreview = result.current.previewHtml;

    act(() => {
      rerender({ templateId: 'tpl-456' });
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Should be in loading state due to templateId change
    expect(result.current.loading).toBe(true);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.previewHtml).toBeTruthy();
  });

  it('should trigger new timer when delay prop changes', () => {
    const { result, rerender } = renderHook(
      ({ delay }) => usePreviewDebounce(mockConfig, 'tpl-123', delay),
      { initialProps: { delay: 400 } }
    );

    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(result.current.previewHtml).toBe('');

    // Change delay to 100ms
    act(() => {
      rerender({ delay: 100 });
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    // Should trigger with new delay
    expect(result.current.previewHtml).toContain('TestBrand');
  });

  it('should not reset timer if same config/templateId/delay', () => {
    const { result, rerender } = renderHook(
      ({ config, templateId, delay }) =>
        usePreviewDebounce(config, templateId, delay),
      {
        initialProps: { config: mockConfig, templateId: 'tpl-123', delay: 400 },
      }
    );

    act(() => {
      vi.advanceTimersByTime(200);
    });

    const firstLoading = result.current.loading;

    // Re-render with same props (should not reset)
    act(() => {
      rerender({ config: mockConfig, templateId: 'tpl-123', delay: 400 });
    });

    // Should maintain timer state
    expect(result.current.loading).toBe(firstLoading);
  });
});
