import { doc, getDoc } from 'firebase/firestore';

import { parseDailyRecordWithDefaults } from '@/schemas/zodSchemas';
import { DailyRecord } from '@/types/domain/dailyRecord';

import { getLegacyDb } from './legacyFirebaseCore';
import {
  cacheLegacyDeniedPath,
  cacheLegacyMissingDate,
  clearLegacyMissingDate,
  isLegacyDateCachedMissing,
  isLegacyPathDenied,
  isLegacyReadBlocked,
  registerLegacyPermissionDeniedBlock,
} from './legacyFirebaseAccessPolicy';
import { LEGACY_RECORD_DOC_PATHS } from './legacyFirebasePaths';
import {
  isLegacyPermissionDeniedError,
  logLegacyError,
  logLegacyInfo,
} from './legacyFirebaseLogger';

const getLegacyRecordFromKnownPaths = async (
  date: string,
  possiblePaths: string[]
): Promise<DailyRecord | null> => {
  const db = getLegacyDb();
  if (!db) return null;

  for (const path of possiblePaths) {
    if (isLegacyPathDenied(path)) continue;

    try {
      logLegacyInfo(`[LegacyFirebase] Testing path: ${path}`);
      const docRef = doc(db, path);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        logLegacyInfo(`[LegacyFirebase] Found record at: ${path}`);
        clearLegacyMissingDate(date);
        return parseDailyRecordWithDefaults(docSnap.data(), date);
      }
    } catch (error) {
      if (isLegacyPermissionDeniedError(error)) {
        cacheLegacyDeniedPath(path);
        registerLegacyPermissionDeniedBlock();
        return null;
      }
      logLegacyError(`[LegacyFirebase] Error testing path ${path}:`, error);
    }
  }

  return null;
};

export const getLegacyRecord = async (date: string): Promise<DailyRecord | null> => {
  if (isLegacyReadBlocked() || isLegacyDateCachedMissing(date)) {
    return null;
  }

  const db = getLegacyDb();
  if (!db) {
    logLegacyInfo('[LegacyFirebase] No connection available');
    return null;
  }

  try {
    const record = await getLegacyRecordFromKnownPaths(date, LEGACY_RECORD_DOC_PATHS(date));
    if (record) {
      return record;
    }

    logLegacyInfo(`[LegacyFirebase] No legacy record found for ${date}`);
    cacheLegacyMissingDate(date);
    return null;
  } catch (error) {
    logLegacyError('[LegacyFirebase] Error reading legacy record:', error);
    return null;
  }
};
