import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useExistingDaysQuery } from '@/hooks/useExistingDaysQuery';
import { createQueryClientTestWrapper } from '@/tests/utils/queryClientTestUtils';
import { DAILY_RECORD_STORE_CHANGED_EVENT } from '@/services/storage/indexeddb/indexedDbRecordEvents';

const mockFetchExistingDaysInMonth = vi.fn();

vi.mock('@/services/records/recordQueryService', () => ({
  fetchExistingDaysInMonth: (...args: unknown[]) => mockFetchExistingDaysInMonth(...args),
}));

describe('useExistingDaysQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refreshes the current month immediately when the local record store changes', async () => {
    mockFetchExistingDaysInMonth.mockResolvedValueOnce([7]).mockResolvedValueOnce([7, 14]);

    const { wrapper } = createQueryClientTestWrapper();
    const { result } = renderHook(() => useExistingDaysQuery(2026, 3), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual([7]);
    });

    window.dispatchEvent(
      new CustomEvent(DAILY_RECORD_STORE_CHANGED_EVENT, {
        detail: { operation: 'save', dates: ['2026-04-14'] },
      })
    );

    await waitFor(() => {
      expect(result.current.data).toEqual([7, 14]);
    });

    expect(mockFetchExistingDaysInMonth).toHaveBeenNthCalledWith(1, 2026, 4);
    expect(mockFetchExistingDaysInMonth).toHaveBeenNthCalledWith(2, 2026, 4);
  });

  it('ignores store changes from other months', async () => {
    mockFetchExistingDaysInMonth.mockResolvedValueOnce([7]);

    const { wrapper } = createQueryClientTestWrapper();
    const { result } = renderHook(() => useExistingDaysQuery(2026, 3), { wrapper });

    await waitFor(() => {
      expect(result.current.data).toEqual([7]);
    });

    window.dispatchEvent(
      new CustomEvent(DAILY_RECORD_STORE_CHANGED_EVENT, {
        detail: { operation: 'save', dates: ['2026-05-01'] },
      })
    );

    await waitFor(() => {
      expect(result.current.data).toEqual([7]);
    });

    expect(mockFetchExistingDaysInMonth).toHaveBeenCalledTimes(1);
  });
});
