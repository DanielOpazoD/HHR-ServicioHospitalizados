import { onAuthStateChanged, signOut as firebaseSignOut, User } from 'firebase/auth';
import { AuthSessionState } from '@/types/auth';
import { checkSharedCensusAccess, isSharedCensusMode } from '@/services/auth/sharedCensusAuth';
import { clearRoleCacheForEmail } from '@/services/auth/authPolicy';
import { resolveFirebaseUserRole } from '@/services/auth/authAccessResolution';
import { resolveAuthSessionState } from '@/services/auth/authSessionController';
import { recordAuthOperationalError } from '@/services/auth/authOperationalTelemetry';
import { ensureUserRoleClaim } from '@/services/auth/authClaimSyncService';
import {
  createAuthErrorSessionState,
  createUnauthenticatedAuthSessionState,
  createUnauthorizedAuthSessionState,
  toAnonymousSignatureAuthSessionState,
} from '@/services/auth/authSessionState';
import { defaultAuthRuntime } from '@/services/firebase-runtime/authRuntime';

export const signOut = async (): Promise<void> => {
  await defaultAuthRuntime.ready;
  const userEmail = defaultAuthRuntime.getCurrentUser()?.email;
  await firebaseSignOut(defaultAuthRuntime.auth);

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

export const onAuthSessionStateChange = (
  callback: (sessionState: AuthSessionState) => void | Promise<void>
): (() => void) => {
  let active = true;
  let unsubscribeAuth = () => {};

  void defaultAuthRuntime.ready
    .then(() => {
      if (!active) {
        return;
      }

      unsubscribeAuth = onAuthStateChanged(
        defaultAuthRuntime.auth,
        async (firebaseUser: User | null) => {
          if (!firebaseUser) {
            await callback(createUnauthenticatedAuthSessionState());
            return;
          }

          if (firebaseUser.isAnonymous) {
            await callback(
              toAnonymousSignatureAuthSessionState({
                uid: firebaseUser.uid,
                email: null,
                displayName: 'Anonymous Doctor',
                role: 'viewer',
              })
            );
            return;
          }

          try {
            const sessionState = await resolveAuthSessionState(firebaseUser, {
              isSharedCensusMode,
              checkSharedCensusAccess,
              signOutUnauthorizedUser: () => firebaseSignOut(defaultAuthRuntime.auth),
              resolveFirebaseUserRole,
            });
            await callback(sessionState);
            if (sessionState.status === 'authorized' && sessionState.user.role) {
              void ensureUserRoleClaim(firebaseUser, sessionState.user.role);
            }
          } catch (error) {
            const operationalError = recordAuthOperationalError(
              'on_auth_session_state_change',
              error,
              {
                code: 'auth_session_state_resolution_failed',
                message: 'Failed to resolve authentication session state.',
                severity: 'warning',
                userSafeMessage: 'No se pudo resolver la sesión actual.',
              }
            );
            await callback(
              createAuthErrorSessionState({
                code: operationalError.code,
                message: operationalError.message,
                userSafeMessage: operationalError.userSafeMessage,
                severity: operationalError.severity === 'error' ? 'error' : 'warning',
                technicalContext: operationalError.context,
                telemetryTags: ['auth', 'session_state'],
              })
            );
          }
        }
      );
    })
    .catch(async error => {
      const operationalError = recordAuthOperationalError('on_auth_session_state_change', error, {
        code: 'auth_session_state_resolution_failed',
        message: 'Failed to initialize authentication session observer.',
        severity: 'warning',
        userSafeMessage: 'No se pudo inicializar la sesión actual.',
      });
      if (active) {
        await callback(
          createAuthErrorSessionState({
            code: operationalError.code,
            message: operationalError.message,
            userSafeMessage: operationalError.userSafeMessage,
            severity: operationalError.severity === 'error' ? 'error' : 'warning',
            technicalContext: operationalError.context,
            telemetryTags: ['auth', 'session_state'],
          })
        );
      }
    });

  return () => {
    active = false;
    unsubscribeAuth();
  };
};

export const getCurrentAuthSessionState = (): AuthSessionState => {
  const user = defaultAuthRuntime.getCurrentUser();
  if (!user) {
    return createUnauthenticatedAuthSessionState();
  }

  if (user.isAnonymous) {
    return toAnonymousSignatureAuthSessionState({
      uid: user.uid,
      email: null,
      displayName: 'Anonymous Doctor',
      role: 'viewer',
    });
  }

  return createUnauthorizedAuthSessionState('session_requires_resolution', {
    email: user.email,
  });
};
