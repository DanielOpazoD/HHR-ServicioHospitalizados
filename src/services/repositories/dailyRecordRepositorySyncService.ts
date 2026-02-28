import { DailyRecord } from '@/types';
import { saveRecord as saveToIndexedDB } from '@/services/storage/indexedDBService';
import { subscribeToRecord } from '@/services/storage/firestoreService';
import { isFirestoreEnabled } from '@/services/repositories/repositoryConfig';
import { migrateLegacyData } from '@/services/repositories/dataMigration';
import { loadRemoteRecordWithFallback } from '@/services/repositories/dailyRecordRemoteLoader';

export const subscribe = (
  date: string,
  callback: (r: DailyRecord | null, hasPendingWrites: boolean) => void
): (() => void) => {
  return subscribeToRecord(date, async (record, hasPendingWrites) => {
    const migrated = record ? migrateLegacyData(record, date) : null;
    if (migrated && !hasPendingWrites) {
      await saveToIndexedDB(migrated);
    }
    callback(migrated, hasPendingWrites);
  });
};

export const syncWithFirestore = async (date: string): Promise<DailyRecord | null> => {
  if (!isFirestoreEnabled()) return null;

  try {
    const remoteResult = await loadRemoteRecordWithFallback(date);
    return remoteResult.record;
  } catch (err) {
    console.warn(`[Repository] Sync failed for ${date}:`, err);
  }
  return null;
};
