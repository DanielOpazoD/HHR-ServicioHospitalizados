import { DailyRecord } from '@/types';
import {
  getRecordForDate as getRecordFromIndexedDB,
  saveRecord as saveToIndexedDB,
} from '@/services/storage/indexedDBService';
import { subscribeToRecord } from '@/services/storage/firestoreService';
import { isFirestoreEnabled } from '@/services/repositories/repositoryConfig';
import { migrateLegacyData } from '@/services/repositories/dataMigration';
import { loadRemoteRecordWithFallback } from '@/services/repositories/dailyRecordRemoteLoader';
import { resolvePreferredDailyRecord } from '@/services/repositories/dailyRecordSyncCompatibility';
import { measureRepositoryOperation } from '@/services/repositories/repositoryPerformance';

const resolveIncomingRemoteRecord = async (
  date: string,
  remoteRecord: DailyRecord | null
): Promise<DailyRecord | null> => {
  const localRecord = await getRecordFromIndexedDB(date);
  const preferredRecord = resolvePreferredDailyRecord(localRecord, remoteRecord);
  if (!preferredRecord) {
    return null;
  }

  if (preferredRecord === remoteRecord) {
    await saveToIndexedDB(remoteRecord);
  }

  return preferredRecord;
};

export const subscribe = (
  date: string,
  callback: (r: DailyRecord | null, hasPendingWrites: boolean) => void
): (() => void) => {
  return subscribeToRecord(date, async (record, hasPendingWrites) => {
    const migrated = record ? migrateLegacyData(record, date) : null;
    if (migrated && !hasPendingWrites) {
      const resolvedRecord = await resolveIncomingRemoteRecord(date, migrated);
      callback(resolvedRecord, hasPendingWrites);
      return;
    }
    callback(migrated, hasPendingWrites);
  });
};

export const syncWithFirestore = async (date: string): Promise<DailyRecord | null> => {
  if (!isFirestoreEnabled()) return null;

  return measureRepositoryOperation(
    'dailyRecord.syncWithFirestore',
    async () => {
      try {
        const remoteResult = await loadRemoteRecordWithFallback(date);
        return resolveIncomingRemoteRecord(date, remoteResult.record);
      } catch (err) {
        console.warn(`[Repository] Sync failed for ${date}:`, err);
      }
      return null;
    },
    { thresholdMs: 200, context: date }
  );
};
