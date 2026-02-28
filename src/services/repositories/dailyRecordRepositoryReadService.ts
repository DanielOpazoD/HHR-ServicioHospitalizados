import { DailyRecord } from '@/types';
import {
  getRecordForDate as getRecordFromIndexedDB,
  getPreviousDayRecord as getPreviousDayFromIndexedDB,
  getAllDates as getAllDatesFromIndexedDB,
} from '@/services/storage/indexedDBService';
import { getAvailableDatesFromFirestore } from '@/services/storage/firestoreService';
import { logLegacyInfo } from '@/services/storage/legacyfirebase/legacyFirebaseLogger';
import { isFirestoreEnabled } from '@/services/repositories/repositoryConfig';
import { migrateLegacyData } from '@/services/repositories/dataMigration';
import { loadRemoteRecordWithFallback } from '@/services/repositories/dailyRecordRemoteLoader';
import {
  createDailyRecordReadResult,
  DailyRecordReadResult,
  createGetDailyRecordQuery,
  createGetPreviousDayQuery,
} from '@/services/repositories/contracts/dailyRecordQueries';

const isRepositoryDebugEnabled = () =>
  import.meta.env.DEV &&
  String(import.meta.env.VITE_DEBUG_REPOSITORY || '').toLowerCase() === 'true';

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
  const query = createGetDailyRecordQuery(date, syncFromRemote);

  if (typeof window !== 'undefined' && window.__HHR_E2E_OVERRIDE__) {
    const override = window.__HHR_E2E_OVERRIDE__;
    if (override[query.date]) {
      console.warn(`[E2E] Using override record for ${query.date}`);
      const migrated = migrateLegacyData(override[query.date], query.date);
      return createDailyRecordReadResult(query.date, migrated, 'e2e');
    }
  }

  const localRecord = await getRecordFromIndexedDB(query.date);
  if (localRecord) {
    const migrated = migrateLegacyData(localRecord, query.date);
    return createDailyRecordReadResult(query.date, migrated, 'indexeddb');
  }

  if (query.syncFromRemote && isFirestoreEnabled()) {
    try {
      if (isRepositoryDebugEnabled()) {
        logLegacyInfo(`[Repository DEBUG] Attempting Firestore fetch for ${query.date}`);
      }
      if (isRepositoryDebugEnabled()) {
        logLegacyInfo(`[Repository] Checking remote + legacy fallback for ${query.date}...`);
      }

      const remoteResult = await loadRemoteRecordWithFallback(query.date);
      if (remoteResult.record) {
        if (isRepositoryDebugEnabled() && remoteResult.source === 'legacy') {
          logLegacyInfo(`[Repository] Found legacy record for ${query.date}. Migrating to Beta.`);
        }
        return createDailyRecordReadResult(query.date, remoteResult.record, remoteResult.source);
      }
    } catch (err) {
      console.warn(`[Repository] getForDate: Remote fetch failed for ${query.date}:`, err);
    }
  }

  return createDailyRecordReadResult(query.date, null, 'not_found');
};

export const getAvailableDates = async (): Promise<string[]> => {
  const localDates = await getAllDatesFromIndexedDB();

  if (isFirestoreEnabled()) {
    try {
      const remoteDates = await getAvailableDatesFromFirestore();
      const allDates = Array.from(new Set([...localDates, ...remoteDates]));
      return allDates.sort().reverse();
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
