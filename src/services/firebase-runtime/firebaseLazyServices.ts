import type { FirebaseApp } from 'firebase/app';
import type { FirebaseStorage } from 'firebase/storage';
import type { Functions } from 'firebase/functions';
import { parseEmulatorHost } from '@/services/firebase-runtime/firebaseEnvironmentPolicy';
import { firebaseLazyServicesLogger } from '@/services/firebase-runtime/firebaseRuntimeLoggers';

interface FirebaseLazyServicesState {
  storage?: FirebaseStorage;
  functions?: Functions;
  functionsEmulatorConnected: boolean;
}

export const createFirebaseLazyServicesState = (): FirebaseLazyServicesState => ({
  storage: undefined,
  functions: undefined,
  functionsEmulatorConnected: false,
});

export const resolveStorageInstance = async (
  app: FirebaseApp,
  state: FirebaseLazyServicesState
): Promise<FirebaseStorage> => {
  if (state.storage) return state.storage;

  const { getStorage } = await import('firebase/storage');
  state.storage = getStorage(app);
  return state.storage;
};

export const resolveFunctionsInstance = async (
  app: FirebaseApp,
  state: FirebaseLazyServicesState
): Promise<Functions> => {
  if (!state.functions) {
    const { getFunctions } = await import('firebase/functions');
    state.functions = getFunctions(app);
  }

  if (import.meta.env.DEV && !state.functionsEmulatorConnected) {
    const functionsEmulatorHost = import.meta.env.VITE_FUNCTIONS_EMULATOR_HOST;
    if (functionsEmulatorHost) {
      const emulatorHost = parseEmulatorHost(functionsEmulatorHost);
      if (!emulatorHost) {
        firebaseLazyServicesLogger.warn(
          '[FirebaseConfig] Invalid functions emulator host:',
          functionsEmulatorHost
        );
        return state.functions;
      }
      const { connectFunctionsEmulator } = await import('firebase/functions');
      connectFunctionsEmulator(state.functions, emulatorHost.host, emulatorHost.port);
      state.functionsEmulatorConnected = true;
    }
  }

  return state.functions;
};
