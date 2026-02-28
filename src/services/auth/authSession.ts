import { onAuthStateChanged, signOut as firebaseSignOut, User } from 'firebase/auth';
import { auth } from '@/firebaseConfig';
import { AuthUser } from '@/types';
import { checkSharedCensusAccess, isSharedCensusMode } from '@/services/auth/sharedCensusAuth';
import { clearRoleCacheForEmail } from '@/services/auth/authPolicy';
import { toAuthUser } from '@/services/auth/authShared';
import { resolveFirebaseUserRole } from '@/services/auth/authAccessResolution';

const toAnonymousAuthUser = (firebaseUser: User): AuthUser => ({
  uid: firebaseUser.uid,
  email: null,
  displayName: 'Anonymous Doctor',
  role: 'viewer',
});

const resolveAuthenticatedUser = async (firebaseUser: User): Promise<AuthUser | null> => {
  if (firebaseUser.isAnonymous) {
    return toAnonymousAuthUser(firebaseUser);
  }

  if (isSharedCensusMode()) {
    const sharedAccess = await checkSharedCensusAccess(firebaseUser.email);
    if (!sharedAccess.authorized) {
      await firebaseSignOut(auth);
      return null;
    }
    return toAuthUser(firebaseUser, 'viewer_census');
  }

  const role = await resolveFirebaseUserRole(firebaseUser);
  return toAuthUser(firebaseUser, role);
};

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
    if (!firebaseUser) {
      callback(null);
      return;
    }

    callback(await resolveAuthenticatedUser(firebaseUser));
  });
};

export const getCurrentUser = (): AuthUser | null => {
  const user = auth.currentUser;
  if (!user) return null;
  return toAuthUser(user);
};
