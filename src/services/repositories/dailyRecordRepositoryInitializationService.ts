import { DailyRecord } from '@/types';
import { getRecordFromFirestore } from '@/services/storage/firestoreService';
import { getLegacyRecord } from '@/services/storage/legacyFirebaseService';
import { saveRecord as saveToIndexedDB } from '@/services/storage/indexedDBService';
import { isFirestoreEnabled } from '@/services/repositories/repositoryConfig';
import { clonePatient } from '@/services/factories/patientFactory';
import { getForDate } from '@/services/repositories/dailyRecordRepositoryReadService';
import { save } from '@/services/repositories/dailyRecordRepositoryWriteService';
import { migrateLegacyData } from '@/services/repositories/dataMigration';
import {
  buildInitializedDayRecord,
  preserveCIE10FromPreviousDay,
} from '@/services/repositories/dailyRecordInitializationSupport';

const loadCopySourceRecord = async (copyFromDate?: string): Promise<DailyRecord | null> => {
  if (!copyFromDate) return null;
  return getForDate(copyFromDate);
};

const cacheMigratedInitializationRecord = async (
  rawRecord: DailyRecord,
  date: string,
  copySourceRecord: DailyRecord | null
): Promise<DailyRecord> => {
  const migrated = migrateLegacyData(rawRecord, date);

  if (copySourceRecord) {
    preserveCIE10FromPreviousDay(migrated.beds, copySourceRecord.beds);
  }

  await saveToIndexedDB(migrated);
  return migrated;
};

const loadRemoteInitializationRecord = async (
  date: string,
  copySourceRecord: DailyRecord | null
): Promise<DailyRecord | null> => {
  try {
    const remoteRecord = await getRecordFromFirestore(date);
    if (remoteRecord) {
      return cacheMigratedInitializationRecord(remoteRecord, date, copySourceRecord);
    }

    const legacyRecord = await getLegacyRecord(date);
    if (legacyRecord) {
      return cacheMigratedInitializationRecord(legacyRecord, date, copySourceRecord);
    }

    return null;
  } catch (err) {
    console.warn(`[Repository] Failed to check remote sources for ${date} during init:`, err);
    return null;
  }
};

export const initializeDay = async (date: string, copyFromDate?: string): Promise<DailyRecord> => {
  const existing = await getForDate(date);
  if (existing) return existing;

  const copySourceRecord = await loadCopySourceRecord(copyFromDate);

  if (isFirestoreEnabled()) {
    const remoteInitializationRecord = await loadRemoteInitializationRecord(date, copySourceRecord);
    if (remoteInitializationRecord) {
      return remoteInitializationRecord;
    }
  }

  const newRecord = buildInitializedDayRecord(date, copySourceRecord);

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

  let targetRecord = await getForDate(targetDate);
  if (!targetRecord) {
    targetRecord = await initializeDay(targetDate);
  }

  const clonedPatient = clonePatient(sourcePatient);
  clonedPatient.cudyr = undefined;
  if (clonedPatient.clinicalCrib) {
    clonedPatient.clinicalCrib.cudyr = undefined;
  }

  const nightNote = sourcePatient.handoffNoteNightShift || sourcePatient.handoffNote || '';
  clonedPatient.handoffNoteDayShift = nightNote;
  clonedPatient.handoffNoteNightShift = nightNote;

  targetRecord.beds[targetBedId] = clonedPatient;
  targetRecord.lastUpdated = new Date().toISOString();

  await save(targetRecord);
};
