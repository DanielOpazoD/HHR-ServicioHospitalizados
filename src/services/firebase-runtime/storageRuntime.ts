import type { FirebaseStorage } from 'firebase/storage';
import * as firebaseConfig from '@/firebaseConfig';

export interface StorageRuntime {
  ready: Promise<unknown>;
  getStorage: () => Promise<FirebaseStorage>;
}

export const defaultStorageRuntime: StorageRuntime = {
  ready:
    'firebaseReady' in firebaseConfig
      ? (firebaseConfig as { firebaseReady: Promise<unknown> }).firebaseReady
      : Promise.resolve(),
  getStorage: () => firebaseConfig.getStorageInstance(),
};
