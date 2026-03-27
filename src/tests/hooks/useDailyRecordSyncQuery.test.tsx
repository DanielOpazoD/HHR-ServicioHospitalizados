import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDailyRecordSyncQuery } from '@/hooks/useDailyRecordSyncQuery';
import * as DailyRecordRepository from '@/services/repositories/DailyRecordRepository';
import { createQueryClientTestWrapper } from '@/tests/utils/queryClientTestUtils';
import type { DailyRecord } from '@/types';
import { DataFactory } from '@/tests/factories/DataFactory';

vi.mock('@/utils/dateUtils', async () => {
  const actual = await vi.importActual('@/utils/dateUtils');
  return {
    ...actual,
    getTodayISO: () => '2025-12-27',
  };
});

// Mock Repository
vi.mock('@/services/repositories/DailyRecordRepository', () => {
  const mockImpl = {
    getForDate: vi.fn(),
    getForDateWithMeta: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
    saveDetailed: vi.fn().mockResolvedValue({
      date: '2025-12-27',
      outcome: 'clean',
      savedLocally: true,
      savedRemotely: true,
      queuedForRetry: false,
      autoMerged: false,
    }),
    subscribe: vi.fn(() => vi.fn()),
    updatePartial: vi.fn().mockResolvedValue(undefined),
    updatePartialDetailed: vi.fn().mockResolvedValue({
      date: '2025-12-27',
      outcome: 'clean',
      savedLocally: true,
      updatedRemotely: true,
      queuedForRetry: false,
      autoMerged: false,
      patchedFields: 1,
    }),
    syncWithFirestoreDetailed: vi.fn().mockResolvedValue({
      date: '2025-12-27',
      outcome: 'clean',
      record: null,
    }),
  };
  return {
    ...mockImpl,
    DailyRecordRepository: mockImpl,
  };
});

import { UIProvider } from '@/context/UIContext';

const createWrapper = () => {
  const { wrapper } = createQueryClientTestWrapper({
    wrapChildren: children => <UIProvider>{children}</UIProvider>,
  });
  return wrapper;
};

describe('useDailyRecordSyncQuery', () => {
  const mockDate = '2025-12-27';
  const mockRecord: DailyRecord = DataFactory.createMockDailyRecord(mockDate, {
    beds: {},
    lastUpdated: '2026-01-01T00:00:00.000Z',
    discharges: [],
    transfers: [],
    cma: [],
    nurses: [],
    activeExtraBeds: [],
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const buildReadResult = (record: DailyRecord | null) => ({
    date: mockDate,
    record,
    source: record ? ('indexeddb' as const) : ('not_found' as const),
    compatibilityTier: 'none' as const,
    compatibilityIntensity: 'none' as const,
    migrationRulesApplied: [],
    consistencyState: record ? ('local_only' as const) : ('missing' as const),
    sourceOfTruth: record ? ('local' as const) : ('none' as const),
    retryability: 'not_applicable' as const,
    recoveryAction: 'none' as const,
    conflictSummary: null,
    observabilityTags: ['daily_record', 'read'],
    repairApplied: false,
  });

  it('should fetch the record on mount', async () => {
    vi.mocked(DailyRecordRepository.getForDateWithMeta).mockResolvedValue(
      buildReadResult(mockRecord)
    );

    const { result } = renderHook(() => useDailyRecordSyncQuery(mockDate), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.record).toEqual(mockRecord);
    });

    expect(DailyRecordRepository.getForDateWithMeta).toHaveBeenCalledWith(mockDate, true);
  });

  it('should handle updates via saveAndUpdate', async () => {
    vi.mocked(DailyRecordRepository.getForDateWithMeta).mockResolvedValue(
      buildReadResult(mockRecord)
    );

    const { result } = renderHook(() => useDailyRecordSyncQuery(mockDate), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.record).not.toBeNull());

    const updatedRecord = { ...mockRecord, lastUpdated: 'new-date' };
    await result.current.saveAndUpdate(updatedRecord);

    expect(DailyRecordRepository.saveDetailed).toHaveBeenCalledWith(updatedRecord);
  });

  it('refreshes through detailed sync before refetching', async () => {
    vi.mocked(DailyRecordRepository.getForDateWithMeta).mockResolvedValue(
      buildReadResult(mockRecord)
    );

    const { result } = renderHook(() => useDailyRecordSyncQuery(mockDate), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.record).not.toBeNull());

    result.current.refresh();

    await waitFor(() => {
      expect(DailyRecordRepository.syncWithFirestoreDetailed).toHaveBeenCalledWith(mockDate);
    });
  });

  it('forces a recovery sync once when today loads as empty', async () => {
    vi.mocked(DailyRecordRepository.getForDateWithMeta).mockResolvedValue(buildReadResult(null));

    renderHook(() => useDailyRecordSyncQuery(mockDate), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(DailyRecordRepository.syncWithFirestoreDetailed).toHaveBeenCalledWith(mockDate);
    });
  });
});
