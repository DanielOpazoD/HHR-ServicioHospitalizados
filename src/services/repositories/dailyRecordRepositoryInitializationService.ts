import { DailyRecord } from '@/types';
import { saveRecord as saveToIndexedDB } from '@/services/storage/indexedDBService';
import { isFirestoreEnabled } from '@/services/repositories/repositoryConfig';
import { getForDate } from '@/services/repositories/dailyRecordRepositoryReadService';
import { save } from '@/services/repositories/dailyRecordRepositoryWriteService';
import { loadRemoteRecordWithFallback } from '@/services/repositories/dailyRecordRemoteLoader';
import {
  buildInitializedDayRecord,
  enrichInitializationRecordFromCopySource,
  preparePatientForCarryover,
} from '@/services/repositories/dailyRecordInitializationSupport';
import {
  createCopySourceInitializationSeed,
  createFreshInitializationSeed,
  createRemoteInitializationSeed,
  DailyRecordInitializationSeed,
  shouldReturnSeedRecord,
} from '@/services/repositories/dailyRecordInitializationSeed';

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
  return targetRecord ?? initializeDay(targetDate);
};

export const initializeDay = async (date: string, copyFromDate?: string): Promise<DailyRecord> => {
  const existing = await loadExistingDailyRecord(date);
  if (existing) return existing;

  const copySourceRecord = await loadCopySourceRecord(copyFromDate);
  const initializationSeed = await resolveInitializationSeed(date, copySourceRecord);

  if (shouldReturnSeedRecord(initializationSeed)) {
    return initializationSeed.record;
  }

  const newRecord = buildInitializedDayRecord(date, initializationSeed.record);

  await save(newRecord);
  return newRecord;
};

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
  const clonedPatient = preparePatientForCarryover(sourcePatient);

  targetRecord.beds[targetBedId] = clonedPatient;
  targetRecord.lastUpdated = new Date().toISOString();

  await save(targetRecord);
};
