import { onAuthStateChanged, signOut as firebaseSignOut, User } from 'firebase/auth';
import { AuthSessionState } from '@/types/auth';
import { clearRoleCacheForEmail } from '@/services/auth/authPolicy';
import { resolveFirebaseUserRole } from '@/services/auth/authAccessResolution';
import { resolveAuthSessionState } from '@/services/auth/authSessionController';
import { recordAuthOperationalError } from '@/services/auth/authOperationalTelemetry';
import {
  ensureUserRoleClaim,
  resetAuthClaimSyncSnapshot,
} from '@/services/auth/authClaimSyncService';
import {
  createAuthErrorSessionState,
  createUnauthenticatedAuthSessionState,
  createUnauthorizedAuthSessionState,
  toAnonymousSignatureAuthSessionState,
} from '@/services/auth/authSessionState';
import { type AuthRuntime, defaultAuthRuntime } from '@/services/firebase-runtime/authRuntime';

interface AuthRuntimeOptions {
  authRuntime?: AuthRuntime;
}

const resolveAuthRuntime = ({ authRuntime }: AuthRuntimeOptions = {}): AuthRuntime =>
  authRuntime ?? defaultAuthRuntime;

export const signOut = async (options?: AuthRuntimeOptions): Promise<void> => {
  const authRuntime = resolveAuthRuntime(options);
  await authRuntime.ready;
  const userEmail = authRuntime.getCurrentUser()?.email;
  resetAuthClaimSyncSnapshot();
  await firebaseSignOut(authRuntime.auth);

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
  callback: (sessionState: AuthSessionState) => void | Promise<void>,
  options?: AuthRuntimeOptions
): (() => void) => {
  const authRuntime = resolveAuthRuntime(options);
  let active = true;
  let unsubscribeAuth = () => {};

  void authRuntime.ready
    .then(() => {
      if (!active) {
        return;
      }

      unsubscribeAuth = onAuthStateChanged(authRuntime.auth, async (firebaseUser: User | null) => {
        if (!firebaseUser) {
          resetAuthClaimSyncSnapshot();
          await callback(createUnauthenticatedAuthSessionState());
          return;
        }

        if (firebaseUser.isAnonymous) {
          resetAuthClaimSyncSnapshot();
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
            signOutUnauthorizedUser: () => firebaseSignOut(authRuntime.auth),
            resolveFirebaseUserRole,
          });
          if (sessionState.status !== 'authorized') {
            resetAuthClaimSyncSnapshot();
          }
          await callback(sessionState);
          if (sessionState.status === 'authorized' && sessionState.user.role) {
            void ensureUserRoleClaim(firebaseUser, sessionState.user.role);
          }
        } catch (error) {
          resetAuthClaimSyncSnapshot();
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
      });
    })
    .catch(async error => {
      resetAuthClaimSyncSnapshot();
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

export const resolveCurrentAuthSessionState = async (
  options?: AuthRuntimeOptions
): Promise<AuthSessionState> => {
  const authRuntime = resolveAuthRuntime(options);
  await authRuntime.ready;
  const firebaseUser = authRuntime.getCurrentUser();

  if (!firebaseUser) {
    resetAuthClaimSyncSnapshot();
    return createUnauthenticatedAuthSessionState();
  }

  if (firebaseUser.isAnonymous) {
    resetAuthClaimSyncSnapshot();
    return toAnonymousSignatureAuthSessionState({
      uid: firebaseUser.uid,
      email: null,
      displayName: 'Anonymous Doctor',
      role: 'viewer',
    });
  }

  try {
    const sessionState = await resolveAuthSessionState(firebaseUser, {
      signOutUnauthorizedUser: () => firebaseSignOut(authRuntime.auth),
      resolveFirebaseUserRole,
    });
    if (sessionState.status !== 'authorized') {
      resetAuthClaimSyncSnapshot();
    }
    if (sessionState.status === 'authorized' && sessionState.user.role) {
      void ensureUserRoleClaim(firebaseUser, sessionState.user.role);
    }
    return sessionState;
  } catch (error) {
    resetAuthClaimSyncSnapshot();
    const operationalError = recordAuthOperationalError(
      'resolve_current_auth_session_state',
      error,
      {
        code: 'auth_session_state_resolution_failed',
        message: 'Failed to resolve the current authentication session state.',
        severity: 'warning',
        userSafeMessage: 'No se pudo resolver la sesion actual.',
      }
    );
    return createAuthErrorSessionState({
      code: operationalError.code,
      message: operationalError.message,
      userSafeMessage: operationalError.userSafeMessage,
      severity: operationalError.severity === 'error' ? 'error' : 'warning',
      technicalContext: operationalError.context,
      telemetryTags: ['auth', 'session_state'],
    });
  }
};

export const getCurrentAuthSessionState = (options?: AuthRuntimeOptions): AuthSessionState => {
  const authRuntime = resolveAuthRuntime(options);
  const user = authRuntime.getCurrentUser();
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
