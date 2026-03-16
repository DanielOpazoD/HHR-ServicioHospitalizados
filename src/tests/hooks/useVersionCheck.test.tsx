import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockWarn = vi.fn();
const mockGetLocalStorageItem = vi.fn();
const mockSetLocalStorageItem = vi.fn();
const mockReload = vi.fn();

vi.mock('@/shared/runtime/browserWindowRuntime', () => ({
  defaultBrowserWindowRuntime: {
    getLocalStorageItem: (...args: unknown[]) => mockGetLocalStorageItem(...args),
    setLocalStorageItem: (...args: unknown[]) => mockSetLocalStorageItem(...args),
    reload: (...args: unknown[]) => mockReload(...args),
  },
}));

vi.mock('@/services/utils/loggerService', () => ({
  logger: {
    child: () => ({
      warn: (...args: unknown[]) => mockWarn(...args),
    }),
  },
}));

import { useVersionCheck } from '@/hooks/useVersionCheck';

describe('useVersionCheck', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetLocalStorageItem.mockReturnValue(null);
  });

  it('ignores html fallback responses without logging a parse warning', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: () => 'text/html; charset=utf-8',
        },
        json: vi.fn(),
      })
    );

    renderHook(() => useVersionCheck());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(mockWarn).not.toHaveBeenCalled();
    expect(mockSetLocalStorageItem).not.toHaveBeenCalled();
    expect(mockReload).not.toHaveBeenCalled();
  });
});
