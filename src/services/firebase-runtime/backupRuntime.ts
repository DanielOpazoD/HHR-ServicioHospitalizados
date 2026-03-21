import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';
import * as firebaseConfig from '@/firebaseConfig';

export interface BackupFirestoreRuntime {
  auth: Auth;
  db: Firestore;
}

export interface BackupStorageRuntime {
  auth: Auth;
  ready: Promise<unknown>;
  getStorage: () => Promise<FirebaseStorage>;
}

export const defaultBackupFirestoreRuntime: BackupFirestoreRuntime = {
  get auth() {
    return firebaseConfig.auth;
  },
  get db() {
    return firebaseConfig.db;
  },
};

export const defaultBackupStorageRuntime: BackupStorageRuntime = {
  get auth() {
    return firebaseConfig.auth;
  },
  ready: firebaseConfig.firebaseReady,
  getStorage: firebaseConfig.getStorageInstance,
};
