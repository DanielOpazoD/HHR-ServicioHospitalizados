import type { User } from 'firebase/auth';
import { httpsCallable } from 'firebase/functions';
import type { UserRole } from '@/types/auth';
import { logger } from '@/services/utils/loggerService';
import { defaultFunctionsRuntime } from '@/services/firebase-runtime/functionsRuntime';

const authClaimSyncLogger = logger.child('AuthClaimSync');

const resolveTokenRole = async (firebaseUser: User): Promise<string | null> => {
  const token = await firebaseUser.getIdTokenResult();
  return typeof token.claims.role === 'string' ? token.claims.role : null;
};

export const syncCurrentUserRoleClaim = async (): Promise<{ role: UserRole | null }> => {
  const functions = await defaultFunctionsRuntime.getFunctions();
  const syncUserRoleClaim = httpsCallable<undefined, { role?: UserRole | null }>(
    functions,
    'syncCurrentUserRoleClaim'
  );
  const result = await syncUserRoleClaim();
  return {
    role: result.data?.role ?? null,
  };
};

export const ensureUserRoleClaim = async (
  firebaseUser: User,
  resolvedRole: UserRole
): Promise<void> => {
  const tokenRole = await resolveTokenRole(firebaseUser);
  if (tokenRole === resolvedRole) {
    return;
  }

  try {
    await syncCurrentUserRoleClaim();
    await firebaseUser.getIdToken(true);
  } catch (error) {
    authClaimSyncLogger.warn('Failed to sync current user role claim', error);
  }
};
