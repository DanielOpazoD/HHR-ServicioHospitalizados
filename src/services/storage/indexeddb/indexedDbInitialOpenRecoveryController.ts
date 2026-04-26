import { getIndexedDbRecoveryBudgetSnapshot } from './indexedDbRecoveryBudgets';
import {
  isIndexedDbBackingStoreError,
  shouldUseStickyIndexedDbFallback,
} from './indexedDbRecoveryPolicy';
import {
  resolveIndexedDbErrorDetails,
  shouldAttemptIndexedDbRecreation,
} from './indexedDbCoreSupport';
import {
  recordIndexedDbFallbackMode,
  recordIndexedDbRecoveryFailure,
  recordIndexedDbRecoveryNotice,
} from './indexedDbRecoveryController';

export interface IndexedDbInitialOpenRecoveryOutcome<TDatabase> {
  database: TDatabase;
  fallbackMode: boolean;
  stickyFallbackMode: boolean;
  shouldNotifyDatabaseRecreated: boolean;
  shouldResetRecoveryTracking: boolean;
  shouldScheduleBackgroundRecovery: boolean;
}

export interface IndexedDbInitialOpenRecoveryOptions<TDatabase> {
  error: unknown;
  database: TDatabase;
  closeDatabase: (database: TDatabase) => void;
  deleteDatabase: () => Promise<unknown>;
  createDatabase: () => TDatabase;
  attachDatabaseEvents: (database: TDatabase) => void;
  openDatabase: (database: TDatabase) => Promise<unknown>;
  activateMockFallback: () => TDatabase;
  getBudgetSnapshot?: () => object;
  shouldUseStickyFallback?: (error: unknown) => boolean;
  recordRecoveryNotice?: typeof recordIndexedDbRecoveryNotice;
  recordRecoveryFailure?: typeof recordIndexedDbRecoveryFailure;
  recordFallbackMode?: typeof recordIndexedDbFallbackMode;
}

export const recoverIndexedDbInitialOpenFailure = async <TDatabase>({
  error,
  database,
  closeDatabase,
  deleteDatabase,
  createDatabase,
  attachDatabaseEvents,
  openDatabase,
  activateMockFallback,
  getBudgetSnapshot = getIndexedDbRecoveryBudgetSnapshot,
  shouldUseStickyFallback = shouldUseStickyIndexedDbFallback,
  recordRecoveryNotice = recordIndexedDbRecoveryNotice,
  recordRecoveryFailure = recordIndexedDbRecoveryFailure,
  recordFallbackMode = recordIndexedDbFallbackMode,
}: IndexedDbInitialOpenRecoveryOptions<TDatabase>): Promise<
  IndexedDbInitialOpenRecoveryOutcome<TDatabase>
> => {
  const { errorName, errorMessage } = resolveIndexedDbErrorDetails(error);
  const budgetSnapshot: Record<string, unknown> = { ...getBudgetSnapshot() };

  recordRecoveryNotice(
    'indexeddb_initial_open_failed',
    'La apertura inicial de IndexedDB fallo; se intentara recuperacion automatica.',
    {
      errorName,
      errorMessage,
      ...budgetSnapshot,
    }
  );

  const isBackingStoreError = isIndexedDbBackingStoreError(error);

  if (shouldAttemptIndexedDbRecreation(errorName, isBackingStoreError)) {
    try {
      closeDatabase(database);
      await deleteDatabase();

      const recreatedDatabase = createDatabase();
      attachDatabaseEvents(recreatedDatabase);
      await openDatabase(recreatedDatabase);

      return {
        database: recreatedDatabase,
        fallbackMode: false,
        stickyFallbackMode: false,
        shouldNotifyDatabaseRecreated: true,
        shouldResetRecoveryTracking: true,
        shouldScheduleBackgroundRecovery: false,
      };
    } catch (recoveryError) {
      recordRecoveryFailure(recoveryError);
      recordFallbackMode(errorName, errorMessage || 'IndexedDB fallback activated', budgetSnapshot);
      const mockDatabase = activateMockFallback();

      return {
        database: mockDatabase,
        fallbackMode: true,
        stickyFallbackMode: shouldUseStickyFallback(recoveryError),
        shouldNotifyDatabaseRecreated: false,
        shouldResetRecoveryTracking: false,
        shouldScheduleBackgroundRecovery: true,
      };
    }
  }

  recordFallbackMode(errorName, errorMessage || 'IndexedDB fallback activated', budgetSnapshot);

  return {
    database: activateMockFallback(),
    fallbackMode: true,
    stickyFallbackMode: shouldUseStickyFallback(error),
    shouldNotifyDatabaseRecreated: false,
    shouldResetRecoveryTracking: false,
    shouldScheduleBackgroundRecovery: true,
  };
};
