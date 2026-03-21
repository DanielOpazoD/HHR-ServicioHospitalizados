import type { Firestore } from 'firebase/firestore';
import * as firebaseConfig from '@/firebaseConfig';

export interface FirestoreRuntime {
  db: Firestore;
  ready: Promise<unknown>;
}

export const defaultFirestoreRuntime: FirestoreRuntime = {
  get db() {
    return firebaseConfig.db;
  },
  ready:
    'firebaseReady' in firebaseConfig
      ? (firebaseConfig as { firebaseReady: Promise<unknown> }).firebaseReady
      : Promise.resolve(),
};
