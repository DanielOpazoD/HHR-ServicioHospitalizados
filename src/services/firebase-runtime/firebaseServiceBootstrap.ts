import { initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  type Auth,
} from 'firebase/auth';
import {
  initializeFirestore,
  connectFirestoreEmulator,
  type Firestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  persistentSingleTabManager,
} from 'firebase/firestore';
import {
  parseEmulatorHost,
  shouldUseSingleTabFirestoreCache,
} from '@/services/firebase-runtime/firebaseEnvironmentPolicy';
import { firebaseBootstrapLogger } from '@/services/firebase-runtime/firebaseRuntimeLoggers';

export interface FirebaseBootstrapResult {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

const configureAuthPersistence = async (
  auth: Auth
): Promise<'local' | 'session' | 'memory' | 'unconfigured'> => {
  const persistenceCandidates = [
    { mode: 'local' as const, persistence: browserLocalPersistence },
    { mode: 'session' as const, persistence: browserSessionPersistence },
    { mode: 'memory' as const, persistence: inMemoryPersistence },
  ];

  for (const candidate of persistenceCandidates) {
    try {
      await setPersistence(auth, candidate.persistence);
      firebaseBootstrapLogger.info('Auth persistence configured', {
        persistenceMode: candidate.mode,
      });
      return candidate.mode;
    } catch (error) {
      firebaseBootstrapLogger.warn(
        `[FirebaseConfig] ⚠️ Auth persistence (${candidate.mode}) failed:`,
        error
      );
    }
  }

  return 'unconfigured';
};

export const initializeFirebaseServices = async (
  config: FirebaseOptions
): Promise<FirebaseBootstrapResult> => {
  firebaseBootstrapLogger.info('Initializing services');
  const app = initializeApp(config);
  const auth = getAuth(app);

  let db: Firestore;
  try {
    const useSingleTabCache = shouldUseSingleTabFirestoreCache();
    db = initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: persistentLocalCache({
        tabManager: useSingleTabCache
          ? persistentSingleTabManager({})
          : persistentMultipleTabManager(),
      }),
    });
    firebaseBootstrapLogger.info('Firestore initialized', {
      cacheMode: useSingleTabCache ? 'single-tab' : 'multi-tab',
      persistenceRequested: true,
    });
  } catch (fsErr) {
    firebaseBootstrapLogger.warn(
      '[FirebaseConfig] ⚠️ Firestore persistence failed at init:',
      fsErr
    );
    db = initializeFirestore(app, {
      ignoreUndefinedProperties: true,
    });
  }

  await configureAuthPersistence(auth);

  firebaseBootstrapLogger.info('Firebase services ready');
  return { app, auth, db };
};

export const connectFirebaseEmulators = ({
  auth,
  db,
}: Pick<FirebaseBootstrapResult, 'auth' | 'db'>) => {
  const authEmulatorHost = import.meta.env.VITE_AUTH_EMULATOR_HOST;
  const firestoreEmulatorHost = import.meta.env.VITE_FIRESTORE_EMULATOR_HOST;

  if (import.meta.env.DEV && authEmulatorHost) {
    connectAuthEmulator(auth, authEmulatorHost);
  }

  if (import.meta.env.DEV && firestoreEmulatorHost) {
    const emulatorHost = parseEmulatorHost(firestoreEmulatorHost);
    if (emulatorHost) {
      connectFirestoreEmulator(db, emulatorHost.host, emulatorHost.port);
    } else {
      firebaseBootstrapLogger.warn(
        '[FirebaseConfig] Invalid Firestore emulator host:',
        firestoreEmulatorHost
      );
    }
  }
};
