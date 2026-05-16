import type { QueryClient } from '@tanstack/react-query';
import type { DailyRecord, DailyRecordPatch } from '@/application/shared/dailyRecordCoreContracts';
import type { DailyRecordRepositoryPort } from '@/application/ports/dailyRecordPort';
import {
  createDailyRecordQueryFn,
  getDailyRecordQueryKey,
} from '@/hooks/controllers/dailyRecordQueryController';
import {
  DailyRecordFreshnessGateError,
  didDailyRecordFreshnessHydrateNewerRemote,
  ensureDailyRecordRemoteFreshness,
} from '@/hooks/controllers/dailyRecordFreshnessGateController';
import { PENDING_DAILY_RECORD_PATCH_TTL_MS } from '@/hooks/controllers/dailyRecordPendingPatchController';
import type {
  SaveDailyRecordResult,
  UpdatePartialDailyRecordResult,
} from '@/services/repositories/contracts/dailyRecordResults';
import type { DailyRecordQueryResult } from '@/services/repositories/contracts/dailyRecordQueries';
import { toRecordTimestamp } from '@/services/repositories/dailyRecordConsistencyPolicy';

type FreshnessReason = 'resume' | 'clinical_patch' | 'clinical_save';

interface FreshnessDependencies {
  dailyRecord: DailyRecordRepositoryPort;
  queryClient: QueryClient;
}

export const saveDailyRecordWithCompatibility = async (
  dailyRecord: DailyRecordRepositoryPort,
  record: DailyRecord
): Promise<SaveDailyRecordResult | null> => {
  if (typeof dailyRecord.saveDetailed === 'function') {
    return dailyRecord.saveDetailed(record, record.lastUpdated);
  }

  await dailyRecord.save(record, record.lastUpdated);
  return null;
};

export const patchDailyRecordWithCompatibility = async (
  dailyRecord: DailyRecordRepositoryPort,
  date: string,
  partial: DailyRecordPatch
): Promise<UpdatePartialDailyRecordResult | null> => {
  if (typeof dailyRecord.updatePartialDetailed === 'function') {
    return dailyRecord.updatePartialDetailed(date, partial);
  }

  await dailyRecord.updatePartial(date, partial);
  return null;
};

export const releasePendingPatchAfterFallbackTtl = (release: () => void): void => {
  const timer = globalThis.setTimeout(release, PENDING_DAILY_RECORD_PATCH_TTL_MS);
  (timer as { unref?: () => void }).unref?.();
};

export const ensureFreshDailyRecordQuery = (
  date: string,
  { dailyRecord, queryClient }: FreshnessDependencies,
  reason: FreshnessReason
) =>
  ensureDailyRecordRemoteFreshness({
    date,
    queryClient,
    queryFn: createDailyRecordQueryFn(dailyRecord, date, true),
    reason,
  });

const assertClinicalMutationDidNotStartFromStaleRemoteHydration = (
  freshness: DailyRecordQueryResult
): void => {
  if (!didDailyRecordFreshnessHydrateNewerRemote(freshness)) {
    return;
  }

  throw new DailyRecordFreshnessGateError(
    'El censo remoto se actualizó al reactivar la pestaña. Revise los datos antes de editar.'
  );
};

export const ensureFreshClinicalPatchMutation = (
  date: string,
  dependencies: FreshnessDependencies
) =>
  ensureFreshDailyRecordQuery(date, dependencies, 'clinical_patch').then(freshness => {
    assertClinicalMutationDidNotStartFromStaleRemoteHydration(freshness);
    return freshness;
  });

export const ensureFreshClinicalSaveMutation = async (
  record: DailyRecord,
  dependencies: FreshnessDependencies
): Promise<DailyRecordQueryResult> => {
  const freshness = await ensureFreshDailyRecordQuery(record.date, dependencies, 'clinical_save');
  assertClinicalMutationDidNotStartFromStaleRemoteHydration(freshness);
  if (
    freshness.record &&
    toRecordTimestamp(freshness.record.lastUpdated) > toRecordTimestamp(record.lastUpdated)
  ) {
    throw new DailyRecordFreshnessGateError(
      'El censo remoto se actualizó al reactivar la pestaña. Revise los datos antes de guardar.'
    );
  }
  return freshness;
};

export const prefetchDailyRecordQuery = (
  queryClient: QueryClient,
  dailyRecord: DailyRecordRepositoryPort,
  date: string
) =>
  queryClient.prefetchQuery({
    queryKey: getDailyRecordQueryKey(date),
    queryFn: createDailyRecordQueryFn(dailyRecord, date),
  });
