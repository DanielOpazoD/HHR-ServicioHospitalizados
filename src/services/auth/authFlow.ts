import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { auth } from '@/firebaseConfig';
import { AuthUser, UserRole } from '@/types';
import { acquireGoogleLoginLock, releaseGoogleLoginLock } from '@/services/auth/googleLoginLock';
import { checkSharedCensusAccess, isSharedCensusMode } from '@/services/auth/sharedCensusAuth';
import { checkEmailInFirestore } from '@/services/auth/authPolicy';
import { createAuthError, googleProvider, toAuthUser } from '@/services/auth/authShared';

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

export const signInWithGoogle = async (): Promise<AuthUser> => {
  if (!acquireGoogleLoginLock()) {
    throw createAuthError(
      'auth/multi-tab-login-in-progress',
      'Ya hay un inicio de sesión en progreso en otra pestaña.'
    );
  }

  try {
    const existingUser = auth.currentUser;
    if (existingUser && !existingUser.isAnonymous) {
      if (isSharedCensusMode()) {
        const sharedAccess = await checkSharedCensusAccess(existingUser.email);
        if (sharedAccess.authorized) {
          return toAuthUser(existingUser, 'viewer_census');
        }
        await firebaseSignOut(auth);
      } else {
        const { allowed, role } = await checkEmailInFirestore(existingUser.email || '');
        if (allowed) {
          return toAuthUser(existingUser, role);
        }
        await firebaseSignOut(auth);
      }
    }

    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    if (isSharedCensusMode()) {
      const sharedAccess = await checkSharedCensusAccess(user.email);
      if (!sharedAccess.authorized) {
        await firebaseSignOut(auth);
        throw new Error('Acceso no autorizado. Tu correo no tiene permisos para censo compartido.');
      }
      return toAuthUser(user, 'viewer_census');
    }

    const { allowed, role } = await checkEmailInFirestore(user.email || '');
    if (!allowed) {
      await firebaseSignOut(auth);
      throw new Error(
        'Acceso no autorizado. Su correo no está en la lista de usuarios permitidos.'
      );
    }

    return toAuthUser(user, role);
  } catch (error: unknown) {
    const err = error as { code?: string; message?: string };
    if (err.message?.includes('no autorizado')) {
      throw error;
    }

    console.error('[authService] Google sign-in failed', error);

    const isAssertionFailure = err.message?.includes('INTERNAL ASSERTION');
    const isNetworkFailure = err.code === 'auth/network-request-failed';
    if (isAssertionFailure || isNetworkFailure) {
      console.warn('[authService] 💡 Suggesting signInWithRedirect due to popup failure');
    }

    const errorMessages: Record<string, string> = {
      'auth/multi-tab-login-in-progress':
        'Hay otra pestaña iniciando sesión. Espera unos segundos o usa el acceso alternativo.',
      'auth/popup-closed-by-user': 'Inicio de sesión cancelado',
      'auth/popup-blocked':
        'El navegador bloqueó la ventana emergente. Permita pop-ups para este sitio.',
      'auth/cancelled-popup-request': 'Operación cancelada',
      'auth/network-request-failed':
        'Error de conexión o bloqueo de seguridad (COOP/Cookies). Verifique su conexión o la configuración del navegador.',
      'auth/unauthorized-domain':
        'Dominio no autorizado en Firebase Auth. Agrega el dominio actual en Firebase > Authentication > Settings > Authorized domains.',
      'auth/invalid-api-key':
        'Clave de API inválida. Revisa las variables de entorno de Firebase configuradas en Netlify.',
    };

    throw new Error(
      err.code
        ? errorMessages[err.code] || 'Error al iniciar sesión con Google'
        : 'Error al iniciar sesión con Google'
    );
  } finally {
    releaseGoogleLoginLock();
  }
};

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
