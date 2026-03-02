import { DailyRecord } from '@/types';
import { saveRecord as saveToIndexedDB } from '@/services/storage/indexedDBService';
import { isFirestoreEnabled } from '@/services/repositories/repositoryConfig';
import { getForDate } from '@/services/repositories/dailyRecordRepositoryReadService';
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

const loadCopySourceRecord = async (copyFromDate?: string): Promise<DailyRecord | null> => {
  if (!copyFromDate) return null;
  return getForDate(copyFromDate);
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
    console.warn(`[Repository] Failed to check remote sources for ${date} during init:`, err);
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

const initializeMissingDay = async (date: string, copyFromDate?: string): Promise<DailyRecord> => {
  const copySourceRecord = await loadCopySourceRecord(copyFromDate);
  const initializationSeed = await resolveInitializationSeed(date, copySourceRecord);

  if (shouldReturnSeedRecord(initializationSeed)) {
    return initializationSeed.record;
  }

  const newRecord = buildInitializedDayRecord(date, initializationSeed.record);

  await save(newRecord);
  return newRecord;
};

export const initializeDay = async (date: string, copyFromDate?: string): Promise<DailyRecord> =>
  measureRepositoryOperation(
    'dailyRecord.initializeDay',
    async () => {
      const existing = await loadExistingDailyRecord(date);
      if (existing) {
        return existing;
      }

      return initializeMissingDay(date, copyFromDate);
    },
    { thresholdMs: 180, context: `${date}${copyFromDate ? `<-${copyFromDate}` : ''}` }
  );

export const copyPatientToDate = async (
  sourceDate: string,
  sourceBedId: string,
  targetDate: string,
  targetBedId: string
): Promise<void> => {
  const sourceRecord = await getForDate(sourceDate);
  if (!sourceRecord) throw new Error(`Source record for ${sourceDate} not found`);

  const sourcePatient = sourceRecord.beds[sourceBedId];
  if (!sourcePatient || !sourcePatient.patientName) {
    throw new Error(`No patient found in bed ${sourceBedId} on ${sourceDate}`);
  }

  const targetRecord = await resolveTargetRecordForCopy(targetDate);
  await save(assignCarriedPatientToRecord(targetRecord, targetBedId, sourcePatient));
};
