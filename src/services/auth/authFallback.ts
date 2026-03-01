import { getRedirectResult, signInWithRedirect } from 'firebase/auth';
import { auth } from '@/firebaseConfig';
import { AuthUser } from '@/types';
import {
  consumeE2ERedirectPendingUser,
  googleProvider,
  readE2ERedirectMode,
} from '@/services/auth/authShared';
import {
  clearAuthBootstrapPending,
  markAuthBootstrapPending,
} from '@/services/auth/authBootstrapState';
import { authorizeFirebaseUser } from '@/services/auth/authAccessResolution';
import { getAuthRedirectRuntimeSupport } from '@/services/auth/authRedirectRuntime';
import { AUTH_UI_COPY } from '@/services/auth/authUiCopy';

const runE2ERedirectMode = async (mode: 'success' | 'error' | 'timeout'): Promise<void> => {
  if (mode === 'error') {
    throw new Error('E2E redirect failed');
  }

  if (mode === 'timeout') {
    await new Promise((_, reject) => {
      setTimeout(() => reject(new Error('E2E redirect timeout')), 1200);
    });
    return;
  }

  markAuthBootstrapPending('redirect');
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(
      'hhr_e2e_redirect_pending_user',
      JSON.stringify({
        uid: 'e2e-redirect-user',
        email: 'e2e.redirect@hospital.cl',
        displayName: 'E2E Redirect User',
        role: 'admin',
      })
    );
  }
};

export const hasActiveFirebaseSession = (): boolean => auth.currentUser !== null;

export const signInWithGoogleRedirect = async (): Promise<void> => {
  try {
    const redirectRuntimeSupport = getAuthRedirectRuntimeSupport();
    if (!redirectRuntimeSupport.canUseRedirectAuth) {
      throw new Error(
        redirectRuntimeSupport.redirectDisabledReason || AUTH_UI_COPY.redirectUnavailable
      );
    }

    const e2eRedirectMode = readE2ERedirectMode();
    if (e2eRedirectMode) {
      await runE2ERedirectMode(e2eRedirectMode);
      return;
    }

    console.warn('[authService] 🔄 Starting Google Sign-In redirect flow...');
    markAuthBootstrapPending('redirect');
    await signInWithRedirect(auth, googleProvider);
  } catch (error) {
    console.error('[authService] Google redirect failed', error);
    throw error;
  }
};

export const handleSignInRedirectResult = async (): Promise<AuthUser | null> => {
  try {
    const e2eRedirectUser = consumeE2ERedirectPendingUser();
    if (e2eRedirectUser) {
      return e2eRedirectUser;
    }

    const result = await getRedirectResult(auth);
    if (!result) return null;
    return await authorizeFirebaseUser(result.user);
  } catch (error) {
    console.error('[authService] Error handling redirect result', error);
    return null;
  } finally {
    clearAuthBootstrapPending();
  }
};
