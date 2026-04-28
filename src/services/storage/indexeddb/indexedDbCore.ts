import { createIndexedDbBackgroundRecoveryScheduler } from './indexedDbBackgroundRecoveryScheduler';
import { HangaRoaDatabase } from './indexedDbDatabase';
import {
  assignIndexedDbMockTables,
  createIndexedDbDatabaseOrFallback,
} from './indexedDbDatabaseLifecycle';
import { createMockDatabase } from './indexedDbMockFactory';
import { attachIndexedDbEvents } from './indexedDbBootstrap';
import {
  recoverIndexedDbInitialOpenRuntimeFailure,
  restoreIndexedDbFromMockFallback,
} from './indexedDbCoreRecovery';
import {
  recordIndexedDbRecoveryNotice,
  recordIndexedDbRecoveryFailure,
} from './indexedDbRecoveryController';
import {
  openIndexedDbWithRetries,
  runIndexedDbOperationWithTimeout,
  waitForIndexedDbOpenResolution,
} from './indexedDbCoreSupport';
import { resolveIndexedDbOpenHealth } from './indexedDbOpenHealthController';
import { resolveIndexedDbOpenWaitAction } from './indexedDbOpenWaitController';
import {
  INDEXED_DB_OPEN_TIMEOUT_MS,
  INDEXED_DB_RECOVERY_RETRY_DELAYS_MS,
  getIndexedDbRecoveryBudgetSnapshot,
} from './indexedDbRecoveryBudgets';
import {
  buildLocalPersistenceRuntimeSnapshot,
  hasE2ERuntimeOverride,
  shouldAttemptMockRecovery,
  shouldSkipReadyCheckForMock,
  type LocalPersistenceRuntimeSnapshot,
} from './indexedDbRuntimeModeController';

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

export type { LocalPersistenceRuntimeSnapshot };

export const ensureDbReady = async (options: EnsureDbReadyOptions = {}): Promise<void> => {
  const { allowRecoveryWhenMock = false } = options;

  if (hasE2ERuntimeOverride()) {
    isUsingMock = true;
    return;
  }

  if (shouldSkipReadyCheckForMock({ isUsingMock, allowRecoveryWhenMock })) return;
  if (shouldAttemptMockRecovery({ isUsingMock, allowRecoveryWhenMock, stickyFallbackMode })) {
    const recoveryOutcome = restoreIndexedDbFromMockFallback({
      currentDatabase: db,
      createDatabase: () => new HangaRoaDatabase(),
      attachDatabaseEvents,
      resetRecoveryTracking: resetIndexedDbRecoveryTracking,
      assignMockTables: assignIndexedDbMockTables,
      createMockDatabase,
      recordRecoveryFailure: recordIndexedDbRecoveryFailure,
    });

    db = recoveryOutcome.database;
    isUsingMock = recoveryOutcome.fallbackMode;

    if (recoveryOutcome.fallbackMode) {
      return;
    }
  }

  const openHealth = await resolveIndexedDbOpenHealth(db);
  if (openHealth === 'ready') {
    return;
  }

  if (openHealth === 'closed') {
    recordIndexedDbRecoveryNotice(
      'indexeddb_database_closed',
      'Se detecto cierre inesperado de IndexedDB; se intentara reabrir.',
      { errorName: 'DatabaseClosedError', ...getIndexedDbRecoveryBudgetSnapshot() },
      'retryable'
    );
  }

  if (isOpening) {
    const waitOutcome = await waitForIndexedDbOpenResolution({
      isOpening: () => isOpening,
      isDbOpen: () => db.isOpen(),
      isUsingMock: () => isUsingMock,
    });
    const waitAction = resolveIndexedDbOpenWaitAction(waitOutcome);
    if (waitAction === 'return') {
      return;
    }
    if (waitAction === 'fallback') {
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
    const recoveryOutcome = await recoverIndexedDbInitialOpenRuntimeFailure({
      error,
      database: db,
      attachDatabaseEvents,
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

export const getLocalPersistenceRuntimeSnapshot = (): LocalPersistenceRuntimeSnapshot =>
  buildLocalPersistenceRuntimeSnapshot({
    indexedDbAvailable: isIndexedDBAvailable(),
    isUsingMock,
    stickyFallbackMode,
  });

export { db as hospitalDB };
export { createMockDatabase } from './indexedDbMockFactory';
export { HangaRoaDatabase } from './indexedDbDatabase';
