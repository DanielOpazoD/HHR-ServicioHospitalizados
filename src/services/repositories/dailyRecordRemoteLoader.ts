import { DailyRecord } from '@/types';
import { saveRecord as saveToIndexedDB } from '@/services/storage/indexedDBService';
import { getRecordFromFirestore } from '@/services/storage/firestoreService';
import { getLegacyRecord } from '@/services/storage/legacyFirebaseService';
import { migrateLegacyData } from '@/services/repositories/dataMigration';

export type DailyRecordRemoteSource = 'firestore' | 'legacy' | 'not_found';

export interface DailyRecordRemoteLoadResult {
  record: DailyRecord | null;
  source: DailyRecordRemoteSource;
}

const cacheRemoteRecord = async (record: DailyRecord, date: string): Promise<DailyRecord> => {
  const migrated = migrateLegacyData(record, date);
  await saveToIndexedDB(migrated);
  return migrated;
};

export const loadRemoteRecordWithFallback = async (
  date: string
): Promise<DailyRecordRemoteLoadResult> => {
  const remoteRecord = await getRecordFromFirestore(date);
  if (remoteRecord) {
    return {
      record: await cacheRemoteRecord(remoteRecord, date),
      source: 'firestore',
    };
  }

  const legacyRecord = await getLegacyRecord(date);
  if (legacyRecord) {
    return {
      record: await cacheRemoteRecord(legacyRecord, date),
      source: 'legacy',
    };
  }

  return {
    record: null,
    source: 'not_found',
  };
};
