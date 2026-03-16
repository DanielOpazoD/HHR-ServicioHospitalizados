import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/config/queryClient';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { DailyRecordPatch } from '@/hooks/useDailyRecordTypes';
import { applyPatches } from '@/utils/patchUtils';
import { createGetDailyRecordQuery } from '@/services/repositories/contracts/dailyRecordQueries';

interface DailyRecordReader {
  getForDate: (date: string) => Promise<DailyRecord | null>;
  subscribe?: (
    date: string,
    callback: (record: DailyRecord | null, hasPendingWrites: boolean) => void
  ) => () => void;
}

export const getDailyRecordQueryKey = (date: string) => queryKeys.dailyRecord.byDate(date);

export const createDailyRecordQueryFn =
  (dailyRecord: DailyRecordReader, date: string) => async (): Promise<DailyRecord | null> => {
    const query = createGetDailyRecordQuery(date);
    return dailyRecord.getForDate(query.date);
  };

export const shouldUseDailyRecordRealtimeSync = (
  date: string,
  isOfflineMode: boolean,
  isFirebaseConnected: boolean
) => Boolean(date) && !isOfflineMode && isFirebaseConnected;

export const createDailyRecordSubscription = (
  dailyRecord: DailyRecordReader,
  date: string,
  queryClient: QueryClient
) => {
  if (!dailyRecord.subscribe) {
    return null;
  }

  return dailyRecord.subscribe(date, (record, hasPendingWrites) => {
    if (!hasPendingWrites) {
      queryClient.setQueryData(getDailyRecordQueryKey(date), record);
    }
  });
};

export const buildPreviousDayDate = (date: string) => {
  const currentDate = new Date(`${date}T12:00:00`);
  currentDate.setDate(currentDate.getDate() - 1);
  return currentDate.toISOString().split('T')[0];
};

export const prefetchPreviousDailyRecord = (
  queryClient: QueryClient,
  dailyRecord: DailyRecordReader,
  date: string
) =>
  queryClient.prefetchQuery({
    queryKey: getDailyRecordQueryKey(buildPreviousDayDate(date)),
    queryFn: createDailyRecordQueryFn(dailyRecord, buildPreviousDayDate(date)),
    staleTime: 5 * 60 * 1000,
  });

export const setDailyRecordQueryData = (
  queryClient: QueryClient,
  date: string,
  updater: DailyRecord | null | ((previous: DailyRecord | null) => DailyRecord | null)
) => {
  queryClient.setQueryData(getDailyRecordQueryKey(date), updater);
};

export const invalidateDailyRecordQuery = (queryClient: QueryClient, date?: string) => {
  if (date) {
    queryClient.invalidateQueries({ queryKey: getDailyRecordQueryKey(date) });
    return;
  }

  queryClient.invalidateQueries({ queryKey: queryKeys.dailyRecord.all });
};

export const applyOptimisticDailyRecordPatch = (
  previousRecord: DailyRecord,
  partial: DailyRecordPatch
) => {
  const updatedRecord = applyPatches(previousRecord, partial);
  updatedRecord.lastUpdated = new Date().toISOString();
  return updatedRecord;
};
