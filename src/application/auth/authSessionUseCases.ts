import {
  createApplicationFailed,
  createApplicationSuccess,
  type ApplicationIssue,
  type ApplicationOutcome,
} from '@/shared/contracts/applicationOutcome';
import type { AuthSessionState } from '@/types/auth';
import { signIn, signInWithGoogle } from '@/services/auth/authFlow';
import {
  getCurrentAuthSessionState,
  resolveCurrentAuthSessionState,
} from '@/services/auth/authSession';
import { handleSignInRedirectResult } from '@/services/auth/authFallback';
import { isPopupRecoverableAuthError, resolveAuthErrorCode } from '@/services/auth/authErrorPolicy';
import { toResolvedAuthSessionState } from '@/services/auth/authSessionState';

const buildAuthIssue = (
  error: unknown,
  fallbackCode: string,
  fallbackMessage: string
): ApplicationIssue => {
  const code = resolveAuthErrorCode(error) || fallbackCode;
  const message = error instanceof Error ? error.message || fallbackMessage : fallbackMessage;
  const retryable = isPopupRecoverableAuthError(error);
  return {
    kind: 'unknown',
    code,
    message,
    userSafeMessage: message,
    retryable,
    severity: retryable ? 'warning' : 'error',
    technicalContext: {
      errorName: error instanceof Error ? error.name : typeof error,
    },
    telemetryTags: ['auth', code],
  };
};

const buildAuthFailure = (
  error: unknown,
  fallbackCode: string,
  fallbackMessage: string
): ApplicationOutcome<AuthSessionState> => {
  const issue = buildAuthIssue(error, fallbackCode, fallbackMessage);
  return createApplicationFailed(
    {
      status: 'auth_error',
      user: null,
      error: {
        code: issue.code,
        message: issue.message,
        userSafeMessage: issue.userSafeMessage,
        retryable: issue.retryable,
        severity: issue.severity === 'warning' ? 'warning' : 'error',
        technicalContext: issue.technicalContext,
        telemetryTags: issue.telemetryTags,
      },
    },
    [issue],
    {
      reason: issue.code,
      userSafeMessage: issue.userSafeMessage,
      retryable: issue.retryable,
      severity: issue.severity,
      technicalContext: issue.technicalContext,
      telemetryTags: issue.telemetryTags,
    }
  );
};

export const executeGoogleSignIn = async (): Promise<ApplicationOutcome<AuthSessionState>> => {
  try {
    const user = await signInWithGoogle();
    return createApplicationSuccess(toResolvedAuthSessionState(user));
  } catch (error) {
    return buildAuthFailure(
      error,
      'auth/google-signin-failed',
      'Error al iniciar sesión con Google'
    );
  }
};

export const executeCredentialSignIn = async (
  email: string,
  password: string
): Promise<ApplicationOutcome<AuthSessionState>> => {
  try {
    const user = await signIn(email, password);
    return createApplicationSuccess(toResolvedAuthSessionState(user));
  } catch (error) {
    return buildAuthFailure(error, 'auth/credential-signin-failed', 'Error de autenticación');
  }
};

export const executeRedirectAuthResolution = async (): Promise<
  ApplicationOutcome<AuthSessionState | null>
> => {
  const sessionState = await handleSignInRedirectResult();
  if (!sessionState) {
    return createApplicationSuccess(null);
  }

  if (sessionState.status === 'auth_error') {
    return createApplicationFailed(
      sessionState,
      [
        {
          kind: 'unknown',
          code: sessionState.error.code,
          message: sessionState.error.message,
          userSafeMessage: sessionState.error.userSafeMessage,
          retryable: sessionState.error.retryable,
          severity: sessionState.error.severity === 'warning' ? 'warning' : 'error',
          technicalContext: sessionState.error.technicalContext,
          telemetryTags: sessionState.error.telemetryTags,
        },
      ],
      {
        reason: sessionState.error.code,
        userSafeMessage: sessionState.error.userSafeMessage,
        retryable: sessionState.error.retryable,
        severity: sessionState.error.severity === 'warning' ? 'warning' : 'error',
        technicalContext: sessionState.error.technicalContext,
        telemetryTags: sessionState.error.telemetryTags,
      }
    );
  }

  return createApplicationSuccess(sessionState);
};

export const executeCurrentAuthSessionState = (): ApplicationOutcome<AuthSessionState> =>
  createApplicationSuccess(getCurrentAuthSessionState());

export const executeResolvedCurrentAuthSessionState = async (): Promise<
  ApplicationOutcome<AuthSessionState | null>
> => {
  const sessionState = await resolveCurrentAuthSessionState();
  if (sessionState.status === 'unauthenticated') {
    return createApplicationSuccess(null);
  }

  if (sessionState.status === 'auth_error') {
    return createApplicationFailed(
      sessionState,
      [
        {
          kind: 'unknown',
          code: sessionState.error.code,
          message: sessionState.error.message,
          userSafeMessage: sessionState.error.userSafeMessage,
          retryable: sessionState.error.retryable,
          severity: sessionState.error.severity === 'warning' ? 'warning' : 'error',
          technicalContext: sessionState.error.technicalContext,
          telemetryTags: sessionState.error.telemetryTags,
        },
      ],
      {
        reason: sessionState.error.code,
        userSafeMessage: sessionState.error.userSafeMessage,
        retryable: sessionState.error.retryable,
        severity: sessionState.error.severity === 'warning' ? 'warning' : 'error',
        technicalContext: sessionState.error.technicalContext,
        telemetryTags: sessionState.error.telemetryTags,
      }
    );
  }

  return createApplicationSuccess(sessionState);
};
