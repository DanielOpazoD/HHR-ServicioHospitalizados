import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth } from '@/firebaseConfig';
import { AuthUser, UserRole } from '@/types';
import {
  acquireGoogleLoginLock,
  getGoogleLoginLockStatus,
  releaseGoogleLoginLock,
  startGoogleLoginLockHeartbeat,
} from '@/services/auth/googleLoginLock';
import { checkEmailInFirestore } from '@/services/auth/authPolicy';
import { createAuthError, googleProvider, toAuthUser } from '@/services/auth/authShared';
import {
  isPopupRecoverableAuthError,
  shouldDowngradeGoogleAuthLogLevel,
  toGoogleAuthError,
} from '@/services/auth/authErrorPolicy';
import {
  authorizeCurrentFirebaseUser,
  authorizeFirebaseUser,
} from '@/services/auth/authAccessResolution';

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

export const signIn = async (email: string, password: string): Promise<AuthUser> => {
  try {
    const result = await signInWithEmailAndPassword(auth, email, password);

    const { allowed, role } = await checkEmailInFirestore(result.user.email || '');
    if (!allowed) {
      await firebaseSignOut(auth);
      throw new Error(
        'Acceso no autorizado. Su correo no está en la lista de usuarios permitidos.'
      );
    }

    return toAuthUser(result.user, role);
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.message?.includes('no autorizado')) {
      throw error;
    }

    const errorMessages: Record<string, string> = {
      'auth/user-not-found': 'Usuario no encontrado',
      'auth/wrong-password': 'Contraseña incorrecta',
      'auth/invalid-email': 'Email inválido',
      'auth/user-disabled': 'Usuario deshabilitado',
      'auth/too-many-requests': 'Demasiados intentos. Intente más tarde.',
      'auth/invalid-credential': 'Credenciales inválidas',
    };
    throw new Error(
      err.code ? errorMessages[err.code] || 'Error de autenticación' : 'Error de autenticación'
    );
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

      const result = await signInWithPopup(auth, googleProvider);
      return authorizeFirebaseUser(result.user);
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };
      if (err.message?.includes('no autorizado')) {
        throw error;
      }

      const mappedError = toGoogleAuthError(error);
      if (shouldDowngradeGoogleAuthLogLevel(error)) {
        console.warn(`[authService] Google sign-in recoverable issue: ${mappedError.code}`);
      } else {
        console.error('[authService] Google sign-in failed', error);
      }

      if (isPopupRecoverableAuthError(error)) {
        console.warn('[authService] 💡 Suggesting signInWithRedirect due to popup failure');
      }
      throw mappedError;
    }
  });

export const createUser = async (email: string, password: string): Promise<AuthUser> => {
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return toAuthUser(result.user);
  } catch (error: unknown) {
    const err = error as { code?: string };
    const errorMessages: Record<string, string> = {
      'auth/email-already-in-use': 'Este email ya está registrado',
      'auth/weak-password': 'La contraseña debe tener al menos 6 caracteres',
      'auth/invalid-email': 'Email inválido',
    };
    throw new Error(
      err.code ? errorMessages[err.code] || 'Error al crear usuario' : 'Error al crear usuario'
    );
  }
};

export type { UserRole };
