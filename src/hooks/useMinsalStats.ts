/**
 * useMinsalStats Hook
 * React hook for MINSAL/DEIS hospital statistics with range-based loading.
 */

import { useMemo, useState, useCallback } from 'react';
import { httpsCallable } from 'firebase/functions';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/config/queryClient';
import { fetchRecordsRangeSorted, syncRecordsRange } from '@/services/records/recordQueryService';
import {
  calculateMinsalStats as calculateMinsalStatsLocal,
  filterRecordsByDateRange,
  generateDailyTrend,
  getDateRangeFromPreset,
} from '@/services/calculations/minsalStatsCalculator';
import { resolveDisplayedMinsalStats } from '@/hooks/controllers/minsalStatsPresentationController';
import { getActiveHospitalId } from '@/constants/firestorePaths';
import {
  DailyStatsSnapshot,
  DateRangeConfig,
  DateRangePreset,
  MinsalStatistics,
} from '@/types/minsalTypes';
import type { DailyRecord } from '@/hooks/contracts/dailyRecordHookContracts';
import { defaultFunctionsRuntime } from '@/services/firebase-runtime/functionsRuntime';

interface UseMinsalStatsResult {
  stats: MinsalStatistics | null;
  trendData: DailyStatsSnapshot[];
  allRecords: DailyRecord[];
  dateRange: DateRangeConfig;
  setPreset: (preset: DateRangePreset) => void;
  setCustomRange: (startDate: string, endDate: string) => void;
  setCurrentYearMonth: (month: number) => void;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const getDaysInRange = (start: string, end: string): number => {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  return Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
};

const mergeByDateDesc = (base: DailyRecord[], incoming: DailyRecord[]): DailyRecord[] => {
  const merged = new Map<string, DailyRecord>();
  base.forEach(record => merged.set(record.date, record));
  incoming.forEach(record => merged.set(record.date, record));
  return Array.from(merged.values()).sort((a, b) => b.date.localeCompare(a.date));
};

const getErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export function useMinsalStats(initialPreset: DateRangePreset = 'lastMonth'): UseMinsalStatsResult {
  const queryClient = useQueryClient();
  const hospitalId = getActiveHospitalId();
  const [dateRange, setDateRange] = useState<DateRangeConfig>({ preset: initialPreset });

  const { startDate, endDate } = useMemo(() => {
    try {
      return getDateRangeFromPreset(
        dateRange.preset,
        dateRange.startDate,
        dateRange.endDate,
        dateRange.currentYearMonth
      );
    } catch {
      const today = new Date().toISOString().split('T')[0];
      return { startDate: today, endDate: today };
    }
  }, [dateRange]);

  const recordsQuery = useQuery({
    queryKey: queryKeys.analytics.recordsRange(startDate, endDate),
    queryFn: async (): Promise<DailyRecord[]> => {
      const localRecords = await fetchRecordsRangeSorted(startDate, endDate);
      const expectedDays = getDaysInRange(startDate, endDate);

      if (localRecords.length >= expectedDays) {
        return localRecords;
      }

      const syncedRecords = await syncRecordsRange(startDate, endDate);
      if (syncedRecords.length === 0) {
        return localRecords;
      }

      return mergeByDateDesc(localRecords, syncedRecords);
    },
    staleTime: 2 * 60 * 1000,
    gcTime: 15 * 60 * 1000,
  });

  const remoteStatsQuery = useQuery({
    queryKey: queryKeys.analytics.remoteStats(hospitalId, startDate, endDate),
    queryFn: async (): Promise<MinsalStatistics> => {
      const functions = await defaultFunctionsRuntime.getFunctions();
      const calculateStats = httpsCallable(functions, 'calculateMinsalStats');
      const result = await calculateStats({
        hospitalId,
        startDate,
        endDate,
      });
      return result.data as MinsalStatistics;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 20 * 60 * 1000,
    retry: 1,
  });

  const rangeRecords = useMemo(() => recordsQuery.data ?? [], [recordsQuery.data]);

  const trendData = useMemo(() => {
    if (rangeRecords.length === 0) return [];
    const filtered = filterRecordsByDateRange(rangeRecords, startDate, endDate);
    return generateDailyTrend(filtered);
  }, [rangeRecords, startDate, endDate]);

  const localRangeStats = useMemo(() => {
    if (rangeRecords.length === 0) {
      return null;
    }
    return calculateMinsalStatsLocal(rangeRecords, startDate, endDate);
  }, [rangeRecords, startDate, endDate]);

  const localFallbackStats = useMemo(() => {
    if (!remoteStatsQuery.isError) {
      return null;
    }
    return localRangeStats;
  }, [remoteStatsQuery.isError, localRangeStats]);

  const stats = useMemo<MinsalStatistics | null>(() => {
    return resolveDisplayedMinsalStats({
      localStats: localRangeStats,
      remoteStats: remoteStatsQuery.data ?? localFallbackStats,
    });
  }, [localFallbackStats, localRangeStats, remoteStatsQuery.data]);

  const error = useMemo(() => {
    if (recordsQuery.error) {
      return getErrorMessage(recordsQuery.error, 'Error loading records');
    }

    if (remoteStatsQuery.isError && !localFallbackStats) {
      return getErrorMessage(remoteStatsQuery.error, 'Error loading remote statistics');
    }

    return null;
  }, [recordsQuery.error, remoteStatsQuery.isError, remoteStatsQuery.error, localFallbackStats]);

  const setPreset = useCallback(
    (preset: DateRangePreset) => {
      if (preset === 'currentMonth') {
        setDateRange({
          preset,
          currentYearMonth: new Date().getMonth() + 1,
        });
        return;
      }
      setDateRange({ preset });
    },
    [setDateRange]
  );

  const setCustomRange = useCallback(
    (start: string, end: string) => {
      setDateRange({
        preset: 'custom',
        startDate: start,
        endDate: end,
      });
    },
    [setDateRange]
  );

  const setCurrentYearMonth = useCallback(
    (month: number) => {
      setDateRange({
        preset: 'currentMonth',
        currentYearMonth: month,
      });
    },
    [setDateRange]
  );

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({
        queryKey: queryKeys.analytics.recordsRange(startDate, endDate),
      }),
      queryClient.invalidateQueries({
        queryKey: queryKeys.analytics.remoteStats(hospitalId, startDate, endDate),
      }),
    ]);
  }, [queryClient, hospitalId, startDate, endDate]);

  return {
    stats,
    trendData,
    allRecords: rangeRecords,
    dateRange,
    setPreset,
    setCustomRange,
    setCurrentYearMonth,
    isLoading: recordsQuery.isLoading || (remoteStatsQuery.isLoading && !localFallbackStats),
    error,
    refresh,
  };
}

export default useMinsalStats;
