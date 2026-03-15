/**
 * Census Storage Service
 * Handles uploading and managing Census Excel files in Firebase Storage
 */

import { ref, uploadBytes, getDownloadURL, deleteObject, getMetadata } from 'firebase/storage';
import { auth, firebaseReady, getStorageInstance } from '@/firebaseConfig';
import {
  createListYears,
  createListMonths,
  createListFilesInMonth,
  createListFilesInMonthWithReport,
  BaseStoredFile,
} from './baseStorageService';
import {
  isExpectedStorageLookupMiss,
  shouldLogStorageError,
  classifyStorageError,
  resolveStorageLookupStatus,
  toStorageOperationalError,
} from './storageErrorPolicy';
import { isBackupDateValidationError, parseBackupDateParts } from './storageContracts';
import { measureStorageOperation } from './storageObservability';
import { assertStorageAvailable } from './storageAvailability';
import {
  createStorageLookupResult,
  type StorageLookupResult,
  withStorageLookupTimeout,
} from './storageLookupContracts';
import {
  recordOperationalErrorTelemetry,
  recordOperationalTelemetry,
} from '@/services/observability/operationalTelemetryService';

// ============= Types =============

export type StoredCensusFile = BaseStoredFile;

export type BackupStorageMutationStatus =
  | 'success'
  | 'permission_denied'
  | 'not_found'
  | 'invalid_date'
  | 'timeout'
  | 'unknown';

export type BackupStorageMutationResult<T = null> =
  | { status: 'success'; data: T }
  | { status: BackupStorageMutationStatus; error: unknown; data: null };
// ============= Constants =============

const STORAGE_ROOT = 'censo-diario';

// ============= Helper Functions =============

/**
 * Generate file path for a Census Excel
 */
const generateCensusPath = (date: string): string => {
  const { year, month, day } = parseBackupDateParts(date, 'CensusStorage');
  const formattedDate = `${day}-${month}-${year}`;
  const filename = `${formattedDate} - Censo Diario.xlsx`;
  return `${STORAGE_ROOT}/${year}/${month}/${filename}`;
};

/**
 * Parse file path to extract date
 */
const parseFilePath = (path: string): { date: string } | null => {
  // Check if path ends with "DD-MM-YYYY - Censo Diario.xlsx"
  const match = path.match(/(\d{2})-(\d{2})-(\d{4}) - Censo Diario\.xlsx$/);
  if (match) {
    return {
      date: `${match[3]}-${match[2]}-${match[1]}`, // Convert back to YYYY-MM-DD
    };
  }
  return null;
};

// ============= Core Functions =============

/**
 * Upload a Census Excel to Firebase Storage
 */
export const uploadCensus = async (excelBlob: Blob, date: string): Promise<string> => {
  const result = await uploadCensusWithResult(excelBlob, date);
  if (result.status !== 'success') {
    throw result.error;
  }
  return result.data as string;
};

export const uploadCensusWithResult = async (
  excelBlob: Blob,
  date: string
): Promise<BackupStorageMutationResult<string>> => {
  try {
    await firebaseReady;
    const storage = await getStorageInstance();
    assertStorageAvailable(storage, 'CensusStorage', 'uploadCensus');

    const filePath = generateCensusPath(date);
    const storageRef = ref(storage, filePath);

    const user = auth.currentUser;
    const metadata = {
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      customMetadata: {
        date,
        uploadedBy: user?.email || 'unknown',
        uploadedAt: new Date().toISOString(),
      },
    };

    await uploadBytes(storageRef, excelBlob, metadata);
    const downloadUrl = await getDownloadURL(storageRef);

    return { status: 'success', data: downloadUrl };
  } catch (error) {
    if (isBackupDateValidationError(error)) {
      return { status: 'invalid_date', error, data: null };
    }

    const category = classifyStorageError(error);
    return {
      status:
        category === 'permission_denied'
          ? 'permission_denied'
          : category === 'not_found'
            ? 'not_found'
            : category === 'timeout'
              ? 'timeout'
              : 'unknown',
      error,
      data: null,
    };
  }
};

/**
 * Check if a Census file exists for a given date
 */
export const checkCensusExists = async (date: string): Promise<boolean> => {
  const result = await checkCensusExistsDetailed(date);
  return result.exists;
};

export const checkCensusExistsDetailed = async (date: string): Promise<StorageLookupResult> => {
  const TIMEOUT_MS = 4000;
  const checkPromise = measureStorageOperation(
    'censusExists',
    async (): Promise<StorageLookupResult> => {
      try {
        await firebaseReady;
        const storage = await getStorageInstance();

        const storageRef = ref(storage, generateCensusPath(date));
        await getMetadata(storageRef);
        return createStorageLookupResult(true, 'available');
      } catch (error: unknown) {
        // Expected lookup misses (missing file or blocked access in current auth context).
        if (isExpectedStorageLookupMiss(error) || isBackupDateValidationError(error)) {
          return createStorageLookupResult(
            false,
            resolveStorageLookupStatus(error, {
              invalidDate: isBackupDateValidationError(error),
            })
          );
        }
        if (shouldLogStorageError(error)) {
          recordOperationalErrorTelemetry(
            'backup',
            'census_exists_detailed',
            error,
            toStorageOperationalError(error, {
              code: 'census_exists_lookup_failed',
              message: `No fue posible verificar el censo ${date}.`,
              context: { date },
              userSafeMessage: 'No fue posible verificar la disponibilidad del censo.',
            }),
            { context: { date } }
          );
        }
        return createStorageLookupResult(false, resolveStorageLookupStatus(error));
      }
    },
    { context: date }
  );

  return withStorageLookupTimeout(checkPromise, TIMEOUT_MS, () => {
    recordOperationalTelemetry({
      category: 'backup',
      operation: 'census_exists_timeout',
      status: 'degraded',
      date,
      issues: ['La verificacion del censo excedio el tiempo esperado.'],
    });
  });
};

/**
 * Delete a Census file from Storage
 */
export const deleteCensusFile = async (date: string): Promise<void> => {
  const result = await deleteCensusFileWithResult(date);
  if (
    result.status !== 'success' &&
    result.status !== 'not_found' &&
    result.status !== 'invalid_date'
  ) {
    throw result.error;
  }
};

export const deleteCensusFileWithResult = async (
  date: string
): Promise<BackupStorageMutationResult> => {
  await firebaseReady;
  const storage = await getStorageInstance();
  let filePath: string;
  try {
    filePath = generateCensusPath(date);
  } catch (error) {
    if (isBackupDateValidationError(error)) {
      return { status: 'invalid_date', error, data: null };
    }
    return { status: 'unknown', error, data: null };
  }
  const storageRef = ref(storage, filePath);
  try {
    await deleteObject(storageRef);
    return { status: 'success', data: null };
  } catch (error: unknown) {
    if (isExpectedStorageLookupMiss(error)) {
      const category = classifyStorageError(error);
      return {
        status: category === 'permission_denied' ? 'permission_denied' : 'not_found',
        error,
        data: null,
      };
    }
    return { status: 'unknown', error, data: null };
  }
};

/**
 * List all years with Census files (using base service)
 */
export const listCensusYears = createListYears(STORAGE_ROOT);

/**
 * List all months in a year for Census (using base service)
 */
export const listCensusMonths = createListMonths(STORAGE_ROOT);

/**
 * List all Census files in a month (using base service)
 * Note: Display name is normalized to format (DD-MM-YYYY - Censo Diario.xlsx)
 */
export const listCensusFilesInMonth = createListFilesInMonth<StoredCensusFile, { date: string }>({
  storageRoot: STORAGE_ROOT,
  parseFilePath,
  mapToFile: (item, metadata, downloadUrl, parsed) => {
    // Generate normalized display name from parsed date
    const [year, month, day] = parsed.date.split('-');
    const displayName = `${day}-${month}-${year} - Censo Diario.xlsx`;

    return {
      name: displayName, // Always use normalized format for display
      fullPath: item.fullPath,
      downloadUrl,
      date: parsed.date,
      createdAt: metadata.customMetadata?.uploadedAt || metadata.timeCreated,
      size: metadata.size,
    };
  },
});

export const listCensusFilesInMonthWithReport = createListFilesInMonthWithReport<
  StoredCensusFile,
  { date: string }
>({
  storageRoot: STORAGE_ROOT,
  parseFilePath,
  mapToFile: (item, metadata, downloadUrl, parsed) => {
    const [year, month, day] = parsed.date.split('-');
    const displayName = `${day}-${month}-${year} - Censo Diario.xlsx`;

    return {
      name: displayName,
      fullPath: item.fullPath,
      downloadUrl,
      date: parsed.date,
      createdAt: metadata.customMetadata?.uploadedAt || metadata.timeCreated,
      size: metadata.size,
    };
  },
});
