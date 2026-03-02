import {
  collection,
  doc,
  getDoc,
  setDoc,
  Timestamp,
  type DocumentData,
  type DocumentReference,
} from 'firebase/firestore';
import { db } from '@/firebaseConfig';
import { COLLECTIONS, getActiveHospitalId, HOSPITAL_COLLECTIONS } from '@/constants/firestorePaths';
import { getRecordDocRef } from '@/services/storage/firestore/firestoreShared';

export class ConcurrencyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConcurrencyError';
  }
}

const getRemoteLastUpdatedIso = (data: Record<string, unknown>): string | undefined => {
  const value = data.lastUpdated;
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }

  return typeof value === 'string' ? value : undefined;
};

export const assertFirestoreConcurrency = async (
  docRef: DocumentReference,
  expectedLastUpdated: string | undefined,
  conflictMessage: string,
  contextLabel: string
): Promise<void> => {
  if (!expectedLastUpdated) {
    return;
  }

  try {
    const remoteDoc = await getDoc(docRef);
    if (!remoteDoc.exists()) {
      return;
    }

    const remoteLastUpdated = getRemoteLastUpdatedIso(remoteDoc.data());
    if (remoteLastUpdated && new Date(remoteLastUpdated) > new Date(expectedLastUpdated)) {
      console.warn(
        `[Firestore] ${contextLabel} concurrency conflict. Remote: ${remoteLastUpdated}, Local base: ${expectedLastUpdated}`
      );
      throw new ConcurrencyError(conflictMessage);
    }
  } catch (error) {
    if (error instanceof ConcurrencyError) {
      throw error;
    }

    console.warn(`[Firestore] Could not verify ${contextLabel} concurrency, proceeding.`);
  }
};

export const saveHistorySnapshot = async (date: string): Promise<void> => {
  try {
    const docRef = getRecordDocRef(date);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
      return;
    }

    const data = docSnap.data();
    const historyRef = doc(collection(docRef, 'history'), new Date().toISOString());

    await setDoc(historyRef, {
      ...data,
      snapshotTimestamp: Timestamp.now(),
    });
  } catch (error) {
    console.error('❌ Failed to create history snapshot:', error);
  }
};

export const createDeletedRecordRef = (date: string): DocumentReference =>
  doc(
    db,
    COLLECTIONS.HOSPITALS,
    getActiveHospitalId(),
    HOSPITAL_COLLECTIONS.DELETED_RECORDS,
    `${date}_trash_${Date.now()}`
  );

export const asFirestoreUpdatePayload = (payload: Record<string, unknown>): DocumentData => payload;
