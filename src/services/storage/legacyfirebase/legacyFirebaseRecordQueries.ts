import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';

import { parseDailyRecordWithDefaults } from '@/schemas/zodSchemas';
import { DailyRecord } from '@/types/domain/dailyRecord';

import { getLegacyDb } from './legacyFirebaseCore';
import {
  LEGACY_DISCOVERY_COLLECTION_PATHS,
  LEGACY_RECORD_COLLECTION_PATHS,
} from './legacyFirebasePaths';
import { logLegacyError, logLegacyInfo } from './legacyFirebaseLogger';
import { isLegacyReadBlocked } from './legacyFirebaseAccessPolicy';

export const getLegacyRecordsRange = async (
  startDate: string,
  endDate: string
): Promise<DailyRecord[]> => {
  if (isLegacyReadBlocked()) return [];

  const db = getLegacyDb();
  if (!db) return [];

  try {
    for (const collectionPath of LEGACY_RECORD_COLLECTION_PATHS) {
      try {
        const colRef = collection(db, collectionPath);
        const rangeQuery = query(
          colRef,
          where('date', '>=', startDate),
          where('date', '<=', endDate),
          orderBy('date', 'asc')
        );

        const snapshot = await getDocs(rangeQuery);
        if (!snapshot.empty) {
          logLegacyInfo(`[LegacyFirebase] Found ${snapshot.size} records in ${collectionPath}`);
          return snapshot.docs.map(docSnap =>
            parseDailyRecordWithDefaults(docSnap.data(), docSnap.id)
          );
        }
      } catch {
        // Ignore invalid/non-existing path and continue with next option.
      }
    }

    return [];
  } catch (error) {
    logLegacyError('[LegacyFirebase] Error reading legacy range:', error);
    return [];
  }
};

export const discoverLegacyDataPath = async (): Promise<string | null> => {
  if (isLegacyReadBlocked()) return null;

  const db = getLegacyDb();
  if (!db) return null;

  for (const path of LEGACY_DISCOVERY_COLLECTION_PATHS) {
    try {
      const colRef = collection(db, path);
      const q = query(colRef, orderBy('date', 'desc'));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        logLegacyInfo(`[LegacyFirebase] Discovered data path: ${path} (${snapshot.size} records)`);
        return path;
      }
    } catch {
      // Path not found or unsupported query index.
    }
  }

  logLegacyInfo('[LegacyFirebase] Could not discover any valid data path');
  return null;
};
