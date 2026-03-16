import { DailyRecord } from '@/types/domain/dailyRecord';
import {
  getRecordForDate as getRecordFromIndexedDB,
  saveRecord as saveToIndexedDB,
} from '@/services/storage/indexeddb/indexedDbRecordService';
import { subscribeToRecord } from '@/services/storage/firestore';
import { isFirestoreEnabled } from '@/services/repositories/repositoryConfig';
import { migrateLegacyData } from '@/services/repositories/dataMigration';
import { loadRemoteRecordWithFallback } from '@/services/repositories/dailyRecordRemoteLoader';
import { resolvePreferredDailyRecord } from '@/services/repositories/dailyRecordSyncCompatibility';
import { measureRepositoryOperation } from '@/services/repositories/repositoryPerformance';
import { createSyncDailyRecordResult } from '@/services/repositories/contracts/dailyRecordResults';
import { logger } from '@/services/utils/loggerService';
import { resolveDailyRecordSyncConsistency } from '@/services/repositories/dailyRecordConsistencyPolicy';

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
      const localRecord = await getRecordFromIndexedDB(date);
      try {
        const remoteResult = await loadRemoteRecordWithFallback(date);
        const record = await resolveIncomingRemoteRecord(date, remoteResult.record);
        const consistency = resolveDailyRecordSyncConsistency({
          localRecord,
          remoteRecord: remoteResult.record,
          selectedRecord: record,
          remoteAvailability: remoteResult.record ? 'resolved' : 'missing',
        });
        return createSyncDailyRecordResult({
          date,
          outcome: consistency.consistencyState === 'missing_remote' ? 'missing' : 'clean',
          record,
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
        dailyRecordSyncLogger.warn(`Sync failed for ${date}`, err);
        const consistency = resolveDailyRecordSyncConsistency({
          localRecord,
          remoteRecord: null,
          selectedRecord: localRecord,
          remoteAvailability: 'unavailable',
        });
        return createSyncDailyRecordResult({
          date,
          outcome: 'blocked',
          record: localRecord,
          consistencyState: consistency.consistencyState,
          sourceOfTruth: consistency.sourceOfTruth,
          retryability: consistency.retryability,
          recoveryAction: consistency.recoveryAction,
          conflictSummary: consistency.conflictSummary,
          observabilityTags: consistency.observabilityTags,
          userSafeMessage: consistency.userSafeMessage,
          repairApplied: consistency.repairApplied,
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
