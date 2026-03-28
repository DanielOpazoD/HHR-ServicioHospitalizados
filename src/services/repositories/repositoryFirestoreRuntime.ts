import { defaultFirestoreRuntime } from '@/services/firebase-runtime/firestoreRuntime';
import type { FirestoreRuntime } from '@/services/firebase-runtime/firestoreRuntime';
import type { RepositoryFirestoreRuntimePort } from '@/services/repositories/ports/repositoryFirestoreRuntimePort';

export const createRepositoryFirestoreRuntime = (
  runtime: Pick<FirestoreRuntime, 'db'> = defaultFirestoreRuntime
): RepositoryFirestoreRuntimePort => ({
  getDb: () => runtime.db,
});

export const defaultRepositoryFirestoreRuntime: RepositoryFirestoreRuntimePort =
  createRepositoryFirestoreRuntime();
