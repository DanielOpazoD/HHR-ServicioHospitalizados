import { signInWithPopup } from 'firebase/auth';

import { auth } from '@/firebaseConfig';
import { AuthUser } from '@/types';
import {
  acquireGoogleLoginLock,
  getGoogleLoginLockStatus,
  releaseGoogleLoginLock,
  startGoogleLoginLockHeartbeat,
} from '@/services/auth/googleLoginLock';
import { createAuthError, googleProvider } from '@/services/auth/authShared';
import {
  isPopupRecoverableAuthError,
  shouldDowngradeGoogleAuthLogLevel,
  toGoogleAuthError,
} from '@/services/auth/authErrorPolicy';
import {
  authorizeCurrentFirebaseUser,
  authorizeFirebaseUser,
} from '@/services/auth/authAccessResolution';

const GOOGLE_POPUP_TIMEOUT_MS = 12000;

const waitForE2EPopupDelay = async (): Promise<void> => {
  const { consumeE2EPopupDelayMs } = await import('@/services/auth/authShared');
  const e2ePopupDelayMs = consumeE2EPopupDelayMs();
  if (e2ePopupDelayMs > 0) {
    await new Promise(resolve => setTimeout(resolve, e2ePopupDelayMs));
  }
};

const resolveE2EPopupUser = async (): Promise<AuthUser | null> => {
  const { consumeE2EPopupErrorCode, consumeE2EPopupMockUser } =
    await import('@/services/auth/authShared');
  const e2ePopupErrorCode = consumeE2EPopupErrorCode();
  if (e2ePopupErrorCode) {
    throw createAuthError(e2ePopupErrorCode, `E2E popup error: ${e2ePopupErrorCode}`);
  }

  return consumeE2EPopupMockUser();
};

const signInWithPopupOrTimeout = async (): Promise<AuthUser> =>
  new Promise<AuthUser>((resolve, reject) => {
    let settled = false;

    const finish = (resolver: () => void) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeoutId);
      resolver();
    };

    const timeoutId = setTimeout(() => {
      finish(() =>
        reject(
          createAuthError(
            'auth/popup-timeout',
            'La ventana de Google tardó demasiado en responder. Prueba la otra forma de ingreso.'
          )
        )
      );
    }, GOOGLE_POPUP_TIMEOUT_MS);

    signInWithPopup(auth, googleProvider)
      .then(result => authorizeFirebaseUser(result.user))
      .then(user => {
        finish(() => resolve(user));
      })
      .catch(error => {
        finish(() => reject(error));
      });
  });

const withGoogleLoginLock = async <T>(runner: () => Promise<T>): Promise<T> => {
  if (!acquireGoogleLoginLock()) {
    const status = getGoogleLoginLockStatus();
    const remainingSeconds = Math.max(1, Math.ceil(status.remainingMs / 1000));
    throw createAuthError(
      'auth/multi-tab-login-in-progress',
      `Ya hay un inicio de sesión en progreso en otra pestaña. Intenta nuevamente en ${remainingSeconds}s.`
    );
  }

  const stopLockHeartbeat = startGoogleLoginLockHeartbeat();
  try {
    return await runner();
  } finally {
    stopLockHeartbeat();
    releaseGoogleLoginLock();
  }
};

export const signInWithGoogle = async (): Promise<AuthUser> =>
  withGoogleLoginLock(async () => {
    try {
      await waitForE2EPopupDelay();

      const existingUser = await authorizeCurrentFirebaseUser();
      if (existingUser) {
        return existingUser;
      }

      const e2ePopupUser = await resolveE2EPopupUser();
      if (e2ePopupUser) {
        return e2ePopupUser;
      }

      return await signInWithPopupOrTimeout();
    } catch (error: unknown) {
      const authError = error as { message?: string };
      if (authError.message?.includes('no autorizado')) {
        throw error;
      }

      const mappedError = toGoogleAuthError(error);
      if (shouldDowngradeGoogleAuthLogLevel(error)) {
        console.warn(`[authService] Google sign-in recoverable issue: ${mappedError.code}`);
      } else {
        console.error('[authService] Google sign-in failed', error);
      }

      if (isPopupRecoverableAuthError(error)) {
        console.warn(
          '[authService] Trying alternate Google sign-in flow after browser popup issue'
        );
      }

      throw mappedError;
    }
  });
