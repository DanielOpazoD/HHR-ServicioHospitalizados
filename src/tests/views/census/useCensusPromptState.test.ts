import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCensusPromptState } from '@/features/census/hooks/useCensusPromptState';
import { DAILY_RECORD_STORE_CHANGED_EVENT } from '@/services/storage/indexeddb/indexedDbRecordEvents';

const mockedExecuteLoadCensusPromptDataController = vi.fn();

vi.mock('@/features/census/controllers/censusLogicController', () => ({
  INITIAL_CENSUS_PROMPT_STATE: {
    previousRecordAvailable: false,
    previousRecordDate: undefined,
    availableDates: [],
  },
  executeLoadCensusPromptDataController: (...args: unknown[]) =>
    mockedExecuteLoadCensusPromptDataController(...args),
}));

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(res => {
    resolve = res;
  });
  return { promise, resolve };
};

describe('useCensusPromptState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads prompt state for current date', async () => {
    mockedExecuteLoadCensusPromptDataController.mockResolvedValueOnce({
      previousRecordAvailable: true,
      previousRecordDate: '2026-02-14',
      availableDates: ['2026-02-13', '2026-02-14'],
    });

    const { result } = renderHook(() => useCensusPromptState('2026-02-15'));

    await waitFor(() => {
      expect(result.current).toEqual({
        previousRecordAvailable: true,
        previousRecordDate: '2026-02-14',
        availableDates: ['2026-02-13', '2026-02-14'],
      });
    });
  });

  it('ignores stale response when date changes quickly', async () => {
    const firstRequest = createDeferred<{
      previousRecordAvailable: boolean;
      previousRecordDate?: string;
      availableDates: string[];
    }>();
    const secondRequest = createDeferred<{
      previousRecordAvailable: boolean;
      previousRecordDate?: string;
      availableDates: string[];
    }>();

    mockedExecuteLoadCensusPromptDataController
      .mockImplementationOnce(() => firstRequest.promise)
      .mockImplementationOnce(() => secondRequest.promise);

    const { result, rerender } = renderHook(({ date }) => useCensusPromptState(date), {
      initialProps: { date: '2026-02-14' },
    });

    rerender({ date: '2026-02-15' });

    await act(async () => {
      secondRequest.resolve({
        previousRecordAvailable: true,
        previousRecordDate: '2026-02-14',
        availableDates: ['2026-02-13', '2026-02-14'],
      });
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current.previousRecordDate).toBe('2026-02-14');
    });

    await act(async () => {
      firstRequest.resolve({
        previousRecordAvailable: false,
        previousRecordDate: undefined,
        availableDates: [],
      });
      await Promise.resolve();
    });

    expect(result.current.previousRecordDate).toBe('2026-02-14');
    expect(result.current.previousRecordAvailable).toBe(true);
  });

  it('ignores current-day-only local store writes', async () => {
    mockedExecuteLoadCensusPromptDataController.mockResolvedValueOnce({
      previousRecordAvailable: false,
      previousRecordDate: undefined,
      availableDates: [],
    });

    const { result } = renderHook(() => useCensusPromptState('2026-02-15'));

    await waitFor(() => {
      expect(result.current).toEqual({
        previousRecordAvailable: false,
        previousRecordDate: undefined,
        availableDates: [],
      });
    });

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(DAILY_RECORD_STORE_CHANGED_EVENT, {
          detail: { operation: 'save', dates: ['2026-02-15'] },
        })
      );
      await Promise.resolve();
    });

    expect(result.current).toEqual({
      previousRecordAvailable: false,
      previousRecordDate: undefined,
      availableDates: [],
    });
    expect(mockedExecuteLoadCensusPromptDataController).toHaveBeenCalledTimes(1);
  });

  it('reloads prompt state when another day changes in the local store', async () => {
    mockedExecuteLoadCensusPromptDataController
      .mockResolvedValueOnce({
        previousRecordAvailable: false,
        previousRecordDate: undefined,
        availableDates: [],
      })
      .mockResolvedValueOnce({
        previousRecordAvailable: true,
        previousRecordDate: '2026-02-14',
        availableDates: ['2026-02-14'],
      });

    const { result } = renderHook(() => useCensusPromptState('2026-02-15'));

    await waitFor(() => {
      expect(result.current).toEqual({
        previousRecordAvailable: false,
        previousRecordDate: undefined,
        availableDates: [],
      });
    });

    await act(async () => {
      window.dispatchEvent(
        new CustomEvent(DAILY_RECORD_STORE_CHANGED_EVENT, {
          detail: { operation: 'save', dates: ['2026-02-14'] },
        })
      );
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(result.current).toEqual({
        previousRecordAvailable: true,
        previousRecordDate: '2026-02-14',
        availableDates: ['2026-02-14'],
      });
    });

    expect(mockedExecuteLoadCensusPromptDataController).toHaveBeenCalledTimes(2);
  });
});
