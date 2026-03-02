import { DailyRecord } from '@/types';
import { saveRecord as saveToIndexedDB } from '@/services/storage/indexedDBService';
import { getRecordFromFirestore } from '@/services/storage/firestoreService';
import { getLegacyRecord } from '@/services/storage/legacyFirebaseService';
import { migrateLegacyDataWithReport } from '@/services/repositories/dataMigration';
import {
  LegacyMigrationRule,
  MigrationCompatibilityIntensity,
} from '@/services/repositories/dataMigrationContracts';
import { measureRepositoryOperation } from '@/services/repositories/repositoryPerformance';

export type DailyRecordRemoteSource = 'firestore' | 'legacy' | 'not_found';
export type DailyRecordRemoteCompatibilityTier = 'current_firestore' | 'legacy_firestore' | 'none';

export interface DailyRecordRemoteLoadResult {
  record: DailyRecord | null;
  source: DailyRecordRemoteSource;
  compatibilityTier: DailyRecordRemoteCompatibilityTier;
  compatibilityIntensity: MigrationCompatibilityIntensity;
  migrationRulesApplied: LegacyMigrationRule[];
  cachedLocally: boolean;
}

const remoteLoadInFlight = new Map<string, Promise<DailyRecordRemoteLoadResult>>();

const cacheRemoteRecord = async (
  record: DailyRecord,
  date: string
): Promise<{
  record: DailyRecord;
  migrationRulesApplied: LegacyMigrationRule[];
  compatibilityIntensity: MigrationCompatibilityIntensity;
}> => {
  const migrated = migrateLegacyDataWithReport(record, date);
  await saveToIndexedDB(migrated.record);
  return {
    record: migrated.record,
    migrationRulesApplied: migrated.appliedRules,
    compatibilityIntensity: migrated.compatibilityIntensity,
  };
};

const createRemoteLoadResult = (
  source: DailyRecordRemoteSource,
  record: DailyRecord | null,
  migrationRulesApplied: LegacyMigrationRule[] = [],
  compatibilityIntensity: MigrationCompatibilityIntensity = 'none'
): DailyRecordRemoteLoadResult => ({
  record,
  source,
  compatibilityTier:
    source === 'firestore'
      ? 'current_firestore'
      : source === 'legacy'
        ? 'legacy_firestore'
        : 'none',
  compatibilityIntensity,
  migrationRulesApplied,
  cachedLocally: Boolean(record),
});

export const loadRemoteRecordWithFallback = async (
  date: string
): Promise<DailyRecordRemoteLoadResult> => {
  const existingRequest = remoteLoadInFlight.get(date);
  if (existingRequest) {
    return existingRequest;
  }

  const request = measureRepositoryOperation(
    'dailyRecord.loadRemoteWithFallback',
    async () => {
      const remoteRecord = await getRecordFromFirestore(date);
      if (remoteRecord) {
        const cachedRemoteRecord = await cacheRemoteRecord(remoteRecord, date);
        return createRemoteLoadResult(
          'firestore',
          cachedRemoteRecord.record,
          cachedRemoteRecord.migrationRulesApplied,
          cachedRemoteRecord.compatibilityIntensity
        );
      }

      const legacyRecord = await getLegacyRecord(date);
      if (legacyRecord) {
        const cachedLegacyRecord = await cacheRemoteRecord(legacyRecord, date);
        return createRemoteLoadResult(
          'legacy',
          cachedLegacyRecord.record,
          cachedLegacyRecord.migrationRulesApplied,
          cachedLegacyRecord.compatibilityIntensity
        );
      }

      return createRemoteLoadResult('not_found', null);
    },
    { thresholdMs: 220, context: date }
  ).finally(() => {
    remoteLoadInFlight.delete(date);
  });

  remoteLoadInFlight.set(date, request);
  return request;
};
