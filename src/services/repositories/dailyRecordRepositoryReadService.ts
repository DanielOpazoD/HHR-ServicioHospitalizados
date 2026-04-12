import { DailyRecord } from '@/types/domain/dailyRecord';
import {
  getRecordForDate as getRecordFromIndexedDB,
  getPreviousDayRecord as getPreviousDayFromIndexedDB,
  getAllDates as getAllDatesFromIndexedDB,
} from '@/services/storage/indexeddb/indexedDbRecordService';
import { logLegacyInfo } from '@/services/storage/legacyfirebase/legacyFirebaseLogger';
import { isFirestoreEnabled } from '@/services/repositories/repositoryConfig';
import { migrateLegacyDataWithReport } from '@/services/repositories/dataMigration';
import { bridgeLegacyRecord } from '@/services/repositories/legacyRecordBridgeService';
import { persistHydratedRecordToLocalCache } from '@/services/repositories/dailyRecordLocalCachePersistence';
import {
  createDailyRecordReadResult,
  DailyRecordReadResult,
  createGetDailyRecordQuery,
  createGetPreviousDayQuery,
} from '@/services/repositories/contracts/dailyRecordQueries';
import { mergeAvailableDates } from '@/services/repositories/dailyRecordSyncCompatibility';
import { measureRepositoryOperation } from '@/services/repositories/repositoryPerformance';
import { dailyRecordReadLogger } from '@/services/repositories/repositoryLoggers';
import { resolveDailyRecordReadConsistency } from '@/services/repositories/dailyRecordConsistencyPolicy';
import { resolveDailyRecordPersistenceGoldenPath } from '@/services/repositories/dailyRecordPersistenceGoldenPath';
import { AdmissionDatePolicyViolationError } from '@/application/patient-flow/admissionDatePolicy';
import type { DailyRecordRemoteLoadResult } from '@/services/repositories/dailyRecordRemoteLoader';

type FirestoreRecordQueriesModule =
  typeof import('@/services/storage/firestore/firestoreRecordQueries');
type DailyRecordRemoteLoaderModule =
  typeof import('@/services/repositories/dailyRecordRemoteLoader');

let firestoreRecordQueriesPromise: Promise<FirestoreRecordQueriesModule> | null = null;
let dailyRecordRemoteLoaderPromise: Promise<DailyRecordRemoteLoaderModule> | null = null;

const loadFirestoreRecordQueries = async (): Promise<FirestoreRecordQueriesModule> => {
  firestoreRecordQueriesPromise ??= import('@/services/storage/firestore/firestoreRecordQueries');
  return firestoreRecordQueriesPromise;
};

const loadDailyRecordRemoteLoader = async (): Promise<DailyRecordRemoteLoaderModule> => {
  dailyRecordRemoteLoaderPromise ??= import('@/services/repositories/dailyRecordRemoteLoader');
  return dailyRecordRemoteLoaderPromise;
};

const isRepositoryDebugEnabled = () =>
  import.meta.env.DEV &&
  String(import.meta.env.VITE_DEBUG_REPOSITORY || '').toLowerCase() === 'true';

interface LocalRuntimeReadCandidate {
  record: DailyRecord;
  compatibilityIntensity: DailyRecordReadResult['compatibilityIntensity'];
  migrationRulesApplied: DailyRecordReadResult['migrationRulesApplied'];
  repairApplied: boolean;
}

const createLocalRuntimeReadCandidate = (
  date: string,
  record: DailyRecord
): LocalRuntimeReadCandidate => {
  const migrated = migrateLegacyDataWithReport(record, date);
  return {
    record: migrated.record,
    compatibilityIntensity: migrated.compatibilityIntensity,
    migrationRulesApplied: migrated.appliedRules,
    repairApplied: migrated.compatibilityIntensity !== 'none' || migrated.appliedRules.length > 0,
  };
};

const getE2EOverrideRecord = (date: string): DailyRecord | null => {
  if (typeof window === 'undefined' || !window.__HHR_E2E_OVERRIDE__) {
    return null;
  }

  return window.__HHR_E2E_OVERRIDE__[date] || null;
};

const logRemoteFetchAttempt = (date: string): void => {
  if (!isRepositoryDebugEnabled()) return;
  logLegacyInfo(`[Repository DEBUG] Attempting Firestore fetch for ${date}`);
  logLegacyInfo(`[Repository] Checking remote + legacy fallback for ${date}...`);
};

const createLocalRuntimeReadResult = (
  date: string,
  candidate: LocalRuntimeReadCandidate,
  source: 'e2e' | 'indexeddb',
  options: Partial<
    Pick<
      DailyRecordReadResult,
      | 'consistencyState'
      | 'sourceOfTruth'
      | 'retryability'
      | 'recoveryAction'
      | 'conflictSummary'
      | 'observabilityTags'
      | 'userSafeMessage'
      | 'repairApplied'
    >
  > = {}
): DailyRecordReadResult => {
  const consistency = resolveDailyRecordReadConsistency({
    localRecord: candidate.record,
    remoteRecord: null,
    selectedRecord: candidate.record,
    remoteAvailability: 'not_requested',
    repairApplied: candidate.repairApplied,
  });
  return createDailyRecordReadResult(date, candidate.record, source, {
    compatibilityTier: 'local_runtime',
    compatibilityIntensity: candidate.compatibilityIntensity,
    migrationRulesApplied: candidate.migrationRulesApplied,
    consistencyState: options.consistencyState || consistency.consistencyState,
    sourceOfTruth: options.sourceOfTruth || consistency.sourceOfTruth,
    retryability: options.retryability || consistency.retryability,
    recoveryAction: options.recoveryAction || consistency.recoveryAction,
    conflictSummary: options.conflictSummary || consistency.conflictSummary,
    observabilityTags: options.observabilityTags || consistency.observabilityTags,
    userSafeMessage: options.userSafeMessage,
    repairApplied: options.repairApplied ?? consistency.repairApplied,
  });
};

const createReadResultFromGoldenPath = (
  date: string,
  goldenPath: ReturnType<typeof resolveDailyRecordPersistenceGoldenPath>,
  localCandidate: LocalRuntimeReadCandidate | null,
  remoteReadResult?: DailyRecordRemoteLoadResult
): DailyRecordReadResult => {
  if (goldenPath.selectedStore === 'remote' && remoteReadResult?.record) {
    return createDailyRecordReadResult(date, remoteReadResult.record, remoteReadResult.source, {
      compatibilityTier: remoteReadResult.compatibilityTier,
      compatibilityIntensity: remoteReadResult.compatibilityIntensity,
      migrationRulesApplied: remoteReadResult.migrationRulesApplied,
      consistencyState: goldenPath.consistencyState,
      sourceOfTruth: goldenPath.sourceOfTruth,
      retryability: goldenPath.retryability,
      recoveryAction: goldenPath.recoveryAction,
      conflictSummary: goldenPath.conflictSummary,
      observabilityTags: goldenPath.observabilityTags,
      userSafeMessage: goldenPath.userSafeMessage,
      repairApplied: goldenPath.repairApplied,
    });
  }

  if (goldenPath.selectedStore === 'local' && localCandidate) {
    return createLocalRuntimeReadResult(date, localCandidate, 'indexeddb', {
      consistencyState: goldenPath.consistencyState,
      sourceOfTruth: goldenPath.sourceOfTruth,
      retryability: goldenPath.retryability,
      recoveryAction: goldenPath.recoveryAction,
      conflictSummary: goldenPath.conflictSummary,
      observabilityTags: goldenPath.observabilityTags,
      userSafeMessage: goldenPath.userSafeMessage,
      repairApplied: goldenPath.repairApplied,
    });
  }

  return createDailyRecordReadResult(date, null, 'not_found', {
    consistencyState: goldenPath.consistencyState,
    sourceOfTruth: goldenPath.sourceOfTruth,
    retryability: goldenPath.retryability,
    recoveryAction: goldenPath.recoveryAction,
    conflictSummary: goldenPath.conflictSummary,
    observabilityTags: goldenPath.observabilityTags,
    userSafeMessage: goldenPath.userSafeMessage,
    repairApplied: goldenPath.repairApplied,
  });
};

export const getForDate = async (
  date: string,
  syncFromRemote: boolean = true
): Promise<DailyRecord | null> => {
  const result = await getForDateWithMeta(date, syncFromRemote);
  return result.record;
};

export const getForDateWithMeta = async (
  date: string,
  syncFromRemote: boolean = true
): Promise<DailyRecordReadResult> => {
  return measureRepositoryOperation(
    'dailyRecord.getForDate',
    async () => {
      const query = createGetDailyRecordQuery(date, syncFromRemote);
      const e2eOverride = getE2EOverrideRecord(query.date);
      if (e2eOverride) {
        dailyRecordReadLogger.warn(`Using E2E override record for ${query.date}`);
        return createLocalRuntimeReadResult(
          query.date,
          createLocalRuntimeReadCandidate(query.date, e2eOverride),
          'e2e'
        );
      }

      const localRecord = await getRecordFromIndexedDB(query.date);
      const localCandidate = localRecord
        ? createLocalRuntimeReadCandidate(query.date, localRecord)
        : null;
      if (query.syncFromRemote && isFirestoreEnabled()) {
        try {
          const remoteReadResult = await measureRepositoryOperation(
            'dailyRecord.getForDate.remote',
            async () => {
              logRemoteFetchAttempt(query.date);
              const { loadRemoteRecordWithFallback } = await loadDailyRecordRemoteLoader();
              return loadRemoteRecordWithFallback(query.date);
            },
            { thresholdMs: 250, context: date }
          );
          const goldenPath = resolveDailyRecordPersistenceGoldenPath({
            localRecord: localCandidate?.record || null,
            remoteRecord: remoteReadResult.record,
            remoteAvailability: remoteReadResult.record ? 'resolved' : 'missing',
            localRepairApplied: localCandidate?.repairApplied || false,
            remoteRepairApplied:
              remoteReadResult.compatibilityIntensity !== 'none' ||
              remoteReadResult.migrationRulesApplied.length > 0,
          });

          if (goldenPath.shouldHydrateLocal && remoteReadResult.record) {
            try {
              await persistHydratedRecordToLocalCache(
                remoteReadResult.record,
                query.date,
                localCandidate?.record || null
              );
            } catch (error) {
              if (error instanceof AdmissionDatePolicyViolationError) {
                dailyRecordReadLogger.warn(
                  `Skipped local hydration for ${query.date} due to admissionDate validation`,
                  error
                );
              } else {
                throw error;
              }
            }
          }

          if (goldenPath.selectedStore === 'remote' && remoteReadResult.record) {
            return createReadResultFromGoldenPath(
              query.date,
              goldenPath,
              localCandidate,
              remoteReadResult
            );
          }

          return createReadResultFromGoldenPath(query.date, goldenPath, localCandidate);
        } catch (err) {
          dailyRecordReadLogger.warn(`Remote fetch failed for ${query.date}`, err);
        }

        const fallbackGoldenPath = resolveDailyRecordPersistenceGoldenPath({
          localRecord: localCandidate?.record || null,
          remoteRecord: null,
          remoteAvailability: 'unavailable',
          localRepairApplied: localCandidate?.repairApplied || false,
        });

        return createReadResultFromGoldenPath(query.date, fallbackGoldenPath, localCandidate);
      }

      if (localCandidate) {
        return createLocalRuntimeReadResult(query.date, localCandidate, 'indexeddb');
      }

      return createDailyRecordReadResult(query.date, null, 'not_found', {
        ...resolveDailyRecordReadConsistency({
          localRecord: null,
          remoteRecord: null,
          selectedRecord: null,
          remoteAvailability: 'not_requested',
        }),
      });
    },
    { thresholdMs: 120, context: date }
  );
};

export const bridgeLegacyRecordForDate = async (date: string): Promise<DailyRecordReadResult> => {
  const bridged = await bridgeLegacyRecord(date);
  const consistency = resolveDailyRecordReadConsistency({
    localRecord: bridged.record,
    remoteRecord: null,
    selectedRecord: bridged.record,
    remoteAvailability: 'not_requested',
    repairApplied:
      bridged.compatibilityIntensity !== 'none' || bridged.migrationRulesApplied.length > 0,
  });
  return createDailyRecordReadResult(date, bridged.record, bridged.source, {
    compatibilityTier: bridged.compatibilityTier,
    compatibilityIntensity: bridged.compatibilityIntensity,
    migrationRulesApplied: bridged.migrationRulesApplied,
    consistencyState: consistency.consistencyState,
    sourceOfTruth: consistency.sourceOfTruth,
    retryability: consistency.retryability,
    recoveryAction: consistency.recoveryAction,
    conflictSummary: consistency.conflictSummary,
    observabilityTags: consistency.observabilityTags,
    userSafeMessage: consistency.userSafeMessage,
    repairApplied: consistency.repairApplied,
  });
};

export const getAvailableDates = async (): Promise<string[]> => {
  const localDates = await getAllDatesFromIndexedDB();

  if (isFirestoreEnabled()) {
    try {
      const { getAvailableDatesFromFirestore } = await loadFirestoreRecordQueries();
      const remoteDates = await getAvailableDatesFromFirestore();
      return mergeAvailableDates(localDates, remoteDates);
    } catch (err) {
      dailyRecordReadLogger.warn('Failed to fetch remote dates', err);
    }
  }

  return localDates.sort().reverse();
};

export const getMonthRecords = async (
  year: number,
  monthZeroBased: number
): Promise<DailyRecord[]> => {
  if (!isFirestoreEnabled()) {
    return [];
  }

  const { getMonthRecordsFromFirestore } = await loadFirestoreRecordQueries();
  return getMonthRecordsFromFirestore(year, monthZeroBased);
};

export const getPreviousDay = async (date: string): Promise<DailyRecord | null> => {
  const result = await getPreviousDayWithMeta(date);
  return result.record;
};

export const getPreviousDayWithMeta = async (date: string): Promise<DailyRecordReadResult> => {
  const query = createGetPreviousDayQuery(date);

  const localRecord = await getPreviousDayFromIndexedDB(query.date);
  if (localRecord) {
    return createLocalRuntimeReadResult(
      localRecord.date,
      createLocalRuntimeReadCandidate(localRecord.date, localRecord),
      'indexeddb'
    );
  }

  if (isFirestoreEnabled()) {
    try {
      const allDates = await getAvailableDates();
      const prevDate = allDates.find(d => d < query.date);

      if (prevDate) {
        return await getForDateWithMeta(prevDate);
      }
    } catch (err) {
      dailyRecordReadLogger.warn(`Remote previous-day lookup failed for ${query.date}`, err);
    }
  }

  return createDailyRecordReadResult(query.date, null, 'not_found', {
    ...resolveDailyRecordReadConsistency({
      localRecord: null,
      remoteRecord: null,
      selectedRecord: null,
      remoteAvailability: 'missing',
    }),
  });
};
