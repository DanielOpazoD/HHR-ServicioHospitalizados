import { DailyRecord } from '@/types';
import {
  getRecordForDate as getRecordFromIndexedDB,
  getPreviousDayRecord as getPreviousDayFromIndexedDB,
  getAllDates as getAllDatesFromIndexedDB,
} from '@/services/storage/indexedDBService';
import { getAvailableDatesFromFirestore } from '@/services/storage/firestoreService';
import { logLegacyInfo } from '@/services/storage/legacyfirebase/legacyFirebaseLogger';
import { isFirestoreEnabled } from '@/services/repositories/repositoryConfig';
import {
  migrateLegacyData,
  migrateLegacyDataWithReport,
} from '@/services/repositories/dataMigration';
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

const isRepositoryDebugEnabled = () =>
  import.meta.env.DEV &&
  String(import.meta.env.VITE_DEBUG_REPOSITORY || '').toLowerCase() === 'true';

const remoteReadResultInFlight = new Map<string, Promise<DailyRecordReadResult | null>>();

const createLocalRuntimeReadResult = (
  date: string,
  record: DailyRecord,
  source: 'e2e' | 'indexeddb'
): DailyRecordReadResult => {
  const migrated = migrateLegacyDataWithReport(record, date);
  return createDailyRecordReadResult(date, migrated.record, source, {
    compatibilityTier: 'local_runtime',
    compatibilityIntensity: migrated.compatibilityIntensity,
    migrationRulesApplied: migrated.appliedRules,
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

        const remoteResult = await loadRemoteRecordWithFallback(date);
        if (!remoteResult.record) {
          return null;
        }

        return createDailyRecordReadResult(date, remoteResult.record, remoteResult.source, {
          compatibilityTier: remoteResult.compatibilityTier,
          compatibilityIntensity: remoteResult.compatibilityIntensity,
          migrationRulesApplied: remoteResult.migrationRulesApplied,
        });
      } catch (err) {
        console.warn(`[Repository] getForDate: Remote fetch failed for ${date}:`, err);
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
        console.warn(`[E2E] Using override record for ${query.date}`);
        return createLocalRuntimeReadResult(query.date, e2eOverride, 'e2e');
      }

      const localRecord = await getRecordFromIndexedDB(query.date);
      if (localRecord) {
        return createLocalRuntimeReadResult(query.date, localRecord, 'indexeddb');
      }

      if (query.syncFromRemote && isFirestoreEnabled()) {
        const remoteReadResult = await loadRemoteReadResult(query.date);
        if (remoteReadResult) {
          return remoteReadResult;
        }
      }

      return createDailyRecordReadResult(query.date, null, 'not_found');
    },
    { thresholdMs: 120, context: date }
  );
};

export const bridgeLegacyRecordForDate = async (date: string): Promise<DailyRecordReadResult> => {
  const bridged = await bridgeLegacyRecord(date);
  return createDailyRecordReadResult(date, bridged.record, bridged.source, {
    compatibilityTier: bridged.compatibilityTier,
    compatibilityIntensity: bridged.compatibilityIntensity,
    migrationRulesApplied: bridged.migrationRulesApplied,
  });
};

export const getAvailableDates = async (): Promise<string[]> => {
  const localDates = await getAllDatesFromIndexedDB();

  if (isFirestoreEnabled()) {
    try {
      const remoteDates = await getAvailableDatesFromFirestore();
      return mergeAvailableDates(localDates, remoteDates);
    } catch (err) {
      console.warn('[Repository] Failed to fetch remote dates:', err);
    }
  }

  return localDates.sort().reverse();
};

export const getPreviousDay = async (date: string): Promise<DailyRecord | null> => {
  const query = createGetPreviousDayQuery(date);

  const localRecord = await getPreviousDayFromIndexedDB(query.date);
  if (localRecord) {
    return migrateLegacyData(localRecord, localRecord.date);
  }

  if (isFirestoreEnabled()) {
    try {
      const allDates = await getAvailableDates();
      const prevDate = allDates.find(d => d < query.date);

      if (prevDate) {
        return await getForDate(prevDate);
      }
    } catch (err) {
      console.warn('[Repository] getPreviousDay remote check failed:', err);
    }
  }

  return null;
};
