import type { DailyRecord, DailyRecordPatch } from '@/application/shared/dailyRecordCoreContracts';
import type { CopyPatientToDateResult } from '@/services/repositories/dailyRecordRepositoryInitializationService';
import type {
  SaveDailyRecordResult,
  SyncDailyRecordResult,
  UpdatePartialDailyRecordResult,
} from '@/services/repositories/contracts/dailyRecordResults';
import type { DailyRecordReadResult } from '@/services/repositories/contracts/dailyRecordQueries';

type DailyRecordReadService =
  typeof import('@/services/repositories/dailyRecordRepositoryReadService');
type DailyRecordInitializationService =
  typeof import('@/services/repositories/dailyRecordRepositoryInitializationService');
type DailyRecordWriteService =
  typeof import('@/services/repositories/dailyRecordRepositoryWriteService');
type DailyRecordSyncService =
  typeof import('@/services/repositories/dailyRecordRepositorySyncService');
type DailyRecordFacadeSupportService =
  typeof import('@/services/repositories/dailyRecordRepositoryFacadeSupport');

let readServicePromise: Promise<DailyRecordReadService> | null = null;
let initializationServicePromise: Promise<DailyRecordInitializationService> | null = null;
let writeServicePromise: Promise<DailyRecordWriteService> | null = null;
let syncServicePromise: Promise<DailyRecordSyncService> | null = null;
let facadeSupportServicePromise: Promise<DailyRecordFacadeSupportService> | null = null;

const loadDailyRecordReadService = (): Promise<DailyRecordReadService> =>
  (readServicePromise ??= import('@/services/repositories/dailyRecordRepositoryReadService'));

const loadDailyRecordInitializationService = (): Promise<DailyRecordInitializationService> =>
  (initializationServicePromise ??=
    import('@/services/repositories/dailyRecordRepositoryInitializationService'));

const loadDailyRecordWriteService = (): Promise<DailyRecordWriteService> =>
  (writeServicePromise ??= import('@/services/repositories/dailyRecordRepositoryWriteService'));

const loadDailyRecordSyncService = (): Promise<DailyRecordSyncService> =>
  (syncServicePromise ??= import('@/services/repositories/dailyRecordRepositorySyncService'));

const loadDailyRecordFacadeSupportService = (): Promise<DailyRecordFacadeSupportService> =>
  (facadeSupportServicePromise ??=
    import('@/services/repositories/dailyRecordRepositoryFacadeSupport'));

const createLazySubscription = (
  start: (service: DailyRecordSyncService) => () => void
): (() => void) => {
  let active = true;
  let unsubscribe = () => {};

  void loadDailyRecordSyncService()
    .then(service => {
      if (!active) {
        return;
      }
      unsubscribe = start(service);
    })
    .catch(() => {
      // Keep a stable no-op unsubscribe. Bootstrap/runtime telemetry captures the chunk error path.
    });

  return () => {
    active = false;
    unsubscribe();
  };
};

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
  getPreviousDay: async date => (await loadDailyRecordReadService()).getPreviousDay(date),
  getAvailableDates: async () => (await loadDailyRecordReadService()).getAvailableDates(),
  getMonthRecords: async (year, monthZeroBased) =>
    (await loadDailyRecordReadService()).getMonthRecords(year, monthZeroBased),
  getForDate: async date => (await loadDailyRecordReadService()).getForDate(date),
  getForDateWithMeta: async (date, syncFromRemote = true) =>
    (await loadDailyRecordReadService()).getForDateWithMeta(date, syncFromRemote),
  initializeDay: async (date, copyFromDate) =>
    (await loadDailyRecordInitializationService()).initializeDay(date, copyFromDate),
  getPreviousDayWithMeta: async date =>
    (await loadDailyRecordReadService()).getPreviousDayWithMeta(date),
};

export const defaultDailyRecordWritePort: DailyRecordWritePort = {
  updatePartial: async (date, patch) =>
    (await loadDailyRecordWriteService()).updatePartialDetailed(date, patch),
  save: async (record, expectedLastUpdated) =>
    (await loadDailyRecordWriteService()).saveDetailed(record, expectedLastUpdated),
  delete: async date =>
    (await loadDailyRecordFacadeSupportService()).deleteDailyRecordAcrossStores(date),
};

export const defaultDailyRecordSyncPort: DailyRecordSyncPort = {
  syncWithFirestoreDetailed: async date =>
    (await loadDailyRecordSyncService()).syncWithFirestoreDetailed(date),
};

export const defaultDailyRecordRepositoryPort: DailyRecordRepositoryPort = {
  ...defaultDailyRecordReadPort,
  ...defaultDailyRecordWritePort,
  ...defaultDailyRecordSyncPort,
  saveDetailed: async (record, expectedLastUpdated) =>
    (await loadDailyRecordWriteService()).saveDetailed(record, expectedLastUpdated),
  updatePartialDetailed: async (date, patch) =>
    (await loadDailyRecordWriteService()).updatePartialDetailed(date, patch),
  subscribe: (date, callback) =>
    createLazySubscription(service => service.subscribe(date, callback)),
  subscribeDetailed: (date, callback) =>
    createLazySubscription(service => service.subscribeDetailed(date, callback)),
  deleteDay: async date =>
    (await loadDailyRecordFacadeSupportService()).deleteDailyRecordAcrossStores(date),
  copyPatientToDateDetailed: async (sourceDate, sourceBedId, targetDate, targetBedId) =>
    (await loadDailyRecordInitializationService()).copyPatientToDateDetailed(
      sourceDate,
      sourceBedId,
      targetDate,
      targetBedId
    ),
};
