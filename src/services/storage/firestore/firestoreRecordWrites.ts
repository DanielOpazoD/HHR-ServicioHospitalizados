import {
  deleteDoc,
  setDoc,
  Timestamp,
  updateDoc,
  type DocumentData,
  type UpdateData,
} from 'firebase/firestore';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { DailyRecordPatch } from '@/types/domain/dailyRecordPatch';
import { withRetry } from '@/utils/networkUtils';
import {
  flattenObject,
  getRecordDocRef,
  sanitizeForFirestore,
} from '@/services/storage/firestore/firestoreShared';
import {
  asFirestoreUpdatePayload,
  assertFirestoreConcurrency,
  createDeletedRecordRef,
  saveHistorySnapshot,
} from '@/services/storage/firestore/firestoreWriteSupport';
import { createScopedLogger } from '@/services/utils/loggerScope';

export { ConcurrencyError } from '@/services/storage/firestore/firestoreWriteSupport';

const firestoreWriteLogger = createScopedLogger('FirestoreWrites');

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
        firestoreWriteLogger.warn(`Retry ${attempt} saving record ${record.date}`, err),
    });
  } catch (error) {
    firestoreWriteLogger.error(`Failed to save record ${record.date}`, error);
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
            firestoreWriteLogger.warn(`Retry ${attempt} updating record ${date}`, err),
        }
      );
    } catch (error: unknown) {
      const storageError = error as { code?: string };
      if (storageError?.code === 'not-found') {
        firestoreWriteLogger.warn(
          `Document ${date} not found for partial update. Creating with setDoc.`
        );
        await withRetry(() => setDoc(docRef, sanitizedData, { merge: true }));
      } else {
        throw error;
      }
    }
  } catch (error) {
    firestoreWriteLogger.error(`Failed partial update for ${date}`, error);
    throw error;
  }
};

export const deleteRecordFromFirestore = async (date: string): Promise<void> => {
  try {
    const docRef = getRecordDocRef(date);
    await withRetry(() => deleteDoc(docRef), {
      onRetry: (err: unknown, attempt: number) =>
        firestoreWriteLogger.warn(`Retry ${attempt} deleting record ${date}`, err),
    });
  } catch (error) {
    firestoreWriteLogger.error(`Failed to delete record ${date}`, error);
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
    firestoreWriteLogger.error(`Failed to move record ${record.date} to trash`, error);
    throw error;
  }
};
