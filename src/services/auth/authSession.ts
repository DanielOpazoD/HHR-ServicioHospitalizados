import { onAuthStateChanged, signOut as firebaseSignOut, User } from 'firebase/auth';
import { auth } from '@/firebaseConfig';
import { AuthUser, UserRole } from '@/types';
import { checkSharedCensusAccess, isSharedCensusMode } from '@/services/auth/sharedCensusAuth';
import { checkEmailInFirestore, clearRoleCacheForEmail } from '@/services/auth/authPolicy';
import { toAuthUser } from '@/services/auth/authShared';

export const signOut = async (): Promise<void> => {
  const userEmail = auth.currentUser?.email;
  await firebaseSignOut(auth);

  if (userEmail) {
    try {
      await clearRoleCacheForEmail(userEmail);
    } catch (e) {
      console.warn('[authService] Failed to clear role cache on signOut:', e);
    }
  }
};

export const onAuthChange = (callback: (user: AuthUser | null) => void): (() => void) => {
  return onAuthStateChanged(auth, async (firebaseUser: User | null) => {
    if (firebaseUser) {
      if (firebaseUser.isAnonymous) {
        callback({
          uid: firebaseUser.uid,
          email: null,
          displayName: 'Anonymous Doctor',
          role: 'viewer',
        });
        return;
      }

      if (isSharedCensusMode()) {
        const sharedAccess = await checkSharedCensusAccess(firebaseUser.email);
        if (!sharedAccess.authorized) {
          await firebaseSignOut(auth);
          callback(null);
          return;
        }
        callback(toAuthUser(firebaseUser, 'viewer_census'));
        return;
      }

      try {
        const tokenResult = await firebaseUser.getIdTokenResult();
        let role = tokenResult.claims.role as UserRole;

        if (!role || role === 'viewer' || role === 'editor') {
          const whitelistResult = await checkEmailInFirestore(firebaseUser.email || '');
          if (whitelistResult.allowed && whitelistResult.role) {
            role = whitelistResult.role;
          }
        }

        callback(toAuthUser(firebaseUser, role || 'viewer'));
      } catch (error) {
        console.error('[useAuthState] Error getting ID token result:', error);
        const { role } = await checkEmailInFirestore(firebaseUser.email || '');
        callback(toAuthUser(firebaseUser, role || 'viewer'));
      }
    } else {
      callback(null);
    }
  });
};

export const getCurrentUser = (): AuthUser | null => {
  const user = auth.currentUser;
  if (!user) return null;
  return toAuthUser(user);
};
