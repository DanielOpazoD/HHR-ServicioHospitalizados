import {
  getForDate,
  getForDateWithMeta,
  getPreviousDay,
  getPreviousDayWithMeta,
  getAvailableDates,
} from '@/services/repositories/dailyRecordRepositoryReadService';
import {
  initializeDay,
  type CopyPatientToDateResult,
} from '@/services/repositories/dailyRecordRepositoryInitializationService';
import {
  updatePartialDetailed,
  saveDetailed,
} from '@/services/repositories/dailyRecordRepositoryWriteService';
import { syncWithFirestoreDetailed } from '@/services/repositories/dailyRecordRepositorySyncService';
import {
  subscribe,
  subscribeDetailed,
} from '@/services/repositories/dailyRecordRepositorySyncService';
import { copyPatientToDateDetailed } from '@/services/repositories/dailyRecordRepositoryInitializationService';
import { deleteDailyRecordAcrossStores } from '@/services/repositories/dailyRecordRepositoryFacadeSupport';
import { getMonthRecordsFromFirestore } from '@/services/storage/firestore';
import type { DailyRecord, DailyRecordPatch } from '@/application/shared/dailyRecordCoreContracts';
import type {
  SaveDailyRecordResult,
  SyncDailyRecordResult,
  UpdatePartialDailyRecordResult,
} from '@/services/repositories/contracts/dailyRecordResults';
import type { DailyRecordReadResult } from '@/services/repositories/contracts/dailyRecordQueries';

export interface DailyRecordReadPort {
  getPreviousDay: (date: string) => Promise<DailyRecord | null>;
  getAvailableDates: () => Promise<string[]>;
  getMonthRecords: (year: number, monthZeroBased: number) => Promise<DailyRecord[]>;
  getForDate: (date: string) => Promise<DailyRecord | null>;
  getForDateWithMeta: (date: string, syncFromRemote?: boolean) => Promise<DailyRecordReadResult>;
  initializeDay: (date: string, copyFromDate?: string) => Promise<DailyRecord>;
  getPreviousDayWithMeta: (date: string) => Promise<DailyRecordReadResult>;
}

export interface DailyRecordWritePort {
  updatePartial: (date: string, patch: DailyRecordPatch) => Promise<UpdatePartialDailyRecordResult>;
  save: (record: DailyRecord, expectedLastUpdated?: string) => Promise<SaveDailyRecordResult>;
  delete: (date: string) => Promise<void>;
}

export interface DailyRecordSyncPort {
  syncWithFirestoreDetailed: (date: string) => Promise<SyncDailyRecordResult | null>;
}

/**
 * Canonical repository-shaped port for UI/runtime consumers that still expect a
 * single `dailyRecord` dependency instead of separate read/write/sync ports.
 */
export interface DailyRecordRepositoryPort
  extends DailyRecordReadPort, DailyRecordWritePort, DailyRecordSyncPort {
  saveDetailed: (
    record: DailyRecord,
    expectedLastUpdated?: string
  ) => Promise<SaveDailyRecordResult>;
  updatePartialDetailed: (
    date: string,
    patch: DailyRecordPatch
  ) => Promise<UpdatePartialDailyRecordResult>;
  subscribe: (
    date: string,
    callback: (record: DailyRecord | null, hasPendingWrites: boolean) => void
  ) => () => void;
  subscribeDetailed: (
    date: string,
    callback: (result: SyncDailyRecordResult, hasPendingWrites: boolean) => void
  ) => () => void;
  deleteDay: (date: string) => Promise<void>;
  copyPatientToDateDetailed: (
    sourceDate: string,
    sourceBedId: string,
    targetDate: string,
    targetBedId: string
  ) => Promise<CopyPatientToDateResult>;
}

export const defaultDailyRecordReadPort: DailyRecordReadPort = {
  getPreviousDay: async date => getPreviousDay(date),
  getAvailableDates: async () => getAvailableDates(),
  getMonthRecords: async (year, monthZeroBased) =>
    getMonthRecordsFromFirestore(year, monthZeroBased),
  getForDate: async date => getForDate(date),
  getForDateWithMeta: async (date, syncFromRemote = true) =>
    getForDateWithMeta(date, syncFromRemote),
  initializeDay: async (date, copyFromDate) => initializeDay(date, copyFromDate),
  getPreviousDayWithMeta: async date => getPreviousDayWithMeta(date),
};

export const defaultDailyRecordWritePort: DailyRecordWritePort = {
  updatePartial: async (date, patch) => updatePartialDetailed(date, patch),
  save: async (record, expectedLastUpdated) => saveDetailed(record, expectedLastUpdated),
  delete: async date => deleteDailyRecordAcrossStores(date),
};

export const defaultDailyRecordSyncPort: DailyRecordSyncPort = {
  syncWithFirestoreDetailed: async date => syncWithFirestoreDetailed(date),
};

export const defaultDailyRecordRepositoryPort: DailyRecordRepositoryPort = {
  ...defaultDailyRecordReadPort,
  ...defaultDailyRecordWritePort,
  ...defaultDailyRecordSyncPort,
  saveDetailed: async (record, expectedLastUpdated) => saveDetailed(record, expectedLastUpdated),
  updatePartialDetailed: async (date, patch) => updatePartialDetailed(date, patch),
  subscribe: (date, callback) => subscribe(date, callback),
  subscribeDetailed: (date, callback) => subscribeDetailed(date, callback),
  deleteDay: async date => deleteDailyRecordAcrossStores(date),
  copyPatientToDateDetailed: async (sourceDate, sourceBedId, targetDate, targetBedId) =>
    copyPatientToDateDetailed(sourceDate, sourceBedId, targetDate, targetBedId),
};
