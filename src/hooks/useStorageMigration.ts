/**
 * useStorageMigration Hook
 *
 * Handles migration from localStorage to IndexedDB on app startup.
 * Ensures data is preserved and backed up in IndexedDB.
 */

import { useState, useEffect, useMemo } from 'react';
import { isIndexedDBAvailable, migrateFromLocalStorage } from '@/services/storage/core';
import { createScopedLogger } from '@/services/utils/loggerScope';

interface MigrationState {
  isComplete: boolean;
  isMigrating: boolean;
  didMigrate: boolean;
  error: string | null;
}

interface UseStorageMigrationOptions {
  enabled?: boolean;
}

const storageMigrationLogger = createScopedLogger('useStorageMigration');

/**
 * Hook that runs storage migration on mount.
 * Returns migration status for UI feedback if needed.
 */
export const useStorageMigration = (options: UseStorageMigrationOptions = {}): MigrationState => {
  const { enabled = true } = options;
  const [state, setState] = useState<MigrationState>({
    isComplete: !enabled,
    isMigrating: enabled,
    didMigrate: false,
    error: null,
  });

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const runMigration = async () => {
      setState({
        isComplete: false,
        isMigrating: true,
        didMigrate: false,
        error: null,
      });

      // Check if IndexedDB is available
      if (!isIndexedDBAvailable()) {
        storageMigrationLogger.warn('IndexedDB not available, using localStorage only');
        setState({
          isComplete: true,
          isMigrating: false,
          didMigrate: false,
          error: null,
        });
        return;
      }

      try {
        // Run migration (will skip if already done)
        const didMigrate = await migrateFromLocalStorage();

        setState({
          isComplete: true,
          isMigrating: false,
          didMigrate,
          error: null,
        });
      } catch (error) {
        storageMigrationLogger.error('Storage migration failed', error);
        setState({
          isComplete: true,
          isMigrating: false,
          didMigrate: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    };

    runMigration();
  }, [enabled]);

  return useMemo(
    () =>
      enabled
        ? state
        : {
            isComplete: true,
            isMigrating: false,
            didMigrate: false,
            error: null,
          },
    [enabled, state]
  );
};
