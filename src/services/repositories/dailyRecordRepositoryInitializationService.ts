import { DailyRecord } from '@/types/domain/dailyRecord';
import { saveRecord as saveToIndexedDB } from '@/services/storage/indexeddb/indexedDbRecordService';
import { isFirestoreEnabled } from '@/services/repositories/repositoryConfig';
import {
  getForDate,
  getForDateWithMeta,
} from '@/services/repositories/dailyRecordRepositoryReadService';
import { save } from '@/services/repositories/dailyRecordRepositoryWriteService';
import { loadRemoteRecordWithFallback } from '@/services/repositories/dailyRecordRemoteLoader';
import {
  assignCarriedPatientToRecord,
  buildInitializedDayRecord,
  enrichInitializationRecordFromCopySource,
} from '@/services/repositories/dailyRecordInitializationSupport';
import {
  createCopySourceInitializationSeed,
  createFreshInitializationSeed,
  createRemoteInitializationSeed,
  DailyRecordInitializationSeed,
  shouldReturnSeedRecord,
} from '@/services/repositories/dailyRecordInitializationSeed';
import { measureRepositoryOperation } from '@/services/repositories/repositoryPerformance';
import { migrateLegacyDataWithReport } from '@/services/repositories/dataMigration';
import {
  createCopyPatientResult,
  createInitializeDayResult,
} from '@/services/repositories/contracts/dailyRecordResults';
import { logger } from '@/services/utils/loggerService';

export interface DailyRecordInitializationResult {
  record: DailyRecord;
  outcome: 'clean' | 'repaired';
  sourceDate?: string;
  sourceCompatibilityIntensity:
    | 'none'
    | 'normalized_only'
    | 'legacy_staff_promoted'
    | 'legacy_schema_bridge';
  sourceMigrationRulesApplied: string[];
}

export interface CopyPatientToDateResult {
  sourceDate: string;
  targetDate: string;
  sourceBedId: string;
  targetBedId: string;
  outcome: 'clean' | 'repaired';
  sourceCompatibilityIntensity:
    | 'none'
    | 'normalized_only'
    | 'legacy_staff_promoted'
    | 'legacy_schema_bridge';
  sourceMigrationRulesApplied: string[];
}

const dailyRecordInitializationLogger = logger.child('DailyRecordInitializationService');

const loadCopySourceRecord = async (copyFromDate?: string): Promise<DailyRecord | null> => {
  if (!copyFromDate) return null;
  return getForDate(copyFromDate);
};

const buildCopySourceMeta = (
  copySourceRecord: DailyRecord | null,
  copyFromDate?: string
): Omit<DailyRecordInitializationResult, 'record'> => {
  if (!copySourceRecord) {
    return {
      outcome: 'clean',
      sourceDate: copyFromDate,
      sourceCompatibilityIntensity: 'none',
      sourceMigrationRulesApplied: [],
    };
  }

  const migration = migrateLegacyDataWithReport(copySourceRecord, copySourceRecord.date);
  return {
    outcome:
      migration.compatibilityIntensity !== 'none' && migration.appliedRules.length > 0
        ? 'repaired'
        : 'clean',
    sourceDate: copySourceRecord.date,
    sourceCompatibilityIntensity: migration.compatibilityIntensity,
    sourceMigrationRulesApplied: migration.appliedRules,
  };
};

const cacheInitializationRecordIfNeeded = async (
  record: DailyRecord,
  copySourceRecord: DailyRecord | null
): Promise<void> => {
  if (!copySourceRecord) {
    return;
  }

  await saveToIndexedDB(record);
};

const loadRemoteInitializationSeed = async (
  date: string,
  copySourceRecord: DailyRecord | null
): Promise<DailyRecordInitializationSeed | null> => {
  try {
    const remoteResult = await loadRemoteRecordWithFallback(date);
    if (!remoteResult.record) return null;

    const enrichedRecord = enrichInitializationRecordFromCopySource(
      remoteResult.record,
      copySourceRecord
    );
    await cacheInitializationRecordIfNeeded(enrichedRecord, copySourceRecord);

    return createRemoteInitializationSeed({
      ...remoteResult,
      record: enrichedRecord,
    });
  } catch (err) {
    dailyRecordInitializationLogger.warn(
      `Failed to check remote sources for ${date} during init`,
      err
    );
    return null;
  }
};

const resolveInitializationSeed = async (
  date: string,
  copySourceRecord: DailyRecord | null
): Promise<DailyRecordInitializationSeed> => {
  if (isFirestoreEnabled()) {
    const remoteSeed = await loadRemoteInitializationSeed(date, copySourceRecord);
    if (remoteSeed?.record) {
      return remoteSeed;
    }
  }

  if (copySourceRecord) {
    return createCopySourceInitializationSeed(copySourceRecord);
  }

  return createFreshInitializationSeed();
};

const loadExistingDailyRecord = async (date: string): Promise<DailyRecord | null> =>
  getForDate(date);

const resolveTargetRecordForCopy = async (targetDate: string): Promise<DailyRecord> => {
  const targetRecord = await getForDate(targetDate);
  return targetRecord ?? initializeMissingDay(targetDate);
};

const initializeMissingDay = async (
  date: string,
  copyFromDate?: string,
  copySourceRecordOverride?: DailyRecord | null
): Promise<DailyRecord> => {
  const copySourceRecord =
    copySourceRecordOverride === undefined
      ? await loadCopySourceRecord(copyFromDate)
      : copySourceRecordOverride;
  const initializationSeed = await resolveInitializationSeed(date, copySourceRecord);

  if (shouldReturnSeedRecord(initializationSeed)) {
    return initializationSeed.record;
  }

  const newRecord = buildInitializedDayRecord(date, initializationSeed.record);

  await save(newRecord);
  return newRecord;
};

export const initializeDay = async (date: string, copyFromDate?: string): Promise<DailyRecord> =>
  (await initializeDayDetailed(date, copyFromDate)).record;

export const initializeDayDetailed = async (
  date: string,
  copyFromDate?: string
): Promise<DailyRecordInitializationResult> =>
  measureRepositoryOperation(
    'dailyRecord.initializeDay',
    async () => {
      const existing = await loadExistingDailyRecord(date);
      if (existing) {
        return {
          record: existing,
          ...createInitializeDayResult({ date, outcome: 'clean', sourceDate: copyFromDate }),
          sourceCompatibilityIntensity: 'none',
          sourceMigrationRulesApplied: [],
        };
      }

      const copySourceRecord = copyFromDate ? await loadCopySourceRecord(copyFromDate) : null;
      const copyMeta = buildCopySourceMeta(copySourceRecord, copyFromDate);
      const record = await initializeMissingDay(date, copyFromDate, copySourceRecord);
      return {
        record,
        ...createInitializeDayResult({
          date,
          outcome: copyMeta.outcome,
          sourceDate: copyMeta.sourceDate,
        }),
        ...copyMeta,
      };
    },
    { thresholdMs: 180, context: `${date}${copyFromDate ? `<-${copyFromDate}` : ''}` }
  );

export const copyPatientToDate = async (
  sourceDate: string,
  sourceBedId: string,
  targetDate: string,
  targetBedId: string
): Promise<void> => {
  await copyPatientToDateDetailed(sourceDate, sourceBedId, targetDate, targetBedId);
};

export const copyPatientToDateDetailed = async (
  sourceDate: string,
  sourceBedId: string,
  targetDate: string,
  targetBedId: string
): Promise<CopyPatientToDateResult> => {
  const sourceResult = await getForDateWithMeta(sourceDate);
  const sourceRecord = sourceResult.record;
  if (!sourceRecord) throw new Error(`Source record for ${sourceDate} not found`);

  const sourcePatient = sourceRecord.beds[sourceBedId];
  if (!sourcePatient || !sourcePatient.patientName) {
    throw new Error(`No patient found in bed ${sourceBedId} on ${sourceDate}`);
  }

  const targetRecord = await resolveTargetRecordForCopy(targetDate);
  await save(assignCarriedPatientToRecord(targetRecord, targetBedId, sourcePatient));

  return {
    ...createCopyPatientResult({
      sourceDate,
      targetDate,
      outcome:
        sourceResult.compatibilityIntensity !== 'none' &&
        sourceResult.migrationRulesApplied.length > 0
          ? 'repaired'
          : 'clean',
    }),
    sourceBedId,
    targetBedId,
    sourceCompatibilityIntensity: sourceResult.compatibilityIntensity,
    sourceMigrationRulesApplied: sourceResult.migrationRulesApplied,
  };
};
