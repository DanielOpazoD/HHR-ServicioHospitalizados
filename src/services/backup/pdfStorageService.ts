/**
 * PDF Storage Service
 * Handles uploading and managing PDF files in Firebase Storage
 *
 * Storage structure:
 * entregas-enfermeria/
 *   2026/
 *     01/
 *       2026-01-03_turno-largo.pdf
 *       2026-01-03_turno-noche.pdf
 */

import { ref, uploadBytes, getDownloadURL, deleteObject, getMetadata } from 'firebase/storage';
import { defaultBackupStorageRuntime } from '@/services/firebase-runtime/backupRuntime';
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
import { createScopedLogger } from '@/services/utils/loggerScope';

// ============= Types =============

export interface StoredPdfFile extends BaseStoredFile {
  shiftType: 'day' | 'night';
}

export interface PdfFolder {
  name: string;
  path: string;
  type: 'year' | 'month';
  children?: PdfFolder[];
  fileCount?: number;
}

// ============= Constants =============

const STORAGE_ROOT = 'entregas-enfermeria';
const pdfStorageLogger = createScopedLogger('PdfStorage');

// ============= Helper Functions =============

/**
 * Generate file path for a PDF
 */
const generatePdfPath = (date: string, shiftType: 'day' | 'night'): string => {
  const { year, month, day } = parseBackupDateParts(date, 'PdfStorage');
  const shiftLabel = shiftType === 'day' ? 'Largo' : 'Noche';
  const formattedDate = `${day}-${month}-${year}`;
  const filename = `${formattedDate} - Turno ${shiftLabel}.pdf`;
  return `${STORAGE_ROOT}/${year}/${month}/${filename}`;
};

/**
 * Parse file path to extract metadata
 */
const parseFilePath = (path: string): { date: string; shiftType: 'day' | 'night' } | null => {
  // Try new format: DD-MM-YYYY - Turno Largo.pdf
  const newMatch = path.match(/(\d{2})-(\d{2})-(\d{4}) - Turno (Largo|Noche)\.pdf$/);
  if (newMatch) {
    return {
      date: `${newMatch[3]}-${newMatch[2]}-${newMatch[1]}`, // Convert back to YYYY-MM-DD
      shiftType: newMatch[4] === 'Largo' ? 'day' : 'night',
    };
  }

  // Fallback to old format: YYYY-MM-DD_turno-largo.pdf
  const oldMatch = path.match(/(\d{4}-\d{2}-\d{2})_(turno-largo|turno-noche)\.pdf$/);
  if (oldMatch) {
    return {
      date: oldMatch[1],
      shiftType: oldMatch[2] === 'turno-largo' ? 'day' : 'night',
    };
  }

  // console.warn(`[PdfStorage] 🔍 Failed to parse path: "${path}"`);
  return null;
};

// ============= Core Functions =============

/**
 * Upload a PDF to Firebase Storage
 */
export const uploadPdf = async (
  pdfBlob: Blob,
  date: string,
  shiftType: 'day' | 'night'
): Promise<string> => {
  pdfStorageLogger.debug(`Starting PDF upload for ${date}`);
  await defaultBackupStorageRuntime.ready;
  const storage = await defaultBackupStorageRuntime.getStorage();
  assertStorageAvailable(storage, 'PdfStorage', 'uploadPdf');

  const filePath = generatePdfPath(date, shiftType);
  const storageRef = ref(storage, filePath);

  const user = defaultBackupStorageRuntime.auth.currentUser;
  const metadata = {
    contentType: 'application/pdf',
    customMetadata: {
      date,
      shiftType,
      uploadedBy: user?.email || 'unknown',
      uploadedAt: new Date().toISOString(),
    },
  };

  await uploadBytes(storageRef, pdfBlob, metadata);
  const downloadUrl = await getDownloadURL(storageRef);

  pdfStorageLogger.debug(`PDF upload complete: ${filePath}`);
  return downloadUrl;
};

/**
 * Delete a PDF from Storage
 */
export const deletePdf = async (date: string, shiftType: 'day' | 'night'): Promise<void> => {
  await defaultBackupStorageRuntime.ready;
  const storage = await defaultBackupStorageRuntime.getStorage();
  let filePath: string;
  try {
    filePath = generatePdfPath(date, shiftType);
  } catch (error) {
    if (isBackupDateValidationError(error)) return;
    throw error;
  }
  const storageRef = ref(storage, filePath);
  try {
    await deleteObject(storageRef);
    pdfStorageLogger.debug(`PDF deleted: ${filePath}`);
  } catch (error: unknown) {
    if (isExpectedStorageLookupMiss(error)) {
      return;
    }
    throw error;
  }
};

/**
 * Get download URL for a PDF
 */
export const getPdfUrl = async (
  date: string,
  shiftType: 'day' | 'night'
): Promise<string | null> => {
  await defaultBackupStorageRuntime.ready;
  const storage = await defaultBackupStorageRuntime.getStorage();
  try {
    const filePath = generatePdfPath(date, shiftType);
    const storageRef = ref(storage, filePath);
    return await getDownloadURL(storageRef);
  } catch (error: unknown) {
    if (isExpectedStorageLookupMiss(error) || isBackupDateValidationError(error)) {
      return null;
    }
    throw error;
  }
};

/**
 * Check if a PDF exists
 */
export const pdfExists = async (date: string, shiftType: 'day' | 'night'): Promise<boolean> => {
  const result = await pdfExistsDetailed(date, shiftType);
  return result.exists;
};

export const pdfExistsDetailed = async (
  date: string,
  shiftType: 'day' | 'night'
): Promise<StorageLookupResult> => {
  pdfStorageLogger.debug(`Checking PDF existence: ${date} ${shiftType}`);

  const TIMEOUT_MS = 4000;
  const checkPromise = measureStorageOperation(
    'pdfExists',
    async (): Promise<StorageLookupResult> => {
      try {
        await defaultBackupStorageRuntime.ready;
        const storage = await defaultBackupStorageRuntime.getStorage();

        const filePath = generatePdfPath(date, shiftType);
        const storageRef = ref(storage, filePath);

        await getMetadata(storageRef);
        pdfStorageLogger.debug(`Found PDF: ${filePath}`);
        return createStorageLookupResult(true, 'available');
      } catch (error: unknown) {
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
            'pdf_exists_detailed',
            error,
            toStorageOperationalError(error, {
              code: 'pdf_exists_lookup_failed',
              message: `No fue posible verificar el PDF ${date}/${shiftType}.`,
              context: { date, shiftType },
              userSafeMessage: 'No fue posible verificar la disponibilidad del PDF.',
            }),
            { context: { date, shiftType } }
          );
        }
        return createStorageLookupResult(false, resolveStorageLookupStatus(error));
      }
    },
    { context: `${date}:${shiftType}` }
  );

  return withStorageLookupTimeout(checkPromise, TIMEOUT_MS, () => {
    recordOperationalTelemetry({
      category: 'backup',
      operation: 'pdf_exists_timeout',
      status: 'degraded',
      date,
      issues: ['La verificacion del PDF excedio el tiempo esperado.'],
      context: { shiftType },
    });
  });
};

/**
 * List all years with PDFs (using base service)
 */
export const listYears = createListYears(STORAGE_ROOT);

/**
 * List all months in a year (using base service)
 */
export const listMonths = createListMonths(STORAGE_ROOT);

/**
 * List all files in a month (using base service)
 */
export const listFilesInMonth = createListFilesInMonth<
  StoredPdfFile,
  { date: string; shiftType: 'day' | 'night' }
>({
  storageRoot: STORAGE_ROOT,
  parseFilePath,
  mapToFile: (item, metadata, downloadUrl, parsed) => {
    return {
      name: item.name,
      fullPath: item.fullPath,
      downloadUrl,
      date: parsed.date,
      shiftType: parsed.shiftType,
      createdAt: metadata.customMetadata?.uploadedAt || metadata.timeCreated,
      size: metadata.size,
    };
  },
});

export const listFilesInMonthWithReport = createListFilesInMonthWithReport<
  StoredPdfFile,
  { date: string; shiftType: 'day' | 'night' }
>({
  storageRoot: STORAGE_ROOT,
  parseFilePath,
  mapToFile: (item, metadata, downloadUrl, parsed) => ({
    name: item.name,
    fullPath: item.fullPath,
    downloadUrl,
    date: parsed.date,
    shiftType: parsed.shiftType,
    createdAt: metadata.customMetadata?.uploadedAt || metadata.timeCreated,
    size: metadata.size,
  }),
});

/**
 * Get folder structure for navigation
 */
export const getFolderStructure = async (): Promise<PdfFolder[]> => {
  const years = await listYears();

  const structure: PdfFolder[] = [];

  for (const year of years) {
    const months = await listMonths(year);
    structure.push({
      name: year,
      path: `${STORAGE_ROOT}/${year}`,
      type: 'year',
      children: months.map(m => ({
        name: m.name,
        path: `${STORAGE_ROOT}/${year}/${m.number}`,
        type: 'month' as const,
      })),
    });
  }

  return structure;
};
