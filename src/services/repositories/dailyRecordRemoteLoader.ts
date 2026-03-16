import { DailyRecord } from '@/types/core';
import { getRecordFromFirestore } from '@/services/storage/firestoreService';
import { migrateLegacyDataWithReport } from '@/services/repositories/dataMigration';
import {
  LegacyMigrationRule,
  MigrationCompatibilityIntensity,
} from '@/services/repositories/dataMigrationContracts';
import { measureRepositoryOperation } from '@/services/repositories/repositoryPerformance';

export type DailyRecordRemoteSource = 'firestore' | 'not_found';
export type DailyRecordRemoteCompatibilityTier = 'current_firestore' | 'none';

export interface DailyRecordRemoteLoadResult {
  record: DailyRecord | null;
  source: DailyRecordRemoteSource;
  compatibilityTier: DailyRecordRemoteCompatibilityTier;
  compatibilityIntensity: MigrationCompatibilityIntensity;
  migrationRulesApplied: LegacyMigrationRule[];
  cachedLocally: boolean;
}

const remoteLoadInFlight = new Map<string, Promise<DailyRecordRemoteLoadResult>>();

const normalizeRemoteRecord = (
  record: DailyRecord,
  date: string
): {
  record: DailyRecord;
  migrationRulesApplied: LegacyMigrationRule[];
  compatibilityIntensity: MigrationCompatibilityIntensity;
} => {
  const migrated = migrateLegacyDataWithReport(record, date);
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
  compatibilityIntensity: MigrationCompatibilityIntensity = 'none',
  cachedLocally: boolean = false
): DailyRecordRemoteLoadResult => ({
  record,
  source,
  compatibilityTier: source === 'firestore' ? 'current_firestore' : 'none',
  compatibilityIntensity,
  migrationRulesApplied,
  cachedLocally,
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
        const normalizedRemoteRecord = normalizeRemoteRecord(remoteRecord, date);
        return createRemoteLoadResult(
          'firestore',
          normalizedRemoteRecord.record,
          normalizedRemoteRecord.migrationRulesApplied,
          normalizedRemoteRecord.compatibilityIntensity,
          false
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
