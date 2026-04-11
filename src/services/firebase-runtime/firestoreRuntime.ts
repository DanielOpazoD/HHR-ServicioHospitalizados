import type { Firestore } from 'firebase/firestore';
import {
  defaultFirebaseConfigRuntimeAdapter,
  type FirebaseConfigRuntimeAdapter,
} from '@/services/firebase-runtime/firebaseConfigRuntimeAdapter';

export interface FirestoreRuntime {
  db: Firestore;
  ready: Promise<unknown>;
}

export const createFirestoreRuntime = (
  adapter: FirebaseConfigRuntimeAdapter = defaultFirebaseConfigRuntimeAdapter
): FirestoreRuntime => ({
  get db() {
    return adapter.getDb();
  },
  ready: adapter.readyFirestore,
});

export const defaultFirestoreRuntime: FirestoreRuntime = createFirestoreRuntime();
