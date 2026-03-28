import { defaultFirestoreRuntime } from '@/services/firebase-runtime/firestoreRuntime';
import type { FirestoreRuntime } from '@/services/firebase-runtime/firestoreRuntime';
import type { FirestoreServiceRuntimePort } from '@/services/storage/firestore/ports/firestoreServiceRuntimePort';

export const createFirestoreServiceRuntime = (
  runtime: FirestoreRuntime = defaultFirestoreRuntime
): FirestoreServiceRuntimePort => ({
  getDb: () => runtime.db,
  ready: runtime.ready as Promise<void>,
});

export const defaultFirestoreServiceRuntime: FirestoreServiceRuntimePort =
  createFirestoreServiceRuntime();
