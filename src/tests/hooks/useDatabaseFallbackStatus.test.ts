import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

vi.mock('@/services/storage/indexedDBService', () => ({
  isDatabaseInFallbackMode: vi.fn(),
}));

import { isDatabaseInFallbackMode } from '@/services/storage/indexedDBService';
import { useDatabaseFallbackStatus } from '@/hooks/useDatabaseFallbackStatus';

describe('useDatabaseFallbackStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns current fallback state', () => {
    vi.mocked(isDatabaseInFallbackMode).mockReturnValue(true);

    const { result } = renderHook(() => useDatabaseFallbackStatus());

    expect(result.current).toBe(true);
  });

  it('updates value on poll interval', () => {
    let fallback = false;
    vi.mocked(isDatabaseInFallbackMode).mockImplementation(() => fallback);

    const { result } = renderHook(() => useDatabaseFallbackStatus({ pollIntervalMs: 1000 }));
    expect(result.current).toBe(false);

    act(() => {
      fallback = true;
      vi.advanceTimersByTime(1000);
    });

    expect(result.current).toBe(true);
  });

  it('does not start polling when disabled', () => {
    let fallback = false;
    vi.mocked(isDatabaseInFallbackMode).mockImplementation(() => fallback);

    const { result } = renderHook(() =>
      useDatabaseFallbackStatus({ enabled: false, pollIntervalMs: 1000 })
    );

    expect(result.current).toBe(false);

    act(() => {
      fallback = true;
      vi.advanceTimersByTime(5000);
    });

    expect(result.current).toBe(false);
    expect(isDatabaseInFallbackMode).toHaveBeenCalledTimes(1);
  });

  it('pauses polling while the document is hidden and resumes on visibility change', () => {
    let fallback = false;
    vi.mocked(isDatabaseInFallbackMode).mockImplementation(() => fallback);

    const visibilityStateDescriptor = Object.getOwnPropertyDescriptor(document, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'hidden',
    });

    const { result } = renderHook(() => useDatabaseFallbackStatus({ pollIntervalMs: 1000 }));
    expect(result.current).toBe(false);

    act(() => {
      fallback = true;
      vi.advanceTimersByTime(1000);
    });

    expect(result.current).toBe(false);

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current).toBe(true);

    if (visibilityStateDescriptor) {
      Object.defineProperty(document, 'visibilityState', visibilityStateDescriptor);
    }
  });
});
