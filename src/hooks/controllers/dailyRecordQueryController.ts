import type { QueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/config/queryClient';
import type { DailyRecord, DailyRecordPatch } from '@/hooks/contracts/dailyRecordHookContracts';
import { applyPatches } from '@/utils/patchUtils';
import {
  createDailyRecordQueryResult,
  createGetDailyRecordQuery,
  type DailyRecordQueryResult,
  type DailyRecordQueryRuntime,
  type DailyRecordReadResult,
} from '@/services/repositories/contracts/dailyRecordQueries';
import { dailyRecordObservability } from '@/services/repositories/dailyRecordOperationalTelemetry';
import type { SyncDailyRecordResult } from '@/services/repositories/contracts/dailyRecordResults';

interface DailyRecordReader {
  getForDate: (date: string) => Promise<DailyRecord | null>;
  getForDateWithMeta?: (date: string, syncFromRemote?: boolean) => Promise<DailyRecordReadResult>;
  subscribe?: (
    date: string,
    callback: (record: DailyRecord | null, hasPendingWrites: boolean) => void
  ) => () => void;
  subscribeDetailed?: (
    date: string,
    callback: (result: SyncDailyRecordResult, hasPendingWrites: boolean) => void
  ) => () => void;
}

export const getDailyRecordQueryKey = (date: string) => queryKeys.dailyRecord.byDate(date);

const createDefaultRuntime = (
  date: string,
  record: DailyRecord | null
): DailyRecordQueryRuntime => ({
  date,
  availabilityState: record ? 'resolved' : 'confirmed_missing',
  consistencyState: record ? 'local_only' : 'missing',
  sourceOfTruth: record ? 'local' : 'none',
  retryability: 'not_applicable',
  recoveryAction: 'none',
  conflictSummary: null,
  observabilityTags: ['daily_record', 'read'],
  repairApplied: false,
});

const createQueryResultFromRecord = (
  date: string,
  record: DailyRecord | null,
  runtime: DailyRecordQueryRuntime = createDefaultRuntime(date, record)
): DailyRecordQueryResult => createDailyRecordQueryResult(record, runtime);

const createRuntimeFromReadResult = (result: DailyRecordReadResult): DailyRecordQueryRuntime => ({
  date: result.date,
  availabilityState: result.record
    ? result.retryability !== 'not_applicable' || result.sourceOfTruth === 'local'
      ? 'recoverable_local'
      : 'resolved'
    : result.consistencyState === 'unavailable'
      ? 'temporarily_unavailable'
      : 'confirmed_missing',
  consistencyState: result.consistencyState,
  sourceOfTruth: result.sourceOfTruth,
  retryability: result.retryability,
  recoveryAction: result.recoveryAction,
  conflictSummary: result.conflictSummary,
  observabilityTags: result.observabilityTags,
  userSafeMessage: result.userSafeMessage,
  repairApplied: result.repairApplied,
});

const createRuntimeFromSyncResult = (
  date: string,
  result: SyncDailyRecordResult
): DailyRecordQueryRuntime => ({
  date,
  availabilityState: result.record
    ? result.consistencyState === 'local_kept' || result.consistencyState === 'blocked'
      ? 'recoverable_local'
      : 'resolved'
    : result.consistencyState === 'blocked'
      ? 'temporarily_unavailable'
      : 'confirmed_missing',
  consistencyState: result.consistencyState,
  sourceOfTruth: result.sourceOfTruth,
  retryability: result.retryability,
  recoveryAction: result.recoveryAction,
  conflictSummary: result.conflictSummary,
  observabilityTags: result.observabilityTags,
  userSafeMessage: result.userSafeMessage,
  repairApplied: result.repairApplied,
});

export const createDailyRecordQueryFn =
  (dailyRecord: DailyRecordReader, date: string) => async (): Promise<DailyRecordQueryResult> => {
    const query = createGetDailyRecordQuery(date);
    if (typeof dailyRecord.getForDateWithMeta === 'function') {
      const result = await dailyRecord.getForDateWithMeta(query.date, query.syncFromRemote);
      return createDailyRecordQueryResult(result.record, createRuntimeFromReadResult(result));
    }

    const record = await dailyRecord.getForDate(query.date);
    return createQueryResultFromRecord(query.date, record);
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
    if (!dailyRecord.subscribeDetailed) {
      return null;
    }
  }

  const applyResolvedQueryResult = (result: DailyRecordQueryResult) => {
    queryClient.setQueryData(getDailyRecordQueryKey(date), result);
  };

  const reconcileNullRealtimeRecord = (previousResult: DailyRecordQueryResult) => {
    const read =
      typeof dailyRecord.getForDateWithMeta === 'function'
        ? dailyRecord.getForDateWithMeta(date)
        : dailyRecord.getForDate(date).then<DailyRecordReadResult>(record => ({
            date,
            record,
            consistencyState: record ? 'local_only' : 'missing',
            sourceOfTruth: record ? 'local' : 'none',
            retryability: 'not_applicable',
            recoveryAction: 'none',
            conflictSummary: null,
            observabilityTags: ['daily_record', 'read'],
            repairApplied: false,
            compatibilityTier: 'none',
            compatibilityIntensity: 'none',
            migrationRulesApplied: [],
            source: record ? 'indexeddb' : 'not_found',
          }));

    void read
      .then(reconciledResult => {
        const recovered = createDailyRecordQueryResult(
          reconciledResult.record,
          createRuntimeFromReadResult(reconciledResult)
        );
        if (recovered.record) {
          dailyRecordObservability.recordEvent('recovered_null_realtime_record', 'degraded', {
            date,
            runtimeState: 'recoverable',
            issues: [
              'Se evitó un vaciado transitorio del registro después de una suscripción realtime nula.',
            ],
            context: {
              previousLastUpdated: previousResult.record?.lastUpdated,
              recoveredLastUpdated: recovered.record.lastUpdated,
              consistencyState: recovered.runtime.consistencyState,
              availabilityState: recovered.runtime.availabilityState,
            },
          });
          applyResolvedQueryResult(recovered);
          return;
        }

        dailyRecordObservability.recordEvent('confirmed_null_realtime_record', 'degraded', {
          date,
          runtimeState:
            recovered.runtime.availabilityState === 'temporarily_unavailable'
              ? 'blocked'
              : 'retryable',
          issues: [
            'La suscripción realtime emitió null y el repositorio confirmó ausencia o indisponibilidad del registro.',
          ],
          context: {
            previousLastUpdated: previousResult.record?.lastUpdated,
            consistencyState: recovered.runtime.consistencyState,
            availabilityState: recovered.runtime.availabilityState,
          },
        });
        applyResolvedQueryResult(recovered);
      })
      .catch(error => {
        dailyRecordObservability.recordError(
          'reconcile_null_realtime_record',
          error,
          {
            code: 'daily_record_realtime_null_reconciliation_failed',
            message: 'No fue posible reconciliar un registro nulo emitido por realtime.',
            severity: 'warning',
            userSafeMessage: 'Se mantuvo la copia local mientras se revalida el registro del día.',
          },
          {
            date,
            context: {
              previousLastUpdated: previousResult.record?.lastUpdated,
            },
          }
        );
        applyResolvedQueryResult(previousResult);
      });
  };

  const handleResolvedRealtimeResult = (
    result: DailyRecordQueryResult,
    hasPendingWrites: boolean
  ) => {
    if (hasPendingWrites) {
      return;
    }

    if (result.record) {
      applyResolvedQueryResult(result);
      return;
    }

    const previousResult =
      queryClient.getQueryData<DailyRecordQueryResult>(getDailyRecordQueryKey(date)) ||
      createQueryResultFromRecord(date, null, result.runtime);
    if (!previousResult.record) {
      applyResolvedQueryResult(result);
      return;
    }

    reconcileNullRealtimeRecord(previousResult);
  };

  if (typeof dailyRecord.subscribeDetailed === 'function') {
    return dailyRecord.subscribeDetailed(date, (result, hasPendingWrites) => {
      handleResolvedRealtimeResult(
        createDailyRecordQueryResult(result.record, createRuntimeFromSyncResult(date, result)),
        hasPendingWrites
      );
    });
  }

  return dailyRecord.subscribe!(date, (record, hasPendingWrites) => {
    if (hasPendingWrites) {
      return;
    }
    const result = createQueryResultFromRecord(date, record);
    const previousResult =
      queryClient.getQueryData<DailyRecordQueryResult>(getDailyRecordQueryKey(date)) ||
      createQueryResultFromRecord(date, null);
    if (record || !previousResult.record) {
      applyResolvedQueryResult(result);
      return;
    }

    reconcileNullRealtimeRecord(previousResult);
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
  queryClient.setQueryData<DailyRecordQueryResult>(getDailyRecordQueryKey(date), previous => {
    const previousResult = previous || createQueryResultFromRecord(date, null);
    const nextRecord = typeof updater === 'function' ? updater(previousResult.record) : updater;
    return createQueryResultFromRecord(
      date,
      nextRecord,
      nextRecord
        ? createDefaultRuntime(date, nextRecord)
        : previousResult.runtime.availabilityState === 'temporarily_unavailable'
          ? previousResult.runtime
          : createDefaultRuntime(date, null)
    );
  });
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
