import { doc, onSnapshot } from 'firebase/firestore';

import { parseDailyRecordWithDefaults } from '@/schemas/zodSchemas';
import { DailyRecord } from '@/types/domain/dailyRecord';

import { getLegacyDb } from './legacyFirebaseCore';
import { isLegacyReadBlocked } from './legacyFirebaseAccessPolicy';
import { logLegacyError } from './legacyFirebaseLogger';

export const subscribeLegacyRecord = (
  date: string,
  callback: (record: DailyRecord | null) => void
): (() => void) => {
  if (isLegacyReadBlocked()) {
    callback(null);
    return () => {};
  }

  const db = getLegacyDb();
  if (!db) {
    callback(null);
    return () => {};
  }

  const docRef = doc(db, 'hospitals/hanga_roa/dailyRecords', date);

  return onSnapshot(
    docRef,
    docSnap => {
      if (docSnap.exists()) {
        callback(parseDailyRecordWithDefaults(docSnap.data(), date));
      } else {
        callback(null);
      }
    },
    error => {
      logLegacyError('[LegacyFirebase] Subscription error:', error);
      callback(null);
    }
  );
};
