import { saveRecord as saveToIndexedDB } from '@/services/storage/indexedDBService';
import { getLegacyRecord, getLegacyRecordsRange } from '@/services/storage/legacyFirebaseService';
import { migrateLegacyDataWithReport } from '@/services/repositories/dataMigration';
import { isLegacyBridgeEnabled } from '@/services/repositories/legacyCompatibilityPolicy';
import type { LegacyBridgeLoadResult } from '@/services/repositories/ports/repositoryLegacyBridgePort';
import { measureRepositoryOperation } from '@/services/repositories/repositoryPerformance';
import { getLegacyFirebasePathSnapshot } from '@/services/storage/legacyfirebase/legacyFirebasePathPolicy';
import type { DailyRecord } from '@/types';

const createLegacyBridgeResult = (
  result: Partial<LegacyBridgeLoadResult> & Pick<LegacyBridgeLoadResult, 'source' | 'record'>
): LegacyBridgeLoadResult => ({
  source: result.source,
  record: result.record,
  compatibilityTier: result.compatibilityTier || (result.record ? 'legacy_bridge' : 'none'),
  compatibilityIntensity: result.compatibilityIntensity || 'none',
  migrationRulesApplied: result.migrationRulesApplied || [],
  cachedLocally: result.cachedLocally || false,
  candidatePaths: result.candidatePaths || [],
});

const cacheMigratedLegacyRecord = async (record: DailyRecord, date: string) => {
  const migrated = migrateLegacyDataWithReport(record, date);
  await saveToIndexedDB(migrated.record);
  return migrated;
};

export const bridgeLegacyRecord = async (date: string): Promise<LegacyBridgeLoadResult> => {
  if (!isLegacyBridgeEnabled()) {
    return createLegacyBridgeResult({ source: 'not_found', record: null });
  }

  return measureRepositoryOperation(
    'dailyRecord.bridgeLegacyRecord',
    async () => {
      const legacyRecord = await getLegacyRecord(date);
      if (!legacyRecord) {
        return createLegacyBridgeResult({ source: 'not_found', record: null });
      }

      const migrated = await cacheMigratedLegacyRecord(legacyRecord, date);
      const legacyPaths = getLegacyFirebasePathSnapshot(date);
      return createLegacyBridgeResult({
        source: 'legacy_bridge',
        record: migrated.record,
        compatibilityIntensity: migrated.compatibilityIntensity,
        migrationRulesApplied: migrated.appliedRules,
        cachedLocally: true,
        candidatePaths: legacyPaths.recordDocPaths,
      });
    },
    { thresholdMs: 220, context: date }
  );
};

export const bridgeLegacyRecordsRange = async (
  startDate: string,
  endDate: string
): Promise<LegacyBridgeLoadResult[]> => {
  if (!isLegacyBridgeEnabled()) {
    return [];
  }

  return measureRepositoryOperation(
    'dailyRecord.bridgeLegacyRange',
    async () => {
      const legacyRecords = await getLegacyRecordsRange(startDate, endDate);
      const results = await Promise.all(
        legacyRecords.map(async record => {
          const migrated = await cacheMigratedLegacyRecord(record, record.date);
          const legacyPaths = getLegacyFirebasePathSnapshot(record.date);
          return createLegacyBridgeResult({
            source: 'legacy_bridge',
            record: migrated.record,
            compatibilityIntensity: migrated.compatibilityIntensity,
            migrationRulesApplied: migrated.appliedRules,
            cachedLocally: true,
            candidatePaths: legacyPaths.recordDocPaths,
          });
        })
      );

      return results.sort((a, b) =>
        String(a.record?.date || '').localeCompare(b.record?.date || '')
      );
    },
    { thresholdMs: 400, context: `${startDate}:${endDate}` }
  );
};
