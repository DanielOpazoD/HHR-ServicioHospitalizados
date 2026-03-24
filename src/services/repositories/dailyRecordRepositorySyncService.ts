import { DailyRecord } from '@/types/domain/dailyRecord';
import {
  getRecordForDate as getRecordFromIndexedDB,
  saveRecord as saveToIndexedDB,
} from '@/services/storage/indexeddb/indexedDbRecordService';
import { subscribeToRecord } from '@/services/storage/firestore';
import { isFirestoreEnabled } from '@/services/repositories/repositoryConfig';
import { migrateLegacyData } from '@/services/repositories/dataMigration';
import { loadRemoteRecordWithFallback } from '@/services/repositories/dailyRecordRemoteLoader';
import { measureRepositoryOperation } from '@/services/repositories/repositoryPerformance';
import { createSyncDailyRecordResult } from '@/services/repositories/contracts/dailyRecordResults';
import { logger } from '@/services/utils/loggerService';
import { resolveDailyRecordSyncConsistency } from '@/services/repositories/dailyRecordConsistencyPolicy';
import { resolveDailyRecordPersistenceGoldenPath } from '@/services/repositories/dailyRecordPersistenceGoldenPath';
import type { SyncDailyRecordResult } from '@/services/repositories/contracts/dailyRecordResults';

const dailyRecordSyncLogger = logger.child('DailyRecordRepositorySyncService');

const resolveSubscriptionResult = async (
  date: string,
  remoteRecord: DailyRecord | null,
  remoteAvailability: 'resolved' | 'missing'
): Promise<SyncDailyRecordResult> => {
  const localRecord = await getRecordFromIndexedDB(date);
  const goldenPath = resolveDailyRecordPersistenceGoldenPath({
    localRecord,
    remoteRecord,
    remoteAvailability,
  });
  if (goldenPath.shouldHydrateLocal && remoteRecord) {
    await saveToIndexedDB(remoteRecord);
  }
  const record = goldenPath.selectedRecord;
  const consistency = resolveDailyRecordSyncConsistency({
    localRecord,
    remoteRecord,
    selectedRecord: record,
    remoteAvailability,
  });

  return createSyncDailyRecordResult({
    date,
    outcome:
      consistency.consistencyState === 'blocked'
        ? 'blocked'
        : consistency.consistencyState === 'missing_remote'
          ? 'missing'
          : 'clean',
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
};

export const subscribeDetailed = (
  date: string,
  callback: (result: SyncDailyRecordResult, hasPendingWrites: boolean) => void
): (() => void) => {
  return subscribeToRecord(date, async (record, hasPendingWrites) => {
    const migrated = record ? migrateLegacyData(record, date) : null;
    const result = hasPendingWrites
      ? createSyncDailyRecordResult({
          date,
          outcome: migrated ? 'clean' : 'missing',
          record: migrated,
          consistencyState: migrated ? 'up_to_date' : 'missing_remote',
          sourceOfTruth: migrated ? 'local' : 'none',
          retryability: 'not_applicable',
          recoveryAction: 'none',
          conflictSummary: null,
          observabilityTags: ['daily_record', 'sync', 'subscription_pending_write'],
          repairApplied: false,
        })
      : await resolveSubscriptionResult(date, migrated, migrated ? 'resolved' : 'missing');
    callback(result, hasPendingWrites);
  });
};

export const subscribe = (
  date: string,
  callback: (r: DailyRecord | null, hasPendingWrites: boolean) => void
): (() => void) =>
  subscribeDetailed(date, (result, hasPendingWrites) => {
    callback(result.record, hasPendingWrites);
  });

export const syncWithFirestoreDetailed = async (date: string) => {
  if (!isFirestoreEnabled()) return null;

  return measureRepositoryOperation(
    'dailyRecord.syncWithFirestore',
    async () => {
      const localRecord = await getRecordFromIndexedDB(date);
      try {
        const remoteResult = await loadRemoteRecordWithFallback(date);
        const goldenPath = resolveDailyRecordPersistenceGoldenPath({
          localRecord,
          remoteRecord: remoteResult.record,
          remoteAvailability: remoteResult.record ? 'resolved' : 'missing',
        });
        if (goldenPath.shouldHydrateLocal && remoteResult.record) {
          await saveToIndexedDB(remoteResult.record);
        }
        const record = goldenPath.selectedRecord;
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
