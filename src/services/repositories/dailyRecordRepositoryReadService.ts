import { DailyRecord } from '@/types/core';
import {
  getRecordForDate as getRecordFromIndexedDB,
  getPreviousDayRecord as getPreviousDayFromIndexedDB,
  getAllDates as getAllDatesFromIndexedDB,
  saveRecord as saveToIndexedDB,
} from '@/services/storage/indexeddb/indexedDbRecordService';
import { getAvailableDatesFromFirestore } from '@/services/storage/firestore';
import { logLegacyInfo } from '@/services/storage/legacyfirebase/legacyFirebaseLogger';
import { isFirestoreEnabled } from '@/services/repositories/repositoryConfig';
import { migrateLegacyDataWithReport } from '@/services/repositories/dataMigration';
import { loadRemoteRecordWithFallback } from '@/services/repositories/dailyRecordRemoteLoader';
import { bridgeLegacyRecord } from '@/services/repositories/legacyRecordBridgeService';
import {
  createDailyRecordReadResult,
  DailyRecordReadResult,
  createGetDailyRecordQuery,
  createGetPreviousDayQuery,
} from '@/services/repositories/contracts/dailyRecordQueries';
import { mergeAvailableDates } from '@/services/repositories/dailyRecordSyncCompatibility';
import { measureRepositoryOperation } from '@/services/repositories/repositoryPerformance';
import { logger } from '@/services/utils/loggerService';
import { resolveDailyRecordReadConsistency } from '@/services/repositories/dailyRecordConsistencyPolicy';

const isRepositoryDebugEnabled = () =>
  import.meta.env.DEV &&
  String(import.meta.env.VITE_DEBUG_REPOSITORY || '').toLowerCase() === 'true';

const remoteReadResultInFlight = new Map<string, Promise<DailyRecordReadResult | null>>();
const dailyRecordReadLogger = logger.child('DailyRecordReadRepository');

const createLocalRuntimeReadResult = (
  date: string,
  record: DailyRecord,
  source: 'e2e' | 'indexeddb'
): DailyRecordReadResult => {
  const migrated = migrateLegacyDataWithReport(record, date);
  const consistency = resolveDailyRecordReadConsistency({
    localRecord: migrated.record,
    remoteRecord: null,
    selectedRecord: migrated.record,
    remoteAvailability: 'not_requested',
    repairApplied: migrated.compatibilityIntensity !== 'none' || migrated.appliedRules.length > 0,
  });
  return createDailyRecordReadResult(date, migrated.record, source, {
    compatibilityTier: 'local_runtime',
    compatibilityIntensity: migrated.compatibilityIntensity,
    migrationRulesApplied: migrated.appliedRules,
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

const loadRemoteReadResult = async (date: string): Promise<DailyRecordReadResult | null> => {
  const existingRequest = remoteReadResultInFlight.get(date);
  if (existingRequest) {
    return existingRequest;
  }

  const request = measureRepositoryOperation(
    'dailyRecord.getForDate.remote',
    async () => {
      try {
        logRemoteFetchAttempt(date);

        const localRecord = await getRecordFromIndexedDB(date);
        const remoteResult = await loadRemoteRecordWithFallback(date);
        if (!remoteResult.record) {
          return null;
        }

        const consistency = resolveDailyRecordReadConsistency({
          localRecord,
          remoteRecord: remoteResult.record,
          selectedRecord: remoteResult.record,
          remoteAvailability: 'resolved',
          repairApplied:
            remoteResult.compatibilityIntensity !== 'none' ||
            remoteResult.migrationRulesApplied.length > 0,
        });

        if (consistency.shouldHydrateLocal) {
          await saveToIndexedDB(remoteResult.record);
        }

        return createDailyRecordReadResult(date, remoteResult.record, remoteResult.source, {
          compatibilityTier: remoteResult.compatibilityTier,
          compatibilityIntensity: remoteResult.compatibilityIntensity,
          migrationRulesApplied: remoteResult.migrationRulesApplied,
          consistencyState: consistency.consistencyState,
          sourceOfTruth: consistency.sourceOfTruth,
          retryability: consistency.retryability,
          recoveryAction: consistency.recoveryAction,
          conflictSummary: consistency.conflictSummary,
          observabilityTags: consistency.observabilityTags,
          userSafeMessage: consistency.userSafeMessage,
          repairApplied: consistency.repairApplied,
        });
      } catch (err) {
        dailyRecordReadLogger.warn(`Remote fetch failed for ${date}`, err);
        return null;
      }
    },
    { thresholdMs: 250, context: date }
  ).finally(() => {
    remoteReadResultInFlight.delete(date);
  });

  remoteReadResultInFlight.set(date, request);
  return request;
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
        return createLocalRuntimeReadResult(query.date, e2eOverride, 'e2e');
      }

      const localRecord = await getRecordFromIndexedDB(query.date);
      if (query.syncFromRemote && isFirestoreEnabled()) {
        const remoteReadResult = await loadRemoteReadResult(query.date);
        if (remoteReadResult) {
          return remoteReadResult;
        }

        if (localRecord) {
          const localResult = createLocalRuntimeReadResult(query.date, localRecord, 'indexeddb');
          const consistency = resolveDailyRecordReadConsistency({
            localRecord,
            remoteRecord: null,
            selectedRecord: localRecord,
            remoteAvailability: 'missing',
            repairApplied: localResult.repairApplied,
          });
          return {
            ...localResult,
            consistencyState: consistency.consistencyState,
            sourceOfTruth: consistency.sourceOfTruth,
            retryability: consistency.retryability,
            recoveryAction: consistency.recoveryAction,
            conflictSummary: consistency.conflictSummary,
            observabilityTags: consistency.observabilityTags,
            userSafeMessage: consistency.userSafeMessage,
          };
        }

        return createDailyRecordReadResult(query.date, null, 'not_found', {
          ...resolveDailyRecordReadConsistency({
            localRecord: null,
            remoteRecord: null,
            selectedRecord: null,
            remoteAvailability: 'missing',
          }),
        });
      }

      if (localRecord) {
        return createLocalRuntimeReadResult(query.date, localRecord, 'indexeddb');
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
      const remoteDates = await getAvailableDatesFromFirestore();
      return mergeAvailableDates(localDates, remoteDates);
    } catch (err) {
      dailyRecordReadLogger.warn('Failed to fetch remote dates', err);
    }
  }

  return localDates.sort().reverse();
};

export const getPreviousDay = async (date: string): Promise<DailyRecord | null> => {
  const result = await getPreviousDayWithMeta(date);
  return result.record;
};

export const getPreviousDayWithMeta = async (date: string): Promise<DailyRecordReadResult> => {
  const query = createGetPreviousDayQuery(date);

  const localRecord = await getPreviousDayFromIndexedDB(query.date);
  if (localRecord) {
    return createLocalRuntimeReadResult(localRecord.date, localRecord, 'indexeddb');
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
