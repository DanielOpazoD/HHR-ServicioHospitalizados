/**
 * useDailyRecordSyncQuery Hook
 * Replaces useDailyRecordSync logic with TanStack Query.
 * Provides the same interface for compatibility.
 */

import { useCallback, useMemo, useEffect, useRef } from 'react';
import {
  useDailyRecordQuery,
  useSaveDailyRecordMutation,
  usePatchDailyRecordMutation,
  useInitializeDailyRecordMutation,
  useDeleteDailyRecordMutation,
} from './useDailyRecordQuery';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../config/queryClient';
import { SyncStatus, UseDailyRecordSyncResult, DailyRecordPatch } from './useDailyRecordTypes';
import { DailyRecord } from '@/types/domain/dailyRecord';
import { useRepositories } from '@/services/RepositoryContext';
import { useNotification } from '@/context/UIContext';
import { useVersion } from '@/context/VersionContext';
import {
  resolvePatchOutcomeFeedback,
  resolveSaveErrorFeedback,
  resolveSaveOutcomeFeedback,
} from '@/hooks/controllers/dailyRecordSyncNotificationController';
import {
  buildCreateDaySuccessMessage,
  resolveCreateDaySourceDate,
  resolveMutationSyncStatus,
} from '@/hooks/controllers/dailyRecordSyncController';
import { executeSyncDailyRecord } from '@/application/daily-record/syncDailyRecordUseCase';
import { presentDailyRecordRefreshOutcome } from '@/hooks/controllers/dailyRecordRefreshOutcomeController';
import { recordOperationalOutcome } from '@/services/observability/operationalTelemetryService';
import { logger } from '@/services/utils/loggerService';

const dailyRecordSyncLogger = logger.child('DailyRecordSync');

export const useDailyRecordSyncQuery = (
  currentDateString: string,
  _isOfflineMode: boolean = false, // Handled implicitly by TanStack Query & Repository
  _isFirebaseConnected: boolean = false
): UseDailyRecordSyncResult => {
  const queryClient = useQueryClient();
  const { dailyRecord } = useRepositories();
  const { checkVersion } = useVersion();

  // 1. Fetching
  const {
    data: record,
    dataUpdatedAt,
    refetch,
  } = useDailyRecordQuery(currentDateString, _isOfflineMode, _isFirebaseConnected);

  // Monitor version in incoming records
  useEffect(() => {
    if (record?.schemaVersion) {
      checkVersion(record.schemaVersion);
    }
  }, [record, checkVersion]);

  // 2. Mutations
  const saveMutation = useSaveDailyRecordMutation();
  const patchMutation = usePatchDailyRecordMutation(currentDateString);
  const initMutation = useInitializeDailyRecordMutation();
  const deleteMutation = useDeleteDailyRecordMutation();
  const pendingRefetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPendingRefetchTimeout = useCallback(() => {
    if (pendingRefetchTimeoutRef.current !== null) {
      clearTimeout(pendingRefetchTimeoutRef.current);
      pendingRefetchTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => clearPendingRefetchTimeout, [clearPendingRefetchTimeout]);

  // 3. Status Mapping
  const syncStatus = useMemo(
    (): SyncStatus =>
      resolveMutationSyncStatus([
        {
          isPending: saveMutation.isPending,
          isError: saveMutation.isError,
          isSuccess: saveMutation.isSuccess,
        },
        {
          isPending: patchMutation.isPending,
          isError: patchMutation.isError,
          isSuccess: patchMutation.isSuccess,
        },
        {
          isPending: initMutation.isPending,
          isError: initMutation.isError,
          isSuccess: initMutation.isSuccess,
        },
        {
          isPending: deleteMutation.isPending,
          isError: deleteMutation.isError,
          isSuccess: deleteMutation.isSuccess,
        },
      ]),
    [
      deleteMutation.isError,
      deleteMutation.isPending,
      deleteMutation.isSuccess,
      initMutation.isError,
      initMutation.isPending,
      initMutation.isSuccess,
      patchMutation.isError,
      patchMutation.isPending,
      patchMutation.isSuccess,
      saveMutation.isError,
      saveMutation.isPending,
      saveMutation.isSuccess,
    ]
  );

  const lastSyncTime = useMemo(
    () => (dataUpdatedAt ? new Date(dataUpdatedAt) : null),
    [dataUpdatedAt]
  );

  const { error: notifyError, success, warning } = useNotification();

  // 4. Compatibility handlers
  const saveAndUpdate = useCallback(
    async (updatedRecord: DailyRecord) => {
      try {
        const payload = await saveMutation.mutateAsync(updatedRecord);
        const feedback = resolveSaveOutcomeFeedback(payload.result);
        if (feedback) {
          if (feedback.channel === 'error') {
            notifyError(feedback.title, feedback.message);
          } else {
            warning(feedback.title, feedback.message);
          }
        }
      } catch (err) {
        const feedback = resolveSaveErrorFeedback(err);
        if (feedback) {
          notifyError(feedback.title, feedback.message);

          if (feedback.shouldLog) {
            dailyRecordSyncLogger.error(feedback.logLabel || 'Save blocked', err);
          }

          if (feedback.refetchDelayMs) {
            clearPendingRefetchTimeout();
            pendingRefetchTimeoutRef.current = setTimeout(() => {
              refetch();
              pendingRefetchTimeoutRef.current = null;
            }, feedback.refetchDelayMs);
          }
        }
        throw err;
      }
    },
    [saveMutation, notifyError, refetch, clearPendingRefetchTimeout, warning]
  );

  const patchRecord = useCallback(
    async (partial: DailyRecordPatch) => {
      const payload = await patchMutation.mutateAsync(partial);
      const feedback = resolvePatchOutcomeFeedback(payload.result);
      if (feedback) {
        if (feedback.channel === 'error') {
          notifyError(feedback.title, feedback.message);
        } else {
          warning(feedback.title, feedback.message);
        }
      }
    },
    [patchMutation, warning, notifyError]
  );

  const setRecord = useCallback(
    (updater: DailyRecord | null | ((prev: DailyRecord | null) => DailyRecord | null)) => {
      const key = queryKeys.dailyRecord.byDate(currentDateString);
      queryClient.setQueryData(key, updater);
      queryClient.invalidateQueries({ queryKey: key });
    },
    [queryClient, currentDateString]
  );

  const markLocalChange = useCallback(() => {
    // TanStack Query handles local changes via optimistic updates in mutations.
    // For ad-hoc changes not through mutations, we can manual update cache if needed.
  }, []);

  const refresh = useCallback(() => {
    void executeSyncDailyRecord({
      date: currentDateString,
      repository: dailyRecord,
    }).then(outcome => {
      recordOperationalOutcome('sync', 'refresh_daily_record', outcome, {
        date: currentDateString,
      });
      const notice = presentDailyRecordRefreshOutcome(outcome);
      if (notice.channel === 'warning') {
        warning(notice.title || 'Sincronización', notice.message);
      } else if (notice.channel === 'error') {
        notifyError(notice.title || 'Sincronización', notice.message);
      }
      refetch();
    });
  }, [currentDateString, dailyRecord, refetch, warning, notifyError]);

  const createDay = useCallback(
    async (copyFromPrevious: boolean, specificDate?: string) => {
      const prevDate = await resolveCreateDaySourceDate(
        dailyRecord,
        currentDateString,
        copyFromPrevious,
        specificDate,
        warning
      );
      if (prevDate === null) {
        return;
      }

      await initMutation.mutateAsync({ date: currentDateString, copyFromDate: prevDate });
      success('Día creado', buildCreateDaySuccessMessage(prevDate || undefined));
    },
    [currentDateString, initMutation, success, warning, dailyRecord]
  );

  const resetDay = useCallback(async () => {
    await deleteMutation.mutateAsync(currentDateString);
    success('Registro eliminado', 'El registro del día ha sido eliminado.');
  }, [currentDateString, deleteMutation, success]);

  return {
    record: record ?? null,
    setRecord,
    syncStatus,
    lastSyncTime,
    saveAndUpdate,
    patchRecord,
    markLocalChange,
    refresh,
    createDay,
    resetDay,
  };
};
