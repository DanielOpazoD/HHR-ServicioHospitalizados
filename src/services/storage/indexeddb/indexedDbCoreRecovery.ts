import Dexie from 'dexie';

import { HangaRoaDatabase } from './indexedDbDatabase';
import { assignIndexedDbMockTables } from './indexedDbDatabaseLifecycle';
import { createMockDatabase } from './indexedDbMockFactory';
import type { IndexedDbDatabaseLike } from './indexedDbContracts';
import {
  INDEXED_DB_DELETE_TIMEOUT_MS,
  INDEXED_DB_OPEN_TIMEOUT_MS,
} from './indexedDbRecoveryBudgets';
import { recoverIndexedDbInitialOpenFailure } from './indexedDbInitialOpenRecoveryController';
import { runIndexedDbOperationWithTimeout } from './indexedDbCoreSupport';

type CloseableIndexedDbDatabase = IndexedDbDatabaseLike & {
  close(): void;
};

interface RestoreIndexedDbFromMockFallbackOptions<Database extends IndexedDbDatabaseLike> {
  currentDatabase: Database;
  createDatabase: () => Database;
  attachDatabaseEvents: (database: Database) => void;
  resetRecoveryTracking: () => void;
  assignMockTables: (database: Database, mockDatabase: IndexedDbDatabaseLike) => void;
  createMockDatabase: () => IndexedDbDatabaseLike;
  recordRecoveryFailure: (error: unknown) => void;
}

interface RestoreIndexedDbFromMockFallbackOutcome<Database extends IndexedDbDatabaseLike> {
  database: Database;
  fallbackMode: boolean;
}

export const restoreIndexedDbFromMockFallback = <Database extends IndexedDbDatabaseLike>({
  currentDatabase,
  createDatabase,
  attachDatabaseEvents,
  resetRecoveryTracking,
  assignMockTables,
  createMockDatabase,
  recordRecoveryFailure,
}: RestoreIndexedDbFromMockFallbackOptions<Database>): RestoreIndexedDbFromMockFallbackOutcome<Database> => {
  try {
    const database = createDatabase();
    attachDatabaseEvents(database);
    resetRecoveryTracking();

    return {
      database,
      fallbackMode: false,
    };
  } catch (error) {
    recordRecoveryFailure(error);
    assignMockTables(currentDatabase, createMockDatabase());

    return {
      database: currentDatabase,
      fallbackMode: true,
    };
  }
};

interface RecoverIndexedDbInitialOpenRuntimeFailureOptions<
  Database extends CloseableIndexedDbDatabase,
> {
  error: unknown;
  database: Database;
  attachDatabaseEvents: (database: Database) => void;
  closeDatabase?: (database: Database) => void;
  deleteDatabase?: () => Promise<unknown>;
  createDatabase?: () => Database;
  openDatabase?: (database: Database) => Promise<unknown>;
  activateMockFallback?: () => Database;
}

export const recoverIndexedDbInitialOpenRuntimeFailure = async <
  Database extends CloseableIndexedDbDatabase,
>({
  error,
  database,
  attachDatabaseEvents,
  closeDatabase = activeDatabase => activeDatabase.close(),
  deleteDatabase = () =>
    runIndexedDbOperationWithTimeout(
      () => Dexie.delete('HangaRoaDB'),
      INDEXED_DB_DELETE_TIMEOUT_MS,
      'Deletion timeout'
    ),
  createDatabase = () => new HangaRoaDatabase() as unknown as Database,
  openDatabase = activeDatabase =>
    runIndexedDbOperationWithTimeout(
      () => activeDatabase.open(),
      INDEXED_DB_OPEN_TIMEOUT_MS,
      'IndexedDB open timeout'
    ),
  activateMockFallback = () => {
    assignIndexedDbMockTables(database, createMockDatabase());
    return database;
  },
}: RecoverIndexedDbInitialOpenRuntimeFailureOptions<Database>) =>
  recoverIndexedDbInitialOpenFailure({
    error,
    database,
    closeDatabase,
    deleteDatabase,
    createDatabase,
    attachDatabaseEvents,
    openDatabase,
    activateMockFallback,
  });
