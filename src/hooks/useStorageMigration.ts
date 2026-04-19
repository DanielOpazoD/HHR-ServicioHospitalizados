/**
 * useStorageMigration Hook
 *
 * Handles migration from localStorage to IndexedDB on app startup.
 * Ensures data is preserved and backed up in IndexedDB.
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import { isIndexedDBAvailable } from '@/services/storage/indexeddb/indexedDbCore';
import { migrateFromLocalStorage } from '@/services/storage/indexeddb/indexedDbMigrationService';
import { storageMigrationLogger } from '@/hooks/hookLoggers';

interface MigrationState {
  isComplete: boolean;
  isMigrating: boolean;
  didMigrate: boolean;
  error: string | null;
}

interface UseStorageMigrationOptions {
  enabled?: boolean;
}

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
  const isMountedRef = useRef(true);
  const migrationRequestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const requestId = ++migrationRequestIdRef.current;
    let cancelled = false;

    const isStale = () =>
      cancelled || !isMountedRef.current || requestId !== migrationRequestIdRef.current;

    const runMigration = async () => {
      if (isStale()) {
        return;
      }

      setState({
        isComplete: false,
        isMigrating: true,
        didMigrate: false,
        error: null,
      });

      // Check if IndexedDB is available
      if (!isIndexedDBAvailable()) {
        storageMigrationLogger.warn('IndexedDB not available, using localStorage only');
        if (isStale()) {
          return;
        }
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

        if (isStale()) {
          return;
        }

        setState({
          isComplete: true,
          isMigrating: false,
          didMigrate,
          error: null,
        });
      } catch (error) {
        storageMigrationLogger.error('Storage migration failed', error);
        if (isStale()) {
          return;
        }
        setState({
          isComplete: true,
          isMigrating: false,
          didMigrate: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    };

    void runMigration();

    return () => {
      cancelled = true;
    };
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
