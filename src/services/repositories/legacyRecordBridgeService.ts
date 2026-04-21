import {
  getLegacyRecord,
  getLegacyRecordsRange,
} from '@/services/storage/migration/legacyRecordReadBridge';
import { migrateLegacyDataWithReport } from '@/services/repositories/dataMigration';
import { isLegacyBridgeEnabled } from '@/services/repositories/legacyCompatibilityPolicy';
import {
  getLegacyBridgeAuditSummary,
  listRecentLegacyBridgeAuditEntries,
  recordLegacyBridgeAuditEntry,
} from '@/services/repositories/legacyBridgeAudit';
import {
  buildLegacyBridgeGovernanceSummary,
  resolveLegacyBridgeRetirementPhase,
} from '@/services/repositories/legacyBridgeGovernance';
import type { LegacyBridgeLoadResult } from '@/services/repositories/ports/repositoryLegacyBridgePort';
import { measureRepositoryOperation } from '@/services/repositories/repositoryPerformance';
import { getLegacyFirebasePathSnapshot } from '@/services/storage/legacyfirebase/legacyFirebasePathPolicy';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import { persistHydratedRecordToLocalCache } from '@/services/repositories/dailyRecordLocalCachePersistence';
import { AdmissionDatePolicyViolationError } from '@/application/patient-flow/admissionDatePolicy';

const createLegacyBridgeResult = (
  result: Partial<LegacyBridgeLoadResult> & Pick<LegacyBridgeLoadResult, 'source' | 'record'>
): LegacyBridgeLoadResult => ({
  source: result.source,
  status:
    result.status ||
    (result.source === 'legacy_bridge'
      ? 'legacy_bridge'
      : result.source === 'not_found'
        ? 'not_found'
        : 'disabled'),
  scope: result.scope || 'single',
  record: result.record,
  compatibilityTier: result.compatibilityTier || (result.record ? 'legacy_bridge' : 'none'),
  compatibilityIntensity: result.compatibilityIntensity || 'none',
  migrationRulesApplied: result.migrationRulesApplied || [],
  recoveredIssues: result.recoveredIssues || [],
  cachedLocally: result.cachedLocally || false,
  candidatePaths: result.candidatePaths || [],
  auditId: result.auditId,
  retirementPhase: result.retirementPhase || resolveLegacyBridgeRetirementPhase(),
});

const cacheMigratedLegacyRecord = async (record: DailyRecord, date: string) => {
  const migrated = migrateLegacyDataWithReport(record, date);
  await persistHydratedRecordToLocalCache(migrated.record, date);
  return migrated;
};

const finalizeLegacyBridgeResult = (
  result: LegacyBridgeLoadResult,
  requestedRange: string,
  recordCount: number
): LegacyBridgeLoadResult => ({
  ...result,
  auditId: recordLegacyBridgeAuditEntry(result, result.scope, requestedRange, recordCount),
});

export const bridgeLegacyRecord = async (date: string): Promise<LegacyBridgeLoadResult> => {
  if (!isLegacyBridgeEnabled()) {
    return finalizeLegacyBridgeResult(
      createLegacyBridgeResult({
        source: 'not_found',
        status: 'disabled',
        record: null,
      }),
      date,
      0
    );
  }

  return measureRepositoryOperation(
    'dailyRecord.bridgeLegacyRecord',
    async () => {
      const legacyRecord = await getLegacyRecord(date);
      if (!legacyRecord) {
        return finalizeLegacyBridgeResult(
          createLegacyBridgeResult({ source: 'not_found', record: null }),
          date,
          0
        );
      }

      let migrated;
      try {
        migrated = await cacheMigratedLegacyRecord(legacyRecord, date);
      } catch (error) {
        if (error instanceof AdmissionDatePolicyViolationError) {
          const repaired = migrateLegacyDataWithReport(legacyRecord, date);
          const legacyPaths = getLegacyFirebasePathSnapshot(date);
          return finalizeLegacyBridgeResult(
            createLegacyBridgeResult({
              source: 'legacy_bridge',
              record: repaired.record,
              compatibilityIntensity: repaired.compatibilityIntensity,
              migrationRulesApplied: repaired.appliedRules,
              recoveredIssues: repaired.recoveredIssues,
              cachedLocally: false,
              candidatePaths: legacyPaths.recordDocPaths,
            }),
            date,
            1
          );
        }
        throw error;
      }
      const legacyPaths = getLegacyFirebasePathSnapshot(date);
      return finalizeLegacyBridgeResult(
        createLegacyBridgeResult({
          source: 'legacy_bridge',
          record: migrated.record,
          compatibilityIntensity: migrated.compatibilityIntensity,
          migrationRulesApplied: migrated.appliedRules,
          recoveredIssues: migrated.recoveredIssues,
          cachedLocally: true,
          candidatePaths: legacyPaths.recordDocPaths,
        }),
        date,
        1
      );
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
          try {
            const migrated = await cacheMigratedLegacyRecord(record, record.date);
            const legacyPaths = getLegacyFirebasePathSnapshot(record.date);
            return finalizeLegacyBridgeResult(
              createLegacyBridgeResult({
                source: 'legacy_bridge',
                scope: 'range',
                record: migrated.record,
                compatibilityIntensity: migrated.compatibilityIntensity,
                migrationRulesApplied: migrated.appliedRules,
                recoveredIssues: migrated.recoveredIssues,
                cachedLocally: true,
                candidatePaths: legacyPaths.recordDocPaths,
              }),
              `${startDate}:${endDate}`,
              legacyRecords.length
            );
          } catch (error) {
            if (!(error instanceof AdmissionDatePolicyViolationError)) {
              throw error;
            }
            const migrated = migrateLegacyDataWithReport(record, record.date);
            const legacyPaths = getLegacyFirebasePathSnapshot(record.date);
            return finalizeLegacyBridgeResult(
              createLegacyBridgeResult({
                source: 'legacy_bridge',
                scope: 'range',
                record: migrated.record,
                compatibilityIntensity: migrated.compatibilityIntensity,
                migrationRulesApplied: migrated.appliedRules,
                recoveredIssues: migrated.recoveredIssues,
                cachedLocally: false,
                candidatePaths: legacyPaths.recordDocPaths,
              }),
              `${startDate}:${endDate}`,
              legacyRecords.length
            );
          }
        })
      );

      return results.sort((a, b) =>
        String(a.record?.date || '').localeCompare(b.record?.date || '')
      );
    },
    { thresholdMs: 400, context: `${startDate}:${endDate}` }
  );
};

export const getLegacyBridgeGovernanceSummary = buildLegacyBridgeGovernanceSummary;
export const getLegacyBridgeUsageSummary = getLegacyBridgeAuditSummary;
export const listRecentLegacyBridgeOperations = listRecentLegacyBridgeAuditEntries;
