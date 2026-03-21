import { FirestoreProvider } from './FirestoreProvider';
import { IDatabaseProvider } from './types';
import { defaultFirestoreRuntime } from '@/services/firebase-runtime/firestoreRuntime';

/**
 * Singleton instance of the configured database provider.
 * This allows the entire application to use a generic DB interface
 * without knowing whether it's Firestore, MongoDB, or an in-memory DB for tests.
 */
export const createFirestoreDatabaseProvider = (): IDatabaseProvider =>
  new FirestoreProvider({
    getFirestore: () => defaultFirestoreRuntime.db,
  });

export const db: IDatabaseProvider = createFirestoreDatabaseProvider();

export * from './types';
