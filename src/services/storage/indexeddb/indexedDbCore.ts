import Dexie from 'dexie';

import { createIndexedDbBackgroundRecoveryScheduler } from './indexedDbBackgroundRecoveryScheduler';
import { HangaRoaDatabase } from './indexedDbDatabase';
import {
  assignIndexedDbMockTables,
  createIndexedDbDatabaseOrFallback,
} from './indexedDbDatabaseLifecycle';
import { createMockDatabase } from './indexedDbMockFactory';
import { attachIndexedDbEvents } from './indexedDbBootstrap';
import { recoverIndexedDbInitialOpenFailure } from './indexedDbInitialOpenRecoveryController';
import {
  recordIndexedDbRecoveryNotice,
  recordIndexedDbRecoveryFailure,
} from './indexedDbRecoveryController';
import {
  isDatabaseClosedError,
  openIndexedDbWithRetries,
  runIndexedDbOperationWithTimeout,
  waitForIndexedDbOpenResolution,
} from './indexedDbCoreSupport';
import {
  INDEXED_DB_DELETE_TIMEOUT_MS,
  INDEXED_DB_OPEN_TIMEOUT_MS,
  INDEXED_DB_RECOVERY_RETRY_DELAYS_MS,
  getIndexedDbRecoveryBudgetSnapshot,
} from './indexedDbRecoveryBudgets';
import type { OperationalRuntimeState } from '@/services/observability/operationalRuntimeState';

let db: HangaRoaDatabase;
let isUsingMock = false;
let isOpening = false;
let onDatabaseRecreated: (() => void) | null = null;
let stickyFallbackMode = false;
const emittedIndexedDbWarnings = new Set<string>();

const backgroundRecoveryScheduler = createIndexedDbBackgroundRecoveryScheduler({
  getStickyFallbackMode: () => stickyFallbackMode,
  onRetry: () => {
    void ensureDbReady({ allowRecoveryWhenMock: true });
  },
});

const attachDatabaseEvents = (database: HangaRoaDatabase) =>
  attachIndexedDbEvents(
    database,
    () => ({ isUsingMock, stickyFallbackMode }),
    emittedIndexedDbWarnings
  );

const initializeDatabase = () => {
  const outcome = createIndexedDbDatabaseOrFallback({
    createDatabase: () => new HangaRoaDatabase(),
    createMockDatabase,
    attachDatabaseEvents,
  });

  db = outcome.database;
  isUsingMock = outcome.fallbackMode;
};

const resetIndexedDbRecoveryTracking = () => {
  stickyFallbackMode = false;
  backgroundRecoveryScheduler.reset();
  emittedIndexedDbWarnings.clear();
};

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
      assignIndexedDbMockTables(db, createMockDatabase());
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
    await openIndexedDbWithRetries({
      open: () =>
        runIndexedDbOperationWithTimeout(
          () => db.open(),
          INDEXED_DB_OPEN_TIMEOUT_MS,
          'IndexedDB open timeout'
        ),
      retryDelays: INDEXED_DB_RECOVERY_RETRY_DELAYS_MS,
    });

    resetIndexedDbRecoveryTracking();
  } catch (error: unknown) {
    const recoveryOutcome = await recoverIndexedDbInitialOpenFailure({
      error,
      database: db,
      closeDatabase: database => database.close(),
      deleteDatabase: () =>
        runIndexedDbOperationWithTimeout(
          () => Dexie.delete('HangaRoaDB'),
          INDEXED_DB_DELETE_TIMEOUT_MS,
          'Deletion timeout'
        ),
      createDatabase: () => new HangaRoaDatabase(),
      attachDatabaseEvents,
      openDatabase: database =>
        runIndexedDbOperationWithTimeout(
          () => database.open(),
          INDEXED_DB_OPEN_TIMEOUT_MS,
          'IndexedDB open timeout'
        ),
      activateMockFallback: () => {
        assignIndexedDbMockTables(db, createMockDatabase());
        return db;
      },
    });

    db = recoveryOutcome.database;
    isUsingMock = recoveryOutcome.fallbackMode;
    stickyFallbackMode = stickyFallbackMode || recoveryOutcome.stickyFallbackMode;

    if (recoveryOutcome.shouldResetRecoveryTracking) {
      resetIndexedDbRecoveryTracking();
    }

    if (recoveryOutcome.shouldNotifyDatabaseRecreated) {
      onDatabaseRecreated?.();
    }

    if (!recoveryOutcome.fallbackMode) {
      return;
    }

    if (recoveryOutcome.shouldScheduleBackgroundRecovery) {
      backgroundRecoveryScheduler.schedule();
    }
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
export { HangaRoaDatabase } from './indexedDbDatabase';
