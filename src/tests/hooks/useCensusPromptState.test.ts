import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCensusPromptState } from '@/hooks/useCensusPromptState';
import { DAILY_RECORD_STORE_CHANGED_EVENT } from '@/services/storage/indexeddb/indexedDbRecordEvents';

const mockedExecuteLoadCensusPromptDataController = vi.fn();

vi.mock('@/hooks/controllers/censusPromptController', () => ({
  INITIAL_CENSUS_PROMPT_STATE: {
    previousRecordAvailable: false,
    previousRecordDate: undefined,
    availableDates: [],
  },
  executeLoadCensusPromptDataController: (...args: unknown[]) =>
    mockedExecuteLoadCensusPromptDataController(...args),
}));

describe('root useCensusPromptState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reloads prompt state when the local daily-record store changes', async () => {
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
