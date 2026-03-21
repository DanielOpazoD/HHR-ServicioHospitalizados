import { signOut as firebaseSignOut, User } from 'firebase/auth';
import { AuthUser, UserRole } from '@/types/auth';
import { checkSharedCensusAccess, isSharedCensusMode } from '@/services/auth/sharedCensusAuth';
import { resolveGeneralLoginAccessForEmail } from '@/services/auth/authPolicy';
import { toAuthUser } from '@/services/auth/authShared';
import { recordAuthOperationalError } from '@/services/auth/authOperationalTelemetry';
import { defaultAuthRuntime } from '@/services/firebase-runtime/authRuntime';

const SHARED_CENSUS_UNAUTHORIZED_MESSAGE =
  'Acceso no autorizado. Tu correo no tiene permisos para censo compartido.';
const STANDARD_UNAUTHORIZED_MESSAGE =
  'Acceso no autorizado. Tu correo no tiene un rol vigente en Gestión de Roles.';

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

  const { allowed, role } = await resolveGeneralLoginAccessForEmail(user.email || '');
  if (!allowed) {
    return rejectUnauthorizedUser(STANDARD_UNAUTHORIZED_MESSAGE);
  }

  return toAuthUser(user, role);
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
    return null;
  } catch (error) {
    recordAuthOperationalError('resolve_firebase_user_role', error, {
      code: 'auth_token_role_resolution_failed',
      message: 'Error resolving role from config/roles.',
      severity: 'warning',
      userSafeMessage: 'No se pudo resolver el rol desde la sesión actual.',
      context: {
        email: firebaseUser.email || null,
      },
    });
    const { allowed, role } = await resolveGeneralLoginAccessForEmail(firebaseUser.email || '');
    return allowed ? role || null : null;
  }
};
