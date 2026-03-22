import { UserRole } from '@/types/auth';
import { normalizeEmail } from '@/services/auth/authShared';
import { getDynamicRoleForEmail, getBootstrapRoleForEmail } from '@/services/auth/authRoleLookup';
import {
  recordAuthOperationalError,
  emitAuthOperationalEvent,
} from '@/services/auth/authOperationalTelemetry';
import { resolveAllowedRoleForEmail } from '@/services/auth/authRoleResolutionController';
import { defaultAuthRuntime } from '@/services/firebase-runtime/authRuntime';

export { clearRoleCacheForEmail } from '@/services/auth/authRoleCache';

export interface GeneralLoginAccessResolution {
  allowed: boolean;
  role?: UserRole;
  resolution: 'authorized' | 'unauthorized' | 'unavailable';
}

export const resolveGeneralLoginAccessForEmail = async (
  email: string
): Promise<GeneralLoginAccessResolution> => {
  try {
    const cleanEmail = normalizeEmail(email);
    const { role, source } = await resolveAllowedRoleForEmail(cleanEmail, {
      getBootstrapRoleForEmail,
      getDynamicRoleForEmail,
    });

    if (role) {
      return { allowed: true, role, resolution: 'authorized' };
    }

    emitAuthOperationalEvent('resolve_general_login_access', 'unauthorized', {
      code: 'auth_email_not_authorized',
      message: `Email not found in config/roles: ${cleanEmail}`,
      severity: 'warning',
      runtimeState: 'unauthorized',
      userSafeMessage: 'El correo no está autorizado para ingresar.',
      context: {
        email: cleanEmail,
        source,
      },
    });
    return { allowed: false, resolution: 'unauthorized' };
  } catch (error) {
    recordAuthOperationalError('resolve_general_login_access', error, {
      code: 'auth_role_lookup_failed',
      message: 'Error resolving general login access from config/roles.',
      severity: 'warning',
      runtimeState: 'retryable',
      userSafeMessage: 'No se pudo validar el acceso del correo en este momento.',
      context: {
        email: normalizeEmail(email),
      },
    });
    return { allowed: false, resolution: 'unavailable' };
  }
};

export const isCurrentUserAuthorizedForGeneralLogin = async (): Promise<boolean> => {
  await defaultAuthRuntime.ready;
  const user = defaultAuthRuntime.getCurrentUser();
  if (!user) return false;
  const { allowed } = await resolveGeneralLoginAccessForEmail(user.email || '');
  return allowed;
};
