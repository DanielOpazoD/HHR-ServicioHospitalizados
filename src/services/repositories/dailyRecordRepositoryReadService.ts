import { DailyRecord } from '@/types';
import {
  getRecordForDate as getRecordFromIndexedDB,
  getPreviousDayRecord as getPreviousDayFromIndexedDB,
  getAllDates as getAllDatesFromIndexedDB,
  getAllDemoRecords as getAllDemoRecordsFromIndexedDB,
  getDemoRecordForDate,
  getPreviousDemoDayRecord,
  saveRecord as saveToIndexedDB,
} from '@/services/storage/indexedDBService';
import {
  getAvailableDatesFromFirestore,
  getRecordFromFirestore,
} from '@/services/storage/firestoreService';
import { getLegacyRecord } from '@/services/storage/legacyFirebaseService';
import { logLegacyInfo } from '@/services/storage/legacyfirebase/legacyFirebaseLogger';
import { isDemoModeActive, isFirestoreEnabled } from '@/services/repositories/repositoryConfig';
import { migrateLegacyData } from '@/services/repositories/dataMigration';
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

  if (isDemoModeActive()) {
    const demoRecord = await getDemoRecordForDate(query.date);
    return createDailyRecordReadResult(query.date, demoRecord, 'demo');
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
      const remoteRecord = await getRecordFromFirestore(query.date);
      if (remoteRecord) {
        const migrated = migrateLegacyData(remoteRecord, query.date);
        await saveToIndexedDB(migrated);
        return createDailyRecordReadResult(query.date, migrated, 'firestore');
      }

      if (isRepositoryDebugEnabled()) {
        logLegacyInfo(`[Repository] Checking legacy fallback for ${query.date}...`);
      }
      const legacyRecord = await getLegacyRecord(query.date);
      if (legacyRecord) {
        if (isRepositoryDebugEnabled()) {
          logLegacyInfo(`[Repository] Found legacy record for ${query.date}. Migrating to Beta.`);
        }
        const migrated = migrateLegacyData(legacyRecord, query.date);
        await saveToIndexedDB(migrated);
        return createDailyRecordReadResult(query.date, migrated, 'legacy');
      }
    } catch (err) {
      console.warn(`[Repository] getForDate: Remote fetch failed for ${query.date}:`, err);
    }
  }

  return createDailyRecordReadResult(query.date, null, 'not_found');
};

export const getAvailableDates = async (): Promise<string[]> => {
  if (isDemoModeActive()) {
    const records = await getAllDemoRecordsFromIndexedDB();
    return Object.keys(records).sort().reverse();
  }

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

  if (isDemoModeActive()) {
    return await getPreviousDemoDayRecord(query.date);
  }

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
