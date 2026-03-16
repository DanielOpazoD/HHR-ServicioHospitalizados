/**
 * @deprecated Compatibility facade only.
 *
 * New source code should import from the intent-specific repository modules:
 * read, write, sync, initialization, or repositoryConfig. This facade remains
 * for controlled compatibility and is protected by persistence boundary checks.
 */

import { DailyRecord } from '@/types/domain/dailyRecord';
import { DailyRecordPatch } from '@/types/domain/dailyRecord';
import type { DailyRecordReadResult } from './contracts/dailyRecordQueries';
// import {
//     getActiveHospitalId
// } from '@/constants/firestorePaths';

// ============================================================================
// Configuration (imported from repositoryConfig)
// ============================================================================

export { setFirestoreEnabled, isFirestoreEnabled } from './repositoryConfig';

// Re-export from dedicated modules
export { CatalogRepository } from './CatalogRepository';
export { migrateLegacyData } from './dataMigration';
import {
  bridgeLegacyRecordForDate as bridgeLegacyRecordForDateFromReadService,
  getAvailableDates as getAvailableDatesFromReadService,
  getForDate as getForDateFromReadService,
  getForDateWithMeta as getForDateWithMetaFromReadService,
  getPreviousDay as getPreviousDayFromReadService,
  getPreviousDayWithMeta as getPreviousDayWithMetaFromReadService,
} from './dailyRecordRepositoryReadService';
export { bridgeLegacyRecordsRange } from './legacyRecordBridgeService';
import {
  save as saveFromWriteService,
  saveDetailed as saveDetailedFromWriteService,
  updatePartial as updatePartialFromWriteService,
  updatePartialDetailed as updatePartialDetailedFromWriteService,
} from './dailyRecordRepositoryWriteService';
import {
  subscribe as subscribeFromSyncService,
  syncWithFirestore as syncWithFirestoreFromSyncService,
  syncWithFirestoreDetailed as syncWithFirestoreDetailedFromSyncService,
} from './dailyRecordRepositorySyncService';
import {
  copyPatientToDate as copyPatientToDateFromInitializationService,
  initializeDay as initializeDayFromInitializationService,
  copyPatientToDateDetailed as copyPatientToDateDetailedFromInitializationService,
  initializeDayDetailed as initializeDayDetailedFromInitializationService,
} from './dailyRecordRepositoryInitializationService';
import {
  buildCopyPatientToDateCommand,
  buildDailyRecordQuery,
  buildInitializeDayCommand,
  buildPartialUpdateDailyRecordCommand,
  buildPreviousDayQuery,
  buildSaveDailyRecordCommand,
  deleteDailyRecordAcrossStores,
} from './dailyRecordRepositoryFacadeSupport';

// ============================================================================
// Repository Interface
// ============================================================================

export interface IDailyRecordRepository {
  getForDate(date: string): Promise<DailyRecord | null>;
  getPreviousDay(date: string): Promise<DailyRecord | null>;
  getPreviousDayWithMeta(date: string): Promise<DailyRecordReadResult>;
  save(record: DailyRecord, expectedLastUpdated?: string): Promise<void>;
  saveDetailed: typeof saveDetailed;
  subscribe(
    date: string,
    callback: (r: DailyRecord | null, hasPendingWrites: boolean) => void
  ): () => void;
  initializeDay(date: string, copyFromDate?: string): Promise<DailyRecord>;
  initializeDayDetailed: typeof initializeDayDetailed;
  deleteDay(date: string): Promise<void>;
  getAllDates(): Promise<string[]>;
  updatePartial(date: string, patches: DailyRecordPatch): Promise<void>;
  updatePartialDetailed: typeof updatePartialDetailed;
  syncWithFirestoreDetailed: typeof syncWithFirestoreDetailed;
  copyPatientToDate(
    sourceDate: string,
    sourceBedId: string,
    targetDate: string,
    targetBedId: string
  ): Promise<void>;
  copyPatientToDateDetailed: typeof copyPatientToDateDetailed;
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
  const query = buildPreviousDayQuery(date);
  return getPreviousDayFromReadService(query.date);
};
export const getPreviousDayWithMeta = async (date: string) => {
  const query = buildPreviousDayQuery(date);
  return getPreviousDayWithMetaFromReadService(query.date);
};
export const getAvailableDates = getAvailableDatesFromReadService;
export const bridgeLegacyRecord = bridgeLegacyRecordForDateFromReadService;

export const save = async (record: DailyRecord, expectedLastUpdated?: string) => {
  const command = buildSaveDailyRecordCommand(record, expectedLastUpdated);
  return saveFromWriteService(command.record, command.expectedLastUpdated);
};

export const saveDetailed = async (record: DailyRecord, expectedLastUpdated?: string) => {
  const command = buildSaveDailyRecordCommand(record, expectedLastUpdated);
  return saveDetailedFromWriteService(command.record, command.expectedLastUpdated);
};

export const updatePartial = async (date: string, patches: DailyRecordPatch) => {
  const command = buildPartialUpdateDailyRecordCommand(date, patches);
  return updatePartialFromWriteService(command.date, command.patch);
};
export const updatePartialDetailed = async (date: string, patches: DailyRecordPatch) => {
  const command = buildPartialUpdateDailyRecordCommand(date, patches);
  return updatePartialDetailedFromWriteService(command.date, command.patch);
};
export const subscribe = (
  date: string,
  callback: (r: DailyRecord | null, hasPendingWrites: boolean) => void
) => {
  const query = buildDailyRecordQuery(date, true);
  return subscribeFromSyncService(query.date, callback);
};
export const syncWithFirestore = syncWithFirestoreFromSyncService;
export const syncWithFirestoreDetailed = syncWithFirestoreDetailedFromSyncService;

export const initializeDay = async (date: string, copyFromDate?: string) => {
  const command = buildInitializeDayCommand(date, copyFromDate);
  return initializeDayFromInitializationService(command.date, command.copyFromDate);
};

export const initializeDayDetailed = async (date: string, copyFromDate?: string) => {
  const command = buildInitializeDayCommand(date, copyFromDate);
  return initializeDayDetailedFromInitializationService(command.date, command.copyFromDate);
};

/**
 * Deletes a daily record from both local and remote storage.
 */
export const deleteDay = async (date: string): Promise<void> => {
  await deleteDailyRecordAcrossStores(date);
};

export const copyPatientToDate = async (
  sourceDate: string,
  sourceBedId: string,
  targetDate: string,
  targetBedId: string
) => {
  const command = buildCopyPatientToDateCommand(sourceDate, sourceBedId, targetDate, targetBedId);
  return copyPatientToDateFromInitializationService(
    command.sourceDate,
    command.sourceBedId,
    command.targetDate,
    command.targetBedId
  );
};

export const copyPatientToDateDetailed = async (
  sourceDate: string,
  sourceBedId: string,
  targetDate: string,
  targetBedId: string
) => {
  const command = buildCopyPatientToDateCommand(sourceDate, sourceBedId, targetDate, targetBedId);
  return copyPatientToDateDetailedFromInitializationService(
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
} = Object.freeze({
  getForDate,
  getPreviousDay,
  getPreviousDayWithMeta,
  save,
  saveDetailed,
  subscribe,
  initializeDay,
  initializeDayDetailed,
  deleteDay,
  updatePartial,
  updatePartialDetailed,
  copyPatientToDate,
  copyPatientToDateDetailed,
  syncWithFirestore,
  syncWithFirestoreDetailed,
  getAllDates: getAvailableDates,
  bridgeLegacyRecord,
});
