import {
  deleteDoc,
  setDoc,
  Timestamp,
  updateDoc,
  type DocumentData,
  type UpdateData,
} from 'firebase/firestore';
import { DailyRecord, DailyRecordPatch } from '@/types';
import { withRetry } from '@/utils/networkUtils';
import {
  flattenObject,
  getRecordDocRef,
  sanitizeForFirestore,
} from '@/services/storage/firestore/firestoreShared';
import {
  asFirestoreUpdatePayload,
  assertFirestoreConcurrency,
  ConcurrencyError,
  createDeletedRecordRef,
  saveHistorySnapshot,
} from '@/services/storage/firestore/firestoreWriteSupport';

export { ConcurrencyError } from '@/services/storage/firestore/firestoreWriteSupport';

export const saveRecordToFirestore = async (
  record: DailyRecord,
  expectedLastUpdated?: string
): Promise<void> => {
  try {
    const docRef = getRecordDocRef(record.date);
    await assertFirestoreConcurrency(
      docRef,
      expectedLastUpdated,
      'El registro ha sido modificado por otro usuario. Por favor recarga la página.',
      'save'
    );

    await saveHistorySnapshot(record.date);

    const sanitizedRecord = sanitizeForFirestore({
      ...record,
      lastUpdated: Timestamp.now(),
    });

    await withRetry(() => setDoc(docRef, sanitizedRecord as Record<string, unknown>), {
      onRetry: (err: unknown, attempt: number) =>
        console.warn(`[Firestore] Retry ${attempt} saving record ${record.date}:`, err),
    });
  } catch (error) {
    console.error('❌ Error saving to Firestore:', error);
    throw error;
  }
};

export const updateRecordPartial = async (
  date: string,
  partialData: DailyRecordPatch,
  expectedLastUpdated?: string
): Promise<void> => {
  try {
    const docRef = getRecordDocRef(date);
    await assertFirestoreConcurrency(
      docRef,
      expectedLastUpdated,
      'El registro ha sido modificado por otro usuario. Por favor recarga la página.',
      'partial update'
    );

    await saveHistorySnapshot(date);

    const flatData = flattenObject(partialData as unknown as Record<string, unknown>);
    const sanitizedData = sanitizeForFirestore({
      ...flatData,
      lastUpdated: Timestamp.now(),
    }) as Record<string, unknown>;

    try {
      await withRetry(
        () =>
          updateDoc(docRef, asFirestoreUpdatePayload(sanitizedData) as UpdateData<DocumentData>),
        {
          onRetry: (err: unknown, attempt: number) =>
            console.warn(`[Firestore] Retry ${attempt} updating record ${date}:`, err),
        }
      );
    } catch (error: unknown) {
      const storageError = error as { code?: string };
      if (storageError?.code === 'not-found') {
        console.warn(
          `[Firestore] Document ${date} not found for partial update. Creating with setDoc.`
        );
        await withRetry(() => setDoc(docRef, sanitizedData, { merge: true }));
      } else {
        throw error;
      }
    }
  } catch (error) {
    console.error('❌ Error in partial update to Firestore:', error);
    throw error;
  }
};

export const deleteRecordFromFirestore = async (date: string): Promise<void> => {
  try {
    const docRef = getRecordDocRef(date);
    await withRetry(() => deleteDoc(docRef), {
      onRetry: (err: unknown, attempt: number) =>
        console.warn(`[Firestore] Retry ${attempt} deleting record ${date}:`, err),
    });
  } catch (error) {
    console.error('❌ Error deleting from Firestore:', error);
    throw error;
  }
};

export const moveRecordToTrash = async (record: DailyRecord): Promise<void> => {
  try {
    const trashRef = createDeletedRecordRef(record.date);

    await withRetry(() =>
      setDoc(trashRef, {
        ...(sanitizeForFirestore(record) as Record<string, unknown>),
        deletedAt: Timestamp.now(),
        originalDate: record.date,
      })
    );
  } catch (error) {
    console.error('❌ Error moving record to trash:', error);
    throw error;
  }
};
