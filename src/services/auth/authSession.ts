import { onAuthStateChanged, signOut as firebaseSignOut, User } from 'firebase/auth';
import { auth } from '@/firebaseConfig';
import { AuthUser } from '@/types';
import { checkSharedCensusAccess, isSharedCensusMode } from '@/services/auth/sharedCensusAuth';
import {
  canAccessSpecialistMedicalHandoff,
  isSpecialistMedicalHandoffMode,
} from '@/services/auth/specialistMedicalHandoffAuth';
import { clearRoleCacheForEmail } from '@/services/auth/authPolicy';
import { toAuthUser } from '@/services/auth/authShared';
import { resolveFirebaseUserRole } from '@/services/auth/authAccessResolution';
import { resolveAuthSessionUser } from '@/services/auth/authSessionController';
import { recordAuthOperationalError } from '@/services/auth/authOperationalTelemetry';

export const signOut = async (): Promise<void> => {
  const userEmail = auth.currentUser?.email;
  await firebaseSignOut(auth);

  if (userEmail) {
    try {
      await clearRoleCacheForEmail(userEmail);
    } catch (error) {
      recordAuthOperationalError('sign_out_clear_role_cache', error, {
        code: 'auth_role_cache_clear_failed',
        message: 'Failed to clear role cache on sign out.',
        severity: 'warning',
        userSafeMessage: 'La sesión se cerró, pero no se pudo limpiar el cache de roles.',
        context: {
          email: userEmail,
        },
      });
    }
  }
};

export const onAuthChange = (callback: (user: AuthUser | null) => void): (() => void) => {
  return onAuthStateChanged(auth, async (firebaseUser: User | null) => {
    if (!firebaseUser) {
      callback(null);
      return;
    }

    callback(
      await resolveAuthSessionUser(firebaseUser, {
        isSharedCensusMode,
        isSpecialistMedicalHandoffMode,
        checkSharedCensusAccess,
        canAccessSpecialistMedicalHandoff,
        signOutUnauthorizedUser: () => firebaseSignOut(auth),
        resolveFirebaseUserRole,
      })
    );
  });
};

export const getCurrentUser = (): AuthUser | null => {
  const user = auth.currentUser;
  if (!user) return null;
  return toAuthUser(user);
};
