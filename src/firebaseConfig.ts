import type { FirebaseApp, FirebaseOptions } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';
import type { Functions } from 'firebase/functions';
import { loadFirebaseConfig } from '@/services/firebase-runtime/firebaseConfigLoader';
import {
  buildMissingFirebaseConfigDiagnostics,
  mountFirebaseConfigWarning,
  validateFirebaseRuntimeConfig,
  warnOnFirebaseAuthConfig,
  warnWithFirebaseDiagnostics,
} from '@/services/firebase-runtime/firebaseStartupDiagnostics';
import {
  connectFirebaseEmulators,
  initializeFirebaseServices,
} from '@/services/firebase-runtime/firebaseServiceBootstrap';
import {
  createFirebaseLazyServicesState,
  resolveFunctionsInstance,
  resolveStorageInstance,
} from '@/services/firebase-runtime/firebaseLazyServices';
import { createScopedLogger } from '@/services/utils/loggerScope';

const FIREBASE_READY_TIMEOUT_MS = 10000;
const firebaseConfigLogger = createScopedLogger('FirebaseConfig');

export let app!: FirebaseApp;
export let auth!: Auth;
export let db!: Firestore;

const lazyServicesState = createFirebaseLazyServicesState();

const getFirebaseApp = async (): Promise<FirebaseApp> => {
  await firebaseReady;
  return app;
};

export const getStorageInstance = async (): Promise<FirebaseStorage> =>
  resolveStorageInstance(await getFirebaseApp(), lazyServicesState);

export const getFunctionsInstance = async (): Promise<Functions> =>
  resolveFunctionsInstance(await getFirebaseApp(), lazyServicesState);

const loadValidatedFirebaseConfig = async (): Promise<FirebaseOptions> => {
  try {
    const config = await loadFirebaseConfig();
    firebaseConfigLogger.info('Config loaded', {
      projectId: config.projectId,
      storageBucket: config.storageBucket || 'not_set',
    });
    validateFirebaseRuntimeConfig(config);
    warnOnFirebaseAuthConfig(config);
    return config;
  } catch (error) {
    console.error('Failed to load Firebase config from Netlify function', error);
    const diagnostics = buildMissingFirebaseConfigDiagnostics();
    warnWithFirebaseDiagnostics(
      diagnostics,
      'No se pudo cargar la configuración principal del sistema. Revisa la función de configuración y las variables de Firebase del entorno.'
    );
    throw error;
  }
};

export const firebaseReady = (async () => {
  firebaseConfigLogger.info('Starting Firebase ready sequence');

  const timeout = new Promise((_, reject) =>
    setTimeout(
      () => reject(new Error('Firebase initialization timed out')),
      FIREBASE_READY_TIMEOUT_MS
    )
  );

  try {
    const bootstrapPromise = (async () => {
      const config = await loadValidatedFirebaseConfig();
      const services = await initializeFirebaseServices(config);
      app = services.app;
      auth = services.auth;
      db = services.db;
      connectFirebaseEmulators(services);
      return services;
    })();

    const services = (await Promise.race([bootstrapPromise, timeout])) as {
      app: FirebaseApp;
      auth: Auth;
      db: Firestore;
    };

    return services;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[FirebaseConfig] ❌ Critical initialization error:', message);
    throw err;
  }
})();

export { mountFirebaseConfigWarning as mountConfigWarning };
export default app;
