import Dexie, { Table } from 'dexie';

import { DailyRecord } from '@/services/storage/storageDailyRecordContracts';
import { AuditLogEntry } from '@/types/auditLogTypes';
import { ErrorLog } from '@/services/logging/errorLogTypes';

import { SyncTask } from '../syncQueueTypes';
import { CatalogRecord } from './indexedDbCatalogContracts';
import {
  isIndexedDbBackingStoreError,
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
import {
  isDatabaseClosedError,
  resolveIndexedDbErrorDetails,
  resolveIndexedDbRecoveryDelay,
  runIndexedDbOperationWithTimeout,
  shouldAttemptIndexedDbRecreation,
  sleep,
  waitForIndexedDbOpenResolution,
} from './indexedDbCoreSupport';
import {
  INDEXED_DB_DELETE_TIMEOUT_MS,
  INDEXED_DB_OPEN_TIMEOUT_MS,
  INDEXED_DB_RECOVERY_RETRY_DELAYS_MS,
  MAX_BACKGROUND_RECOVERY_ATTEMPTS,
  getIndexedDbRecoveryBudgetSnapshot,
} from './indexedDbRecoveryBudgets';
import type { OperationalRuntimeState } from '@/services/observability/operationalRuntimeState';

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

    this.version(10).stores({
      dailyRecords: 'date, lastUpdated, dateTimestamp',
      catalogs: 'id',
      errorLogs: 'id, timestamp, severity',
      auditLogs: 'id, timestamp, action, entityId, recordDate',
      settings: 'id',
      syncQueue:
        '++id, status, timestamp, type, key, ownerKey, nextAttemptAt, [status+timestamp], [status+nextAttemptAt], [ownerKey+status], [ownerKey+type]',
    });
  }
}

let db: HangaRoaDatabase;
let isUsingMock = false;
let isOpening = false;
let onDatabaseRecreated: (() => void) | null = null;
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
      'IndexedDB no pudo inicializarse y se activo el modo fallback local.',
      { ...getIndexedDbRecoveryBudgetSnapshot() }
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

const resetIndexedDbRecoveryTracking = () => {
  stickyFallbackMode = false;
  stickyFallbackWarningShown = false;
  backgroundRecoveryAttempts = 0;
  emittedIndexedDbWarnings.clear();
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
        {
          stickyFallbackMode: true,
          attempts: backgroundRecoveryAttempts,
          ...getIndexedDbRecoveryBudgetSnapshot(),
        },
        'blocked'
      );
      return;
    }

    recordIndexedDbRecoveryNotice(
      'indexeddb_recovery_stopped',
      'Se detuvo la recuperacion en segundo plano de IndexedDB.',
      {
        attempts: MAX_BACKGROUND_RECOVERY_ATTEMPTS,
        ...getIndexedDbRecoveryBudgetSnapshot(),
      },
      'recoverable'
    );
    return;
  }

  backgroundRecoveryAttempts++;
  const scheduledDelayMs = resolveIndexedDbRecoveryDelay(
    backgroundRecoveryAttempts,
    INDEXED_DB_RECOVERY_RETRY_DELAYS_MS
  );
  recoveryRetryTimer = setTimeout(() => {
    recoveryRetryTimer = null;
    void ensureDbReady({ allowRecoveryWhenMock: true });
  }, scheduledDelayMs);
  recordIndexedDbRecoveryNotice(
    'indexeddb_recovery_retry_scheduled',
    'Se programo un nuevo intento de recuperacion de IndexedDB.',
    {
      attempt: backgroundRecoveryAttempts,
      scheduledDelayMs,
      ...getIndexedDbRecoveryBudgetSnapshot(),
    },
    'retryable'
  );
};

const tryOpenWithTimeout = (): Promise<Dexie> =>
  runIndexedDbOperationWithTimeout(
    () => db.open(),
    INDEXED_DB_OPEN_TIMEOUT_MS,
    'IndexedDB open timeout'
  );

initializeDatabase();

export const registerDatabaseRecreatedHandler = (handler: () => void): void => {
  onDatabaseRecreated = handler;
};

interface EnsureDbReadyOptions {
  allowRecoveryWhenMock?: boolean;
}

export interface LocalPersistenceRuntimeSnapshot {
  indexedDbAvailable: boolean;
  fallbackMode: boolean;
  stickyFallbackMode: boolean;
  runtimeState: 'ok' | OperationalRuntimeState;
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
      resetIndexedDbRecoveryTracking();
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
      if (isDatabaseClosedError(error)) {
        recordIndexedDbRecoveryNotice(
          'indexeddb_database_closed',
          'Se detecto cierre inesperado de IndexedDB; se intentara reabrir.',
          { errorName: 'DatabaseClosedError', ...getIndexedDbRecoveryBudgetSnapshot() },
          'retryable'
        );
      } else {
        return;
      }
    }
  }

  if (isOpening) {
    const waitOutcome = await waitForIndexedDbOpenResolution({
      isOpening: () => isOpening,
      isDbOpen: () => db.isOpen(),
      isUsingMock: () => isUsingMock,
    });
    if (waitOutcome === 'opened' || waitOutcome === 'mock') {
      return;
    }
    if (waitOutcome === 'stalled') {
      recordIndexedDbRecoveryNotice(
        'indexeddb_open_stalled',
        'La apertura de IndexedDB excedio el tiempo esperado; se activo fallback.',
        { waitedMs: 5000, ...getIndexedDbRecoveryBudgetSnapshot() },
        'recoverable'
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
        await sleep(retryDelay);
      }
    }

    if (!opened) {
      throw openError || new Error('IndexedDB open failed');
    }

    resetIndexedDbRecoveryTracking();
  } catch (error: unknown) {
    const { errorName, errorMessage } = resolveIndexedDbErrorDetails(error);

    recordIndexedDbRecoveryNotice(
      'indexeddb_initial_open_failed',
      'La apertura inicial de IndexedDB fallo; se intentara recuperacion automatica.',
      {
        errorName,
        errorMessage,
        ...getIndexedDbRecoveryBudgetSnapshot(),
      }
    );

    const isBackingStoreError = isIndexedDbBackingStoreError(error);

    if (shouldAttemptIndexedDbRecreation(errorName, isBackingStoreError)) {
      try {
        db.close();

        await runIndexedDbOperationWithTimeout(
          () => Dexie.delete('HangaRoaDB'),
          INDEXED_DB_DELETE_TIMEOUT_MS,
          'Deletion timeout'
        );

        db = new HangaRoaDatabase();
        attachDatabaseEvents(db);
        await tryOpenWithTimeout();

        isUsingMock = false;
        resetIndexedDbRecoveryTracking();
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

export const getLocalPersistenceRuntimeSnapshot = (): LocalPersistenceRuntimeSnapshot => ({
  indexedDbAvailable: isIndexedDBAvailable(),
  fallbackMode: isUsingMock,
  stickyFallbackMode,
  runtimeState: stickyFallbackMode ? 'blocked' : isUsingMock ? 'recoverable' : 'ok',
});

export { db as hospitalDB };
export { createMockDatabase } from './indexedDbMockFactory';
