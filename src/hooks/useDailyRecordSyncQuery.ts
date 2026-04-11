/**
 * useDailyRecordSyncQuery Hook
 * Replaces useDailyRecordSync logic with TanStack Query.
 * Provides the same interface for compatibility.
 */

import { useCallback, useMemo, useEffect, useRef, useState } from 'react';
import {
  useDailyRecordQuery,
  useSaveDailyRecordMutation,
  usePatchDailyRecordMutation,
  useInitializeDailyRecordMutation,
  useDeleteDailyRecordMutation,
} from './useDailyRecordQuery';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../config/queryClient';
import { SyncStatus, UseDailyRecordSyncResult } from '@/context/dailyRecordContextContracts';
import type { DailyRecord, DailyRecordPatch } from '@/application/shared/dailyRecordCoreContracts';
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
import { presentDailyRecordRefreshOutcome } from '@/hooks/controllers/dailyRecordRefreshOutcomeController';
import { dailyRecordSyncLogger } from '@/hooks/hookLoggers';
import { dailyRecordObservability } from '@/services/repositories/dailyRecordOperationalTelemetry';
import { getTodayISO } from '@/utils/dateFormattingUtils';
import { setDailyRecordQueryData } from '@/hooks/controllers/dailyRecordQueryController';
import type { RemoteSyncRuntimeStatus } from '@/services/repositories/repositoryConfig';
import {
  resolveDailyRecordBootstrapPhase,
  shouldAttemptTodayEmptyRecovery,
  type DailyRecordBootstrapPhase,
} from '@/hooks/controllers/dailyRecordBootstrapController';

const REMOTE_HYDRATION_IDLE_TIMEOUT_MS = 1_200;
const REMOTE_HYDRATION_FALLBACK_DELAY_MS = 150;
let syncDailyRecordUseCasePromise: Promise<
  typeof import('@/application/daily-record/syncDailyRecordUseCase')
> | null = null;

const loadSyncDailyRecordUseCase = async () => {
  syncDailyRecordUseCasePromise ??= import('@/application/daily-record/syncDailyRecordUseCase');
  return syncDailyRecordUseCasePromise;
};

type BrowserWindowWithIdleCallback = Window & {
  requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
  cancelIdleCallback?: (handle: number) => void;
};

export const useDailyRecordSyncQuery = (
  currentDateString: string,
  _isOfflineMode: boolean = false, // Handled implicitly by TanStack Query & Repository
  remoteSyncStatus: RemoteSyncRuntimeStatus = 'local_only'
): UseDailyRecordSyncResult => {
  const queryClient = useQueryClient();
  const { dailyRecord } = useRepositories();
  const { checkVersion } = useVersion();
  const [remoteHydrationReadyDate, setRemoteHydrationReadyDate] = useState<string | null>(null);
  const readySignature = remoteSyncStatus === 'ready' ? currentDateString : null;
  const shouldDeferRemoteHydration =
    readySignature !== null && remoteHydrationReadyDate !== currentDateString;
  const effectiveRemoteSyncStatus = shouldDeferRemoteHydration ? 'local_only' : remoteSyncStatus;

  useEffect(() => {
    if (readySignature === null) {
      return;
    }

    let timeoutId: number | null = null;
    let idleCallbackId: number | null = null;
    let cancelled = false;

    const enableRemoteHydration = () => {
      if (!cancelled) {
        setRemoteHydrationReadyDate(currentDateString);
      }
    };

    const browserWindow =
      typeof window !== 'undefined' ? (window as BrowserWindowWithIdleCallback) : null;

    if (browserWindow?.requestIdleCallback) {
      idleCallbackId = browserWindow.requestIdleCallback(enableRemoteHydration, {
        timeout: REMOTE_HYDRATION_IDLE_TIMEOUT_MS,
      });
    } else {
      timeoutId = window.setTimeout(enableRemoteHydration, REMOTE_HYDRATION_FALLBACK_DELAY_MS);
    }

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
      if (idleCallbackId !== null && browserWindow?.cancelIdleCallback) {
        browserWindow.cancelIdleCallback(idleCallbackId);
      }
    };
  }, [currentDateString, readySignature]);

  // 1. Fetching
  const {
    data: record,
    runtime: recordRuntime,
    dataUpdatedAt,
    refetch,
  } = useDailyRecordQuery(currentDateString, _isOfflineMode, effectiveRemoteSyncStatus);

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
  const todayNullRecoveryAttemptedRef = useRef<string | null>(null);
  const isMountedRef = useRef(true);
  const refreshRequestIdRef = useRef(0);

  const clearPendingRefetchTimeout = useCallback(() => {
    if (pendingRefetchTimeoutRef.current !== null) {
      clearTimeout(pendingRefetchTimeoutRef.current);
      pendingRefetchTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      clearPendingRefetchTimeout();
    };
  }, [clearPendingRefetchTimeout]);

  const bootstrapPhase = useMemo(
    (): DailyRecordBootstrapPhase =>
      resolveDailyRecordBootstrapPhase({
        remoteSyncStatus: effectiveRemoteSyncStatus,
        record,
        runtime: recordRuntime,
        gracePeriodExpired: recordRuntime?.availabilityState === 'temporarily_unavailable',
      }),
    [effectiveRemoteSyncStatus, record, recordRuntime]
  );

  const runRemoteSync = useCallback(
    async (date: string) => {
      const { executeSyncDailyRecord } = await loadSyncDailyRecordUseCase();
      return executeSyncDailyRecord({
        date,
        repository: dailyRecord,
      });
    },
    [dailyRecord]
  );

  useEffect(() => {
    if (record) {
      if (todayNullRecoveryAttemptedRef.current === currentDateString) {
        todayNullRecoveryAttemptedRef.current = null;
      }
      return;
    }

    const todayDateString = getTodayISO();

    if (
      !shouldAttemptTodayEmptyRecovery({
        currentDateString,
        todayDateString,
        bootstrapPhase,
      })
    ) {
      return;
    }

    if (todayNullRecoveryAttemptedRef.current === currentDateString) {
      return;
    }

    todayNullRecoveryAttemptedRef.current = currentDateString;

    let cancelled = false;

    void runRemoteSync(currentDateString).then(outcome => {
      if (cancelled || !isMountedRef.current) {
        return;
      }

      dailyRecordObservability.recordOutcome('recover_today_empty_daily_record', outcome, {
        date: currentDateString,
        context: {
          source: 'useDailyRecordSyncQuery',
        },
      });
      void refetch();
    });

    return () => {
      cancelled = true;
    };
  }, [bootstrapPhase, currentDateString, record, refetch, runRemoteSync]);

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
      setDailyRecordQueryData(queryClient, currentDateString, updater);
      queryClient.invalidateQueries({ queryKey: key });
    },
    [queryClient, currentDateString]
  );

  const markLocalChange = useCallback(() => {
    // TanStack Query handles local changes via optimistic updates in mutations.
    // For ad-hoc changes not through mutations, we can manual update cache if needed.
  }, []);

  const refresh = useCallback(() => {
    const requestId = ++refreshRequestIdRef.current;

    void runRemoteSync(currentDateString).then(outcome => {
      if (!isMountedRef.current || requestId !== refreshRequestIdRef.current) {
        return;
      }

      dailyRecordObservability.recordOutcome('refresh_daily_record', outcome, {
        date: currentDateString,
      });
      const notice = presentDailyRecordRefreshOutcome(outcome);
      if (notice.channel === 'warning') {
        warning(notice.title || 'Sincronización', notice.message);
      } else if (notice.channel === 'error') {
        notifyError(notice.title || 'Sincronización', notice.message);
      }
      void refetch();
    });
  }, [currentDateString, notifyError, refetch, runRemoteSync, warning]);

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
    bootstrapPhase,
    saveAndUpdate,
    patchRecord,
    markLocalChange,
    refresh,
    createDay,
    resetDay,
  };
};
