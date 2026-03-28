import { doc, getDoc, getDocs, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { DailyRecord } from '@/types/domain/dailyRecord';
import { COLLECTIONS, getActiveHospitalId } from '@/constants/firestorePaths';
import {
  docToRecord,
  getRecordDocRef,
  getRecordsCollection,
} from '@/services/storage/firestore/firestoreShared';
import { defaultFirestoreServiceRuntime } from '@/services/storage/firestore/firestoreServiceRuntime';
import {
  buildFirestoreMonthDateRange,
  mapFirestoreRecords,
  toFirestoreRecordMap,
} from '@/services/storage/firestore/firestoreQuerySupport';
import { createScopedLogger } from '@/services/utils/loggerScope';

const firestoreQueryLogger = createScopedLogger('FirestoreQueries');

export const getAvailableDatesFromFirestore = async (): Promise<string[]> => {
  try {
    const q = query(getRecordsCollection());
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs
      .map(docItem => docItem.id)
      .sort()
      .reverse();
  } catch (error) {
    firestoreQueryLogger.error('Failed to fetch available dates', error);
    return [];
  }
};

export const getRecordFromFirestore = async (date: string): Promise<DailyRecord | null> => {
  try {
    const docRef = getRecordDocRef(date);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      return docToRecord(docSnap.data(), date);
    }
    return null;
  } catch (error) {
    firestoreQueryLogger.error(`Failed to get record ${date}`, error);
    return null;
  }
};

export const getAllRecordsFromFirestore = async (): Promise<Record<string, DailyRecord>> => {
  try {
    const q = query(getRecordsCollection(), orderBy('date', 'desc'));
    const querySnapshot = await getDocs(q);
    return toFirestoreRecordMap(mapFirestoreRecords(querySnapshot, docToRecord));
  } catch (error) {
    firestoreQueryLogger.error('Failed to get all records', error);
    return {};
  }
};

export const getRecordsRangeFromFirestore = async (
  startDate: string,
  endDate: string
): Promise<DailyRecord[]> => {
  try {
    const q = query(
      getRecordsCollection(),
      where('date', '>=', startDate),
      where('date', '<=', endDate),
      orderBy('date', 'asc')
    );

    const querySnapshot = await getDocs(q);
    return mapFirestoreRecords(querySnapshot.docs, docToRecord);
  } catch (error) {
    firestoreQueryLogger.error(`Failed to get records for range ${startDate} to ${endDate}`, error);
    return [];
  }
};

export const getMonthRecordsFromFirestore = async (
  year: number,
  month: number
): Promise<DailyRecord[]> => {
  try {
    const { startDate, endDate } = buildFirestoreMonthDateRange(year, month);
    return getRecordsRangeFromFirestore(startDate, endDate);
  } catch (error) {
    firestoreQueryLogger.error(`Failed to get month records for ${year}-${month + 1}`, error);
    return [];
  }
};

export const subscribeToRecord = (
  date: string,
  callback: (record: DailyRecord | null, hasPendingWrites: boolean) => void
): (() => void) => {
  const docRef = getRecordDocRef(date);

  return onSnapshot(
    docRef,
    { includeMetadataChanges: true },
    docSnap => {
      const hasPendingWrites = docSnap.metadata.hasPendingWrites;
      if (docSnap.exists()) {
        callback(docToRecord(docSnap.data(), date), hasPendingWrites);
      } else {
        callback(null, hasPendingWrites);
      }
    },
    error => {
      firestoreQueryLogger.error(`Subscription failed for record ${date}`, error);
    }
  );
};

export const isFirestoreAvailable = async (): Promise<boolean> => {
  try {
    const docRef = doc(
      defaultFirestoreServiceRuntime.getDb(),
      COLLECTIONS.HOSPITALS,
      getActiveHospitalId()
    );
    await getDoc(docRef);
    return true;
  } catch (_error) {
    return false;
  }
};
