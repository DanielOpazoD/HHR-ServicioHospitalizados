/**
 * Census Storage Service
 * Handles uploading and managing Census Excel files in Firebase Storage
 */

import { ref, uploadBytes, getDownloadURL, deleteObject, listAll } from 'firebase/storage';
import { storage, auth, firebaseReady } from '@/firebaseConfig';
import {
  createListYears,
  createListMonths,
  createListFilesInMonth,
  BaseStoredFile,
} from './baseStorageService';
import { isExpectedStorageLookupMiss } from './storageErrorPolicy';

// ============= Types =============

export type StoredCensusFile = BaseStoredFile;

// ============= Constants =============

const STORAGE_ROOT = 'censo-diario';

// ============= Helper Functions =============

/**
 * Generate file path for a Census Excel
 */
const generateCensusPath = (date: string): string => {
  const [year, month, day] = date.split('-'); // input date is YYYY-MM-DD
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
  // console.info(`[CensusStorage] Starting upload for ${date}...`);
  await firebaseReady;

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

  // console.info(`✅ [CensusStorage] Upload complete: ${filePath}`);
  return downloadUrl;
};

/**
 * Check if a Census file exists for a given date
 */
export const checkCensusExists = async (date: string): Promise<boolean> => {
  try {
    await firebaseReady;
    const [year, month, day] = date.split('-');
    const expectedFileName = `${day}-${month}-${year} - Censo Diario.xlsx`;
    const monthFolderRef = ref(storage, `${STORAGE_ROOT}/${year}/${month}`);
    const monthListing = await listAll(monthFolderRef);
    return monthListing.items.some(item => item.name === expectedFileName);
  } catch (error: unknown) {
    // Expected lookup misses (missing folder/file or blocked access in current auth context).
    if (isExpectedStorageLookupMiss(error)) {
      return false;
    }
    console.warn('[CensusStorage] Error checking file existence:', error);
    return false;
  }
};

/**
 * Delete a Census file from Storage
 */
export const deleteCensusFile = async (date: string): Promise<void> => {
  const filePath = generateCensusPath(date);
  const storageRef = ref(storage, filePath);
  await deleteObject(storageRef);
  // console.info(`🗑️ Census deleted: ${filePath}`);
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
export const listCensusFilesInMonth = createListFilesInMonth<StoredCensusFile>({
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
