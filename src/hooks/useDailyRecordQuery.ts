/**
 * useDailyRecordQuery Hook
 * React Query wrapper for fetching daily records with caching.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../config/queryClient';
import { DailyRecord } from '@/types';
import { useRepositories } from '@/services/RepositoryContext';
import { useEffect } from 'react';
import { DailyRecordPatch } from './useDailyRecordTypes';
import {
  applyOptimisticDailyRecordPatch,
  createDailyRecordQueryFn,
  createDailyRecordSubscription,
  getDailyRecordQueryKey,
  invalidateDailyRecordQuery,
  prefetchPreviousDailyRecord,
  setDailyRecordQueryData,
  shouldUseDailyRecordRealtimeSync,
} from '@/hooks/controllers/dailyRecordQueryController';

/**
 * Hook for fetching a daily record by date with React Query.
 * Provides automatic caching and background refetching.
 *
 * @param date - Date string in YYYY-MM-DD format
 * @param isOfflineMode - Whether the app is forced to offline
 * @param isFirebaseConnected - Whether Firebase Auth is ready
 * @returns Query result with data, loading, and error states
 */
export const useDailyRecordQuery = (
  date: string,
  isOfflineMode: boolean = false,
  isFirebaseConnected: boolean = false
) => {
  const queryClient = useQueryClient();
  const { dailyRecord } = useRepositories();

  const queryKey = getDailyRecordQueryKey(date);
  const query = useQuery({
    queryKey,
    queryFn: createDailyRecordQueryFn(dailyRecord, date),
    enabled: !!date,
  });

  // Subscribe to real-time updates
  useEffect(() => {
    if (!shouldUseDailyRecordRealtimeSync(date, isOfflineMode, isFirebaseConnected)) return;

    const unsubscribe = createDailyRecordSubscription(dailyRecord, date, queryClient);
    if (!unsubscribe) return;

    return () => unsubscribe();
  }, [date, queryClient, isOfflineMode, isFirebaseConnected, dailyRecord]);

  // Prefetch previous day for faster "copy from previous" functionality
  useEffect(() => {
    if (!shouldUseDailyRecordRealtimeSync(date, isOfflineMode, isFirebaseConnected)) return;
    if (import.meta.env.DEV) return;

    prefetchPreviousDailyRecord(queryClient, dailyRecord, date);
  }, [date, queryClient, dailyRecord, isOfflineMode, isFirebaseConnected]);

  return query;
};

/**
 * Hook for saving/updating a daily record.
 * Provides optimistic updates and automatic cache invalidation.
 */
export const useSaveDailyRecordMutation = () => {
  const queryClient = useQueryClient();
  const { dailyRecord } = useRepositories();

  return useMutation({
    mutationFn: async (record: DailyRecord) => {
      await dailyRecord.save(record);
      return record;
    },
    onMutate: newRecord => {
      // Cancel any outgoing refetches (don't await to avoid race conditions in rapid updates)
      queryClient.cancelQueries({
        queryKey: queryKeys.dailyRecord.byDate(newRecord.date),
      });

      // Snapshot the previous value
      const previousRecord = queryClient.getQueryData<DailyRecord>(
        getDailyRecordQueryKey(newRecord.date)
      );

      // Optimistically update
      setDailyRecordQueryData(queryClient, newRecord.date, newRecord);

      // Return context with the previous value
      return { previousRecord };
    },
    onError: (err, newRecord, context) => {
      // Rollback on error
      if (context?.previousRecord) {
        setDailyRecordQueryData(queryClient, newRecord.date, context.previousRecord);
      }
    },
    onSettled: record => {
      // Refetch to ensure we're in sync
      if (record) {
        invalidateDailyRecordQuery(queryClient, record.date);
      }
    },
  });
};

/**
 * Hook for partial updates (patches).
 * Provides granular optimistic updates for better performance.
 *
 * Flow for "Atomicity & Sync":
 * 1. onMutate: Cancels refetches, snapshots old data, and applies patches locally
 *    using dot-notation paths. This gives immediate UI feedback.
 * 2. mutationFn: Sends only the patch to the server (DailyRecordRepository.updatePartial).
 * 3. Firestore: Merges the patch server-side.
 * 4. Real-time Subscription: The query observer in useDailyRecordQuery receives the
 *    update from Firestore and updates the cache, ensuring the UI aligns with
 *    the final server state (eventual consistency).
 */
export const usePatchDailyRecordMutation = (date: string) => {
  const queryClient = useQueryClient();
  const { dailyRecord } = useRepositories();

  return useMutation({
    mutationFn: async (partial: DailyRecordPatch) => {
      await dailyRecord.updatePartial(date, partial);
      return partial;
    },
    onMutate: partial => {
      // Don't await cancelQueries to ensure the optimistic update happens in the same tick
      queryClient.cancelQueries({
        queryKey: queryKeys.dailyRecord.byDate(date),
      });

      const previousRecord = queryClient.getQueryData<DailyRecord>(getDailyRecordQueryKey(date));

      if (previousRecord) {
        setDailyRecordQueryData(
          queryClient,
          date,
          applyOptimisticDailyRecordPatch(previousRecord, partial)
        );
      }

      return { previousRecord };
    },
    onError: (err, partial, context) => {
      if (context?.previousRecord) {
        setDailyRecordQueryData(queryClient, date, context.previousRecord);
      }
    },
    // Note: We don't invalidate queries here because the Firestore subscription
    // will automatically update the cache when the write completes.
    // Forcing invalidation here can cause "echo" effects where the UI flickers
    // between states as it refetches data that might still be propagating.
    onSettled: () => {
      // No-op - let Firestore subscription handle sync
    },
  });
};

/**
 * Hook to prefetch a daily record.
 * Useful for prefetching next/previous day's data.
 */
export const usePrefetchDailyRecord = () => {
  const queryClient = useQueryClient();
  const { dailyRecord } = useRepositories();

  return async (date: string) => {
    await queryClient.prefetchQuery({
      queryKey: getDailyRecordQueryKey(date),
      queryFn: createDailyRecordQueryFn(dailyRecord, date),
    });
  };
};

/**
 * Hook to invalidate daily record cache.
 * Call this after external updates.
 */
export const useInvalidateDailyRecord = () => {
  const queryClient = useQueryClient();

  return (date?: string) => {
    invalidateDailyRecordQuery(queryClient, date);
  };
};

/**
 * Hook for initializing a new daily record.
 */
export const useInitializeDailyRecordMutation = () => {
  const queryClient = useQueryClient();
  const { dailyRecord } = useRepositories();

  return useMutation({
    mutationFn: async ({ date, copyFromDate }: { date: string; copyFromDate?: string }) => {
      return await dailyRecord.initializeDay(date, copyFromDate);
    },
    onSuccess: newRecord => {
      setDailyRecordQueryData(queryClient, newRecord.date, newRecord);
      invalidateDailyRecordQuery(queryClient, newRecord.date);
    },
  });
};

/**
 * Hook for deleting a daily record.
 */
export const useDeleteDailyRecordMutation = () => {
  const queryClient = useQueryClient();
  const { dailyRecord } = useRepositories();

  return useMutation({
    mutationFn: async (date: string) => {
      await dailyRecord.deleteDay(date);
      return date;
    },
    onSuccess: date => {
      setDailyRecordQueryData(queryClient, date, null);
      invalidateDailyRecordQuery(queryClient, date);
    },
  });
};
