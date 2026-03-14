import { signOut as firebaseSignOut, User } from 'firebase/auth';
import { auth } from '@/firebaseConfig';
import { AuthUser, UserRole } from '@/types';
import { checkSharedCensusAccess, isSharedCensusMode } from '@/services/auth/sharedCensusAuth';
import {
  canAccessSpecialistMedicalHandoff,
  isSpecialistMedicalHandoffMode,
} from '@/services/auth/specialistMedicalHandoffAuth';
import { checkEmailInFirestore } from '@/services/auth/authPolicy';
import { toAuthUser } from '@/services/auth/authShared';
import { recordAuthOperationalError } from '@/services/auth/authOperationalTelemetry';

const SHARED_CENSUS_UNAUTHORIZED_MESSAGE =
  'Acceso no autorizado. Tu correo no tiene permisos para censo compartido.';
const SPECIALIST_MEDICAL_HANDOFF_UNAUTHORIZED_MESSAGE =
  'Acceso no autorizado. Tu correo no tiene permisos para la entrega médica de especialistas.';
const STANDARD_UNAUTHORIZED_MESSAGE =
  'Acceso no autorizado. Su correo no está en la lista de usuarios permitidos.';

const rejectUnauthorizedUser = async (message: string): Promise<never> => {
  await firebaseSignOut(auth);
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

  if (isSpecialistMedicalHandoffMode()) {
    const { allowed, role } = await checkEmailInFirestore(user.email || '');
    if (!allowed || !canAccessSpecialistMedicalHandoff(role)) {
      return rejectUnauthorizedUser(SPECIALIST_MEDICAL_HANDOFF_UNAUTHORIZED_MESSAGE);
    }

    return toAuthUser(user, 'doctor_specialist');
  }

  const { allowed, role } = await checkEmailInFirestore(user.email || '');
  if (!allowed) {
    return rejectUnauthorizedUser(STANDARD_UNAUTHORIZED_MESSAGE);
  }

  return toAuthUser(user, role);
};

export const authorizeCurrentFirebaseUser = async (): Promise<AuthUser | null> => {
  const existingUser = auth.currentUser;
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

export const resolveFirebaseUserRole = async (firebaseUser: User): Promise<UserRole> => {
  try {
    const tokenResult = await firebaseUser.getIdTokenResult();
    let role = tokenResult.claims.role as UserRole;

    if (!role || role === 'viewer' || role === 'editor') {
      const whitelistResult = await checkEmailInFirestore(firebaseUser.email || '');
      if (whitelistResult.allowed && whitelistResult.role) {
        role = whitelistResult.role;
      }
    }

    return role || 'viewer';
  } catch (error) {
    recordAuthOperationalError('resolve_firebase_user_role', error, {
      code: 'auth_token_role_resolution_failed',
      message: 'Error getting ID token result.',
      severity: 'warning',
      userSafeMessage: 'No se pudo resolver el rol desde la sesión actual.',
      context: {
        email: firebaseUser.email || null,
      },
    });
    const { role } = await checkEmailInFirestore(firebaseUser.email || '');
    return role || 'viewer';
  }
};
