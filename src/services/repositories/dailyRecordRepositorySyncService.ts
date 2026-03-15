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
import { createSyncDailyRecordResult } from '@/services/repositories/contracts/dailyRecordResults';
import { logger } from '@/services/utils/loggerService';

const dailyRecordSyncLogger = logger.child('DailyRecordRepositorySyncService');

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

export const syncWithFirestoreDetailed = async (date: string) => {
  if (!isFirestoreEnabled()) return null;

  return measureRepositoryOperation(
    'dailyRecord.syncWithFirestore',
    async () => {
      try {
        const remoteResult = await loadRemoteRecordWithFallback(date);
        const record = await resolveIncomingRemoteRecord(date, remoteResult.record);
        return createSyncDailyRecordResult({
          date,
          outcome: record ? 'clean' : 'missing',
          record,
        });
      } catch (err) {
        dailyRecordSyncLogger.warn(`Sync failed for ${date}`, err);
        return createSyncDailyRecordResult({
          date,
          outcome: 'blocked',
          record: null,
        });
      }
    },
    { thresholdMs: 200, context: date }
  );
};

export const syncWithFirestore = async (date: string): Promise<DailyRecord | null> => {
  const result = await syncWithFirestoreDetailed(date);
  return result?.record ?? null;
};
