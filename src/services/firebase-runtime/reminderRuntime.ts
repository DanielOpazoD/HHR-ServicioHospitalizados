import { collection, doc, type Firestore } from 'firebase/firestore';
import {
  deleteObject,
  getDownloadURL,
  ref,
  uploadBytes,
  type FirebaseStorage,
} from 'firebase/storage';
import * as firebaseConfig from '@/firebaseConfig';

export interface ReminderFirestoreRuntime {
  firestore: Firestore;
  collection: typeof collection;
  doc: typeof doc;
}

export interface ReminderStorageRuntime {
  getStorage: () => Promise<FirebaseStorage>;
  ref: typeof ref;
  uploadBytes: typeof uploadBytes;
  getDownloadURL: typeof getDownloadURL;
  deleteObject: typeof deleteObject;
}

export const defaultReminderFirestoreRuntime: ReminderFirestoreRuntime = {
  get firestore() {
    return firebaseConfig.db;
  },
  collection,
  doc,
};

export const defaultReminderStorageRuntime: ReminderStorageRuntime = {
  getStorage: firebaseConfig.getStorageInstance,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
};
