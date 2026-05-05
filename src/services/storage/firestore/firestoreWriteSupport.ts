import {
  collection,
  doc,
  getDoc,
  setDoc,
  Timestamp,
  type DocumentData,
  type DocumentReference,
} from 'firebase/firestore';
import { COLLECTIONS, getActiveHospitalId, HOSPITAL_COLLECTIONS } from '@/constants/firestorePaths';
import { createOperationalError } from '@/services/observability/operationalError';
import { recordOperationalErrorTelemetry } from '@/services/observability/operationalTelemetryOutcomeRecorder';
import { getRecordDocRef } from '@/services/storage/firestore/firestoreShared';
import { defaultFirestoreServiceRuntime } from '@/services/storage/firestore/firestoreServiceRuntime';
import type { FirestoreServiceRuntimePort } from '@/services/storage/firestore/ports/firestoreServiceRuntimePort';

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

/**
 * Tolerance window for same-session rapid edits (e.g. clicking checkboxes fast).
 * Changes within this window are assumed to come from the same user/tab and
 * are allowed through. Changes older than this are likely from a different
 * PC/session with stale data and are blocked.
 */
const SAME_SESSION_TOLERANCE_MS = 30_000;

export const assertFirestoreConcurrency = async (
  docRef: DocumentReference,
  expectedLastUpdated: string | undefined,
  conflictMessage: string,
  contextLabel: string,
  options: { toleranceMs?: number } = {}
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
    if (!remoteLastUpdated) {
      return;
    }

    const drift = new Date(remoteLastUpdated).getTime() - new Date(expectedLastUpdated).getTime();

    const toleranceMs = options.toleranceMs ?? SAME_SESSION_TOLERANCE_MS;

    if (drift > toleranceMs) {
      recordOperationalErrorTelemetry(
        'firestore',
        'verify_record_concurrency',
        createOperationalError({
          code: 'firestore_concurrency_conflict',
          message: conflictMessage,
          severity: 'warning',
          userSafeMessage: conflictMessage,
          context: {
            contextLabel,
            remoteLastUpdated,
            expectedLastUpdated,
            driftSeconds: Math.round(drift / 1000),
          },
        }),
        {
          code: 'firestore_concurrency_conflict',
          message: conflictMessage,
          severity: 'warning',
          userSafeMessage: conflictMessage,
        }
      );
      throw new ConcurrencyError(conflictMessage);
    }
  } catch (error) {
    if (error instanceof ConcurrencyError) {
      throw error;
    }

    recordOperationalErrorTelemetry('firestore', 'verify_record_concurrency', error, {
      code: 'firestore_concurrency_verification_failed',
      message: `No se pudo verificar concurrencia para ${contextLabel}.`,
      severity: 'warning',
      userSafeMessage: `No se pudo verificar concurrencia para ${contextLabel}.`,
      context: {
        contextLabel,
      },
    });
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
    recordOperationalErrorTelemetry('firestore', 'save_history_snapshot', error, {
      code: 'firestore_history_snapshot_failed',
      message: 'No se pudo crear el snapshot histórico del registro.',
      severity: 'warning',
      userSafeMessage: 'No se pudo crear el snapshot histórico del registro.',
      context: {
        date,
      },
    });
  }
};

export const createDeletedRecordRef = (
  date: string,
  runtime: FirestoreServiceRuntimePort = defaultFirestoreServiceRuntime
): DocumentReference =>
  doc(
    runtime.getDb(),
    COLLECTIONS.HOSPITALS,
    getActiveHospitalId(),
    HOSPITAL_COLLECTIONS.DELETED_RECORDS,
    `${date}_trash_${Date.now()}`
  );

export const asFirestoreUpdatePayload = (payload: Record<string, unknown>): DocumentData => payload;
