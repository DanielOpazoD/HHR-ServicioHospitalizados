import {
  getRedirectResult,
  signInAnonymously,
  signInWithRedirect,
  signOut as firebaseSignOut,
  User,
} from 'firebase/auth';
import { auth } from '@/firebaseConfig';
import { AuthUser } from '@/types';
import { checkSharedCensusAccess, isSharedCensusMode } from '@/services/auth/sharedCensusAuth';
import { checkEmailInFirestore } from '@/services/auth/authPolicy';
import { googleProvider, toAuthUser } from '@/services/auth/authShared';

export const signInAnonymouslyForPassport = async (): Promise<string | null> => {
  try {
    if (auth.currentUser) {
      return auth.currentUser.uid;
    }

    const timeoutPromise = new Promise<null>((_, reject) => {
      setTimeout(() => reject(new Error('Auth timeout')), 2500);
    });

    const authPromise = signInAnonymously(auth);
    const result = (await Promise.race([authPromise, timeoutPromise])) as { user: User } | null;

    if (result?.user) {
      return result.user.uid;
    }
    return null;
  } catch (error) {
    console.warn('[Auth] Anonymous sign-in skipped or failed (likely offline):', error);
    return null;
  }
};

export const hasActiveFirebaseSession = (): boolean => auth.currentUser !== null;

export const signInWithGoogleRedirect = async (): Promise<void> => {
  try {
    console.warn('[authService] 🔄 Starting Google Sign-In redirect flow...');
    await signInWithRedirect(auth, googleProvider);
  } catch (error) {
    console.error('[authService] Google redirect failed', error);
    throw error;
  }
};

export const handleSignInRedirectResult = async (): Promise<AuthUser | null> => {
  try {
    const result = await getRedirectResult(auth);
    if (!result) return null;

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
      throw new Error('Acceso no autorizado.');
    }

    return toAuthUser(user, role);
  } catch (error) {
    console.error('[authService] Error handling redirect result', error);
    return null;
  }
};
