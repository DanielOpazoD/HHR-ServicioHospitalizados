import Dexie, { Table } from 'dexie';

import { DailyRecord } from '@/types/domain/dailyRecord';
import { AuditLogEntry } from '@/types/audit';
import { ErrorLog } from '@/services/logging/errorLogTypes';

import { SyncTask } from '../syncQueueTypes';
import { CatalogRecord } from './indexedDbCatalogContracts';
import {
  shouldScheduleBackgroundIndexedDbRecovery,
  shouldUseStickyIndexedDbFallback,
} from './indexedDbRecoveryPolicy';
import { createMockDatabase } from './indexedDbMockFactory';
import { attachIndexedDbEvents } from './indexedDbBootstrap';
import type { IndexedDbDatabaseLike } from './indexedDbContracts';
import {
  recordIndexedDbFallbackMode,
  recordIndexedDbRecoveryNotice,
  recordIndexedDbRecoveryFailure,
} from './indexedDbRecoveryController';

export class HangaRoaDatabase extends Dexie {
  dailyRecords!: Table<DailyRecord>;
  catalogs!: Table<CatalogRecord>;
  errorLogs!: Table<ErrorLog>;
  auditLogs!: Table<AuditLogEntry>;
  settings!: Table<{ id: string; value: unknown }>;
  syncQueue!: Table<SyncTask>;

  constructor() {
    super('HangaRoaDB');

    this.version(8).stores({
      dailyRecords: 'date',
      catalogs: 'id',
      errorLogs: 'id, timestamp, severity',
      auditLogs: 'id, timestamp, action, entityId, recordDate',
      settings: 'id',
      syncQueue: '++id, status, timestamp, type, key, nextAttemptAt',
    });

    this.version(9).stores({
      dailyRecords: 'date, lastUpdated, dateTimestamp',
      catalogs: 'id',
      errorLogs: 'id, timestamp, severity',
      auditLogs: 'id, timestamp, action, entityId, recordDate',
      settings: 'id',
      syncQueue:
        '++id, status, timestamp, type, key, nextAttemptAt, [status+timestamp], [status+nextAttemptAt]',
    });
  }
}

let db: HangaRoaDatabase;
let isUsingMock = false;
let isOpening = false;
let onDatabaseRecreated: (() => void) | null = null;
const INDEXED_DB_OPEN_TIMEOUT_MS = 7000;
const INDEXED_DB_DELETE_TIMEOUT_MS = 5000;
const INDEXED_DB_RECOVERY_RETRY_DELAYS_MS = [300, 1000, 3000] as const;
const MAX_BACKGROUND_RECOVERY_ATTEMPTS = 3;
let recoveryRetryTimer: ReturnType<typeof setTimeout> | null = null;
let backgroundRecoveryAttempts = 0;
let stickyFallbackMode = false;
let stickyFallbackWarningShown = false;
const emittedIndexedDbWarnings = new Set<string>();

const attachDatabaseEvents = (database: HangaRoaDatabase) =>
  attachIndexedDbEvents(
    database,
    () => ({ isUsingMock, stickyFallbackMode }),
    emittedIndexedDbWarnings
  );

const initializeDatabase = () => {
  try {
    db = new HangaRoaDatabase();
    attachDatabaseEvents(db);
  } catch (error) {
    recordIndexedDbRecoveryFailure(error);
    db = createMockDatabase() as unknown as HangaRoaDatabase;
    isUsingMock = true;
    recordIndexedDbFallbackMode(
      'construct_failed',
      'IndexedDB no pudo inicializarse y se activo el modo fallback local.'
    );
  }
};

const assignMockTables = (mock: IndexedDbDatabaseLike) => {
  db.dailyRecords = mock.dailyRecords;
  db.catalogs = mock.catalogs;
  db.errorLogs = mock.errorLogs;
  db.auditLogs = mock.auditLogs;
  db.settings = mock.settings;
  db.syncQueue = mock.syncQueue;
};

const scheduleBackgroundRecoveryRetry = () => {
  if (recoveryRetryTimer || typeof window === 'undefined') return;

  if (
    !shouldScheduleBackgroundIndexedDbRecovery(
      backgroundRecoveryAttempts,
      MAX_BACKGROUND_RECOVERY_ATTEMPTS,
      stickyFallbackMode
    )
  ) {
    if (stickyFallbackMode && !stickyFallbackWarningShown) {
      stickyFallbackWarningShown = true;
      recordIndexedDbRecoveryNotice(
        'indexeddb_recovery_disabled',
        'La recuperacion de IndexedDB fue deshabilitada por esta sesion tras fallos persistentes.',
        { stickyFallbackMode: true }
      );
      return;
    }

    recordIndexedDbRecoveryNotice(
      'indexeddb_recovery_stopped',
      'Se detuvo la recuperacion en segundo plano de IndexedDB.',
      { attempts: MAX_BACKGROUND_RECOVERY_ATTEMPTS }
    );
    return;
  }

  backgroundRecoveryAttempts++;
  recoveryRetryTimer = setTimeout(() => {
    recoveryRetryTimer = null;
    void ensureDbReady({ allowRecoveryWhenMock: true });
  }, 5000);
};

const tryOpenWithTimeout = async (): Promise<void> => {
  const openPromise = db.open();
  const timeoutPromise = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('IndexedDB open timeout')), INDEXED_DB_OPEN_TIMEOUT_MS)
  );
  await Promise.race([openPromise, timeoutPromise]);
};

initializeDatabase();

export const registerDatabaseRecreatedHandler = (handler: () => void): void => {
  onDatabaseRecreated = handler;
};

interface EnsureDbReadyOptions {
  allowRecoveryWhenMock?: boolean;
}

export const ensureDbReady = async (options: EnsureDbReadyOptions = {}): Promise<void> => {
  const { allowRecoveryWhenMock = false } = options;

  if (typeof window !== 'undefined' && window.__HHR_E2E_OVERRIDE__) {
    isUsingMock = true;
    return;
  }

  if (isUsingMock && !allowRecoveryWhenMock) return;
  if (isUsingMock && allowRecoveryWhenMock) {
    if (stickyFallbackMode) {
      return;
    }

    try {
      db = new HangaRoaDatabase();
      attachDatabaseEvents(db);
      isUsingMock = false;
    } catch (error) {
      recordIndexedDbRecoveryFailure(error);
      isUsingMock = true;
      assignMockTables(createMockDatabase());
      return;
    }
  }

  if (db.isOpen()) {
    try {
      await db.settings.get('__health_check__');
      return;
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        (error as { name?: string }).name === 'DatabaseClosedError'
      ) {
        recordIndexedDbRecoveryNotice(
          'indexeddb_database_closed',
          'Se detecto cierre inesperado de IndexedDB; se intentara reabrir.',
          { errorName: 'DatabaseClosedError' }
        );
      } else {
        return;
      }
    }
  }

  if (isOpening) {
    let attempts = 0;
    while (isOpening && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
      if (db.isOpen() || isUsingMock) return;
    }
    if (isOpening) {
      recordIndexedDbRecoveryNotice(
        'indexeddb_open_stalled',
        'La apertura de IndexedDB excedio el tiempo esperado; se activo fallback.',
        { waitedMs: 5000 }
      );
      isUsingMock = true;
      return;
    }
    return;
  }

  isOpening = true;
  try {
    let opened = false;
    let openError: unknown = undefined;
    for (const retryDelay of INDEXED_DB_RECOVERY_RETRY_DELAYS_MS) {
      try {
        await tryOpenWithTimeout();
        opened = true;
        break;
      } catch (attemptError) {
        openError = attemptError;
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    if (!opened) {
      throw openError || new Error('IndexedDB open failed');
    }

    stickyFallbackMode = false;
    stickyFallbackWarningShown = false;
    backgroundRecoveryAttempts = 0;
    emittedIndexedDbWarnings.clear();
  } catch (error: unknown) {
    const errorName =
      error && typeof error === 'object' && 'name' in error ? String(error.name) : 'Unknown';
    const errorMessage =
      error && typeof error === 'object' && 'message' in error
        ? String(error.message)
        : String(error);

    recordIndexedDbRecoveryNotice(
      'indexeddb_initial_open_failed',
      'La apertura inicial de IndexedDB fallo; se intentara recuperacion automatica.',
      {
        errorName,
        errorMessage,
      }
    );

    if (errorName === 'UnknownError' || errorName === 'VersionError') {
      try {
        db.close();

        const deletePromise = Dexie.delete('HangaRoaDB');
        const deleteTimeout = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Deletion timeout')), INDEXED_DB_DELETE_TIMEOUT_MS)
        );

        await Promise.race([deletePromise, deleteTimeout]);

        db = new HangaRoaDatabase();
        attachDatabaseEvents(db);
        await tryOpenWithTimeout();

        isUsingMock = false;
        stickyFallbackMode = false;
        stickyFallbackWarningShown = false;
        backgroundRecoveryAttempts = 0;
        emittedIndexedDbWarnings.clear();
        onDatabaseRecreated?.();
        return;
      } catch (recoveryError) {
        recordIndexedDbRecoveryFailure(recoveryError);
        stickyFallbackMode = stickyFallbackMode || shouldUseStickyIndexedDbFallback(recoveryError);
      }
    }

    recordIndexedDbFallbackMode(errorName, errorMessage || 'IndexedDB fallback activated');
    stickyFallbackMode = stickyFallbackMode || shouldUseStickyIndexedDbFallback(error);
    isUsingMock = true;
    assignMockTables(createMockDatabase());
    scheduleBackgroundRecoveryRetry();
  } finally {
    isOpening = false;
  }
};

export const isIndexedDBAvailable = (): boolean => typeof indexedDB !== 'undefined';

export const isDatabaseInFallbackMode = (): boolean => isUsingMock;

export { db as hospitalDB };
export { createMockDatabase } from './indexedDbMockFactory';
