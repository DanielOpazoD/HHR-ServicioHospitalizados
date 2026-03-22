import { signOut as firebaseSignOut, User } from 'firebase/auth';
import { AuthUser, UserRole } from '@/types/auth';
import { checkSharedCensusAccess, isSharedCensusMode } from '@/services/auth/sharedCensusAuth';
import { resolveGeneralLoginAccessForEmail } from '@/services/auth/authPolicy';
import { createAuthError, toAuthUser } from '@/services/auth/authShared';
import { recordAuthOperationalError } from '@/services/auth/authOperationalTelemetry';
import { defaultAuthRuntime } from '@/services/firebase-runtime/authRuntime';
import { resolveUserRoleClaim } from '@/services/auth/authClaimSyncService';

const SHARED_CENSUS_UNAUTHORIZED_MESSAGE =
  'Acceso no autorizado. Tu correo no tiene permisos para censo compartido.';
const STANDARD_UNAUTHORIZED_MESSAGE =
  'Acceso no autorizado. Tu correo no tiene un rol vigente en Gestión de Roles.';
const ROLE_VALIDATION_UNAVAILABLE_MESSAGE =
  'No se pudo validar tu acceso en este momento. Intenta nuevamente en unos segundos.';

const rejectUnauthorizedUser = async (message: string): Promise<never> => {
  await defaultAuthRuntime.ready;
  await firebaseSignOut(defaultAuthRuntime.auth);
  throw new Error(message);
};

export const authorizeFirebaseUser = async (user: User): Promise<AuthUser> => {
  if (isSharedCensusMode()) {
    const sharedAccess = await checkSharedCensusAccess(user.email);
    if (!sharedAccess.authorized) {
      return rejectUnauthorizedUser(SHARED_CENSUS_UNAUTHORIZED_MESSAGE);
    }

    return toAuthUser(user, 'viewer_census');
  }

  const { allowed, role, resolution } = await resolveGeneralLoginAccessForEmail(user.email || '');
  if (allowed && role) {
    return toAuthUser(user, role);
  }

  if (resolution === 'unavailable') {
    const tokenRole = await resolveUserRoleClaim(user);
    if (tokenRole) {
      return toAuthUser(user, tokenRole);
    }

    throw createAuthError('auth/role-validation-unavailable', ROLE_VALIDATION_UNAVAILABLE_MESSAGE);
  }

  if (!allowed) {
    return rejectUnauthorizedUser(STANDARD_UNAUTHORIZED_MESSAGE);
  }
  throw createAuthError('auth/role-validation-unavailable', ROLE_VALIDATION_UNAVAILABLE_MESSAGE);
};

export const authorizeCurrentFirebaseUser = async (): Promise<AuthUser | null> => {
  await defaultAuthRuntime.ready;
  const existingUser = defaultAuthRuntime.getCurrentUser();
  if (!existingUser || existingUser.isAnonymous) {
    return null;
  }

  try {
    return await authorizeFirebaseUser(existingUser);
  } catch (error) {
    const err = error as { message?: string };
    if (err.message?.includes('no autorizado')) {
      return null;
    }
    throw error;
  }
};

export const resolveFirebaseUserRole = async (firebaseUser: User): Promise<UserRole | null> => {
  try {
    const loginAccess = await resolveGeneralLoginAccessForEmail(firebaseUser.email || '');
    if (loginAccess.allowed && loginAccess.role) {
      return loginAccess.role;
    }

    if (loginAccess.resolution === 'unavailable') {
      const tokenRole = await resolveUserRoleClaim(firebaseUser);
      if (tokenRole) {
        return tokenRole;
      }

      throw createAuthError(
        'auth/role-validation-unavailable',
        ROLE_VALIDATION_UNAVAILABLE_MESSAGE
      );
    }

    return null;
  } catch (error) {
    recordAuthOperationalError('resolve_firebase_user_role', error, {
      code: 'auth_token_role_resolution_failed',
      message: 'Error resolving role from config/roles.',
      severity: 'warning',
      runtimeState: 'retryable',
      userSafeMessage: 'No se pudo resolver el rol desde la sesión actual.',
      context: {
        email: firebaseUser.email || null,
      },
    });
    throw error;
  }
};
