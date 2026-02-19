/**
 * Base Storage Service
 * Shared utilities and factory functions for Firebase Storage services
 *
 * This module provides:
 * - Common constants (MONTH_NAMES)
 * - Generic factory functions for listing years, months, and files
 * - Shared types for stored files
 */

import {
  ref,
  listAll,
  getDownloadURL,
  getMetadata,
  StorageReference,
  FullMetadata,
} from 'firebase/storage';
import { storage, firebaseReady } from '@/firebaseConfig';
import {
  isExpectedStorageLookupMiss,
  shouldLogStorageError,
} from '@/services/backup/storageErrorPolicy';
import { measureStorageOperation } from '@/services/backup/storageObservability';

// ============= Types =============

export interface MonthInfo {
  number: string;
  name: string;
}

export interface BaseStoredFile {
  name: string;
  fullPath: string;
  downloadUrl: string;
  date: string;
  createdAt: string;
  size: number;
}

export interface ListFilesConfig<T, TParsed extends { date: string } = { date: string }> {
  storageRoot: string;
  parseFilePath: (path: string) => TParsed | null;
  mapToFile: (
    item: StorageReference,
    metadata: FullMetadata,
    downloadUrl: string,
    parsed: TParsed
  ) => T;
}

// ============= Constants =============

export const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

// ============= Default Timeouts =============

const DEFAULT_LIST_TIMEOUT_MS = 5000;
const DEFAULT_FILES_TIMEOUT_MS = 15000;
const DEFAULT_FILE_INFO_CONCURRENCY = 6;

const mapWithConcurrency = async <TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  mapper: (item: TInput, index: number) => Promise<TOutput>
): Promise<TOutput[]> => {
  if (items.length === 0) return [];
  const workers = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array<TOutput>(items.length);
  let cursor = 0;

  const runWorker = async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  };

  await Promise.all(Array.from({ length: workers }, () => runWorker()));
  return results;
};

// ============= Factory Functions =============

/**
 * Creates a function to list all years in a storage root
 */
export const createListYears = (storageRoot: string) => {
  return async (): Promise<string[]> => {
    try {
      await firebaseReady;
      if (!storage) return [];

      const timeoutPromise = new Promise<string[]>(resolve =>
        setTimeout(() => resolve([]), DEFAULT_LIST_TIMEOUT_MS)
      );

      const listPromise = measureStorageOperation(
        'listStorageYears',
        async () => {
          const rootRef = ref(storage, storageRoot);
          const result = await listAll(rootRef);
          return result.prefixes.map(p => p.name).sort((a, b) => b.localeCompare(a));
        },
        { context: storageRoot }
      );

      return await Promise.race([listPromise, timeoutPromise]);
    } catch (error: unknown) {
      if (isExpectedStorageLookupMiss(error)) {
        return [];
      }
      if (shouldLogStorageError(error)) {
        console.warn(`[BaseStorage] Error listing years for ${storageRoot}:`, error);
      }
      return [];
    }
  };
};

/**
 * Creates a function to list all months in a year
 */
export const createListMonths = (storageRoot: string) => {
  return async (year: string): Promise<MonthInfo[]> => {
    try {
      await firebaseReady;
      if (!storage) return [];

      const timeoutPromise = new Promise<MonthInfo[]>(resolve =>
        setTimeout(() => resolve([]), DEFAULT_LIST_TIMEOUT_MS)
      );

      const listPromise = measureStorageOperation(
        'listStorageMonths',
        async () => {
          const yearRef = ref(storage, `${storageRoot}/${year}`);
          const result = await listAll(yearRef);
          return result.prefixes
            .map(p => ({
              number: p.name,
              name: MONTH_NAMES[parseInt(p.name) - 1] || p.name,
            }))
            .sort((a, b) => b.number.localeCompare(a.number));
        },
        { context: `${storageRoot}/${year}` }
      );

      return await Promise.race([listPromise, timeoutPromise]);
    } catch (error: unknown) {
      if (isExpectedStorageLookupMiss(error)) {
        return [];
      }
      if (shouldLogStorageError(error)) {
        console.warn(`[BaseStorage] Error listing months for ${storageRoot}/${year}:`, error);
      }
      return [];
    }
  };
};

/**
 * Creates a function to list all files in a month
 */
export const createListFilesInMonth = <
  T extends BaseStoredFile,
  TParsed extends { date: string } = { date: string },
>(
  config: ListFilesConfig<T, TParsed>
) => {
  return async (year: string, month: string): Promise<T[]> => {
    const fullStoragePath = `${config.storageRoot}/${year}/${month}`;
    try {
      await firebaseReady;
      if (!storage) return [];

      const timeoutPromise = new Promise<T[]>(resolve =>
        setTimeout(() => {
          console.warn(`[BaseStorage] ⏱️ Timeout reached for ${fullStoragePath}`);
          resolve([]);
        }, DEFAULT_FILES_TIMEOUT_MS)
      );

      const listPromise = measureStorageOperation(
        'listStorageFilesInMonth',
        async () => {
          const monthRef = ref(storage, fullStoragePath);
          const result = await listAll(monthRef);

          if (result.items.length === 0) {
            return [];
          }

          // console.debug(`[BaseStorage] 🔍 Found ${result.items.length} items in ${fullStoragePath}, fetching metadata in parallel...`);

          const filesWithNulls = await mapWithConcurrency(
            result.items,
            DEFAULT_FILE_INFO_CONCURRENCY,
            async item => {
              try {
                const [metadata, downloadUrl] = await Promise.all([
                  getMetadata(item),
                  getDownloadURL(item),
                ]);

                const parsed = config.parseFilePath(item.fullPath);

                if (parsed) {
                  return config.mapToFile(item, metadata, downloadUrl, parsed);
                } else {
                  console.warn(`[BaseStorage] ⚠️ File skipped (failed parsing): ${item.fullPath}`);
                  return null;
                }
              } catch (error: unknown) {
                if (isExpectedStorageLookupMiss(error)) {
                  return null;
                }
                if (shouldLogStorageError(error)) {
                  console.error(`[BaseStorage] ‼️ Error getting file info: ${item.name}`, error);
                }
                return null;
              }
            }
          );
          const files = filesWithNulls.filter(f => f !== null) as T[];
          return files.sort((a, b) => b.date.localeCompare(a.date));
        },
        { context: fullStoragePath }
      );

      return await Promise.race([listPromise, timeoutPromise]);
    } catch (error: unknown) {
      if (isExpectedStorageLookupMiss(error)) {
        return [];
      }
      if (shouldLogStorageError(error)) {
        console.warn(`[BaseStorage] Error listing files for ${fullStoragePath}:`, error);
      }
      return [];
    }
  };
};

/**
 * Utility: Format bytes to human-readable size
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i)) + ' ' + sizes[i];
};
