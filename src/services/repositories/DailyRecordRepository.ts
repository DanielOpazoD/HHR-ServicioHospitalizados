/**
 * Daily Record Repository
 * Provides a unified interface for accessing and persisting daily records.
 * Abstracts localStorage and Firestore operations.
 */

import { DailyRecord } from '@/types';
import { DailyRecordPatch } from '@/types';
import { deleteRecord as deleteFromIndexedDB } from '../storage/indexedDBService';
import {
  deleteRecordFromFirestore,
  getRecordFromFirestore,
  moveRecordToTrash,
} from '../storage/firestoreService';
import { softDeleteDailyRecordRemote } from './dailyRecordRepositoryLifecycleSupport';
// import {
//     getActiveHospitalId
// } from '@/constants/firestorePaths';

// ============================================================================
// Configuration (imported from repositoryConfig)
// ============================================================================

export { setFirestoreEnabled, isFirestoreEnabled } from './repositoryConfig';
import { isFirestoreEnabled } from './repositoryConfig';

// Re-export from dedicated modules
export { CatalogRepository } from './CatalogRepository';
export { migrateLegacyData } from './dataMigration';
import {
  bridgeLegacyRecordForDate as bridgeLegacyRecordForDateFromReadService,
  getAvailableDates as getAvailableDatesFromReadService,
  getForDate as getForDateFromReadService,
  getForDateWithMeta as getForDateWithMetaFromReadService,
  getPreviousDay as getPreviousDayFromReadService,
} from './dailyRecordRepositoryReadService';
export { bridgeLegacyRecordsRange } from './legacyRecordBridgeService';
import {
  save as saveFromWriteService,
  updatePartial as updatePartialFromWriteService,
} from './dailyRecordRepositoryWriteService';
import {
  subscribe as subscribeFromSyncService,
  syncWithFirestore as syncWithFirestoreFromSyncService,
} from './dailyRecordRepositorySyncService';
import {
  copyPatientToDate as copyPatientToDateFromInitializationService,
  initializeDay as initializeDayFromInitializationService,
} from './dailyRecordRepositoryInitializationService';
import {
  createDeleteDayCommand,
  createInitializeDayCommand,
  createCopyPatientToDateCommand,
} from './contracts/dailyRecordLifecycleCommands';
import {
  createGetDailyRecordQuery,
  createGetPreviousDayQuery,
} from './contracts/dailyRecordQueries';
import {
  createPartialUpdateDailyRecordCommand,
  createSaveDailyRecordCommand,
} from './contracts/dailyRecordCommands';

const buildDailyRecordQuery = (date: string, syncFromRemote = true) =>
  createGetDailyRecordQuery(date, syncFromRemote);

// ============================================================================
// Repository Interface
// ============================================================================

export interface IDailyRecordRepository {
  getForDate(date: string): Promise<DailyRecord | null>;
  getPreviousDay(date: string): Promise<DailyRecord | null>;
  save(record: DailyRecord, expectedLastUpdated?: string): Promise<void>;
  subscribe(
    date: string,
    callback: (r: DailyRecord | null, hasPendingWrites: boolean) => void
  ): () => void;
  initializeDay(date: string, copyFromDate?: string): Promise<DailyRecord>;
  deleteDay(date: string): Promise<void>;
  getAllDates(): Promise<string[]>;
  updatePartial(date: string, patches: DailyRecordPatch): Promise<void>;
  copyPatientToDate(
    sourceDate: string,
    sourceBedId: string,
    targetDate: string,
    targetBedId: string
  ): Promise<void>;
}

// ============================================================================
// Repository Implementation
// ============================================================================

export const getForDate = async (date: string, syncFromRemote: boolean = true) => {
  const query = buildDailyRecordQuery(date, syncFromRemote);
  return getForDateFromReadService(query.date, query.syncFromRemote);
};

export const getForDateWithMeta = async (date: string, syncFromRemote: boolean = true) => {
  const query = buildDailyRecordQuery(date, syncFromRemote);
  return getForDateWithMetaFromReadService(query.date, query.syncFromRemote);
};

export const getPreviousDay = async (date: string) => {
  const query = createGetPreviousDayQuery(date);
  return getPreviousDayFromReadService(query.date);
};
export const getAvailableDates = getAvailableDatesFromReadService;
export const bridgeLegacyRecord = bridgeLegacyRecordForDateFromReadService;

export const save = async (record: DailyRecord, expectedLastUpdated?: string) => {
  const command = createSaveDailyRecordCommand(record, expectedLastUpdated);
  return saveFromWriteService(command.record, command.expectedLastUpdated);
};

export const updatePartial = async (date: string, patches: DailyRecordPatch) => {
  const command = createPartialUpdateDailyRecordCommand(date, patches);
  return updatePartialFromWriteService(command.date, command.patch);
};
export const subscribe = (
  date: string,
  callback: (r: DailyRecord | null, hasPendingWrites: boolean) => void
) => {
  const query = buildDailyRecordQuery(date, true);
  return subscribeFromSyncService(query.date, callback);
};
export const syncWithFirestore = syncWithFirestoreFromSyncService;

export const initializeDay = async (date: string, copyFromDate?: string) => {
  const command = createInitializeDayCommand(date, copyFromDate);
  return initializeDayFromInitializationService(command.date, command.copyFromDate);
};

/**
 * Deletes a daily record from both local and remote storage.
 */
export const deleteDay = async (date: string): Promise<void> => {
  const command = createDeleteDayCommand(date);
  await deleteFromIndexedDB(command.date);
  await softDeleteDailyRecordRemote(command.date, {
    isRemoteEnabled: isFirestoreEnabled(),
    loadRecord: getRecordFromFirestore,
    moveToTrash: moveRecordToTrash,
    deleteRemote: deleteRecordFromFirestore,
  });
};

export const copyPatientToDate = async (
  sourceDate: string,
  sourceBedId: string,
  targetDate: string,
  targetBedId: string
) => {
  const command = createCopyPatientToDateCommand(sourceDate, sourceBedId, targetDate, targetBedId);
  return copyPatientToDateFromInitializationService(
    command.sourceDate,
    command.sourceBedId,
    command.targetDate,
    command.targetBedId
  );
};

// ============================================================================
// Repository Object Export (Alternative API)
// ============================================================================

export const DailyRecordRepository: IDailyRecordRepository & {
  syncWithFirestore: typeof syncWithFirestore;
  bridgeLegacyRecord: typeof bridgeLegacyRecord;
} = {
  getForDate,
  getPreviousDay,
  save,
  subscribe,
  initializeDay,
  deleteDay,
  updatePartial,
  copyPatientToDate,
  syncWithFirestore,
  getAllDates: getAvailableDates,
  bridgeLegacyRecord,
};
