import { useEffect, useState } from 'react';
import { isPopupRecoverableAuthError, resolveAuthErrorCode } from '@/services/auth/authErrorPolicy';
import { AUTH_UI_COPY } from '@/services/auth/authUiCopy';
import { executeGoogleSignIn } from '@/application/auth/authSessionUseCases';
import { isAuthBootstrapPending } from '@/services/auth/authBootstrapState';
import { getCurrentAuthSessionState } from '@/services/auth/authSession';
import { createScopedLogger } from '@/services/utils/loggerScope';
import { preloadDefaultPostLoginRoute } from '@/app-shell/bootstrap/authenticatedRoutePreloadController';
import {
  type LoginBackgroundMode,
  persistLoginBackgroundMode,
  resolveInitialLoginBackgroundMode,
} from '@/shared/ui/loginBackgroundModeController';
const POPUP_RECOVERY_GRACE_MS = 1800;
const POPUP_RECOVERY_POLL_MS = 100;
const loginPageLogger = createScopedLogger('LoginPage');

const warmDefaultPostLoginRoute = () => {
  void preloadDefaultPostLoginRoute().catch(err => {
    loginPageLogger.warn('Default post-login preload failed', err);
  });
};

const waitForRecoverablePopupResolution = async (): Promise<boolean> => {
  const hasResolvedSession = () => getCurrentAuthSessionState().status !== 'unauthenticated';
  if (hasResolvedSession() || isAuthBootstrapPending()) {
    return true;
  }

  const startedAt = Date.now();

  while (Date.now() - startedAt < POPUP_RECOVERY_GRACE_MS) {
    await new Promise(resolve => setTimeout(resolve, POPUP_RECOVERY_POLL_MS));
    if (hasResolvedSession() || isAuthBootstrapPending()) {
      return true;
    }
  }

  return false;
};

export interface LoginPageControllerState {
  error: string | null;
  errorCode: string | null;
  isGoogleLoading: boolean;
  isAnyLoading: boolean;
  isDayGradient: boolean;
  backgroundMode: LoginBackgroundMode;
  canRetryGoogleSignIn: boolean;
  handleGoogleSignIn: () => Promise<void>;
  toggleBackgroundMode: () => void;
}

export const useLoginPageController = (onLoginSuccess: () => void): LoginPageControllerState => {
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [backgroundMode, setBackgroundMode] = useState<LoginBackgroundMode>(
    resolveInitialLoginBackgroundMode
  );

  useEffect(() => {
    warmDefaultPostLoginRoute();
  }, []);

  const handleGoogleSignIn = async () => {
    setError(null);
    setErrorCode(null);
    setIsGoogleLoading(true);
    warmDefaultPostLoginRoute();

    try {
      const outcome = await executeGoogleSignIn();
      if (outcome.status === 'success') {
        onLoginSuccess();
        return;
      }

      const issue = outcome.issues[0];
      const errorLike = {
        code: issue?.code || outcome.reason || 'auth/google-signin-failed',
        message:
          issue?.userSafeMessage ||
          outcome.userSafeMessage ||
          issue?.message ||
          'Error al iniciar sesión con Google',
      };
      const isPopupIssue = isPopupRecoverableAuthError(errorLike);
      const resolvedErrorCode = resolveAuthErrorCode(errorLike);

      if (isPopupIssue) {
        if (await waitForRecoverablePopupResolution()) {
          return;
        }
        setErrorCode(resolvedErrorCode || 'auth/popup-recoverable');
        setError(AUTH_UI_COPY.blockedPopupStayOnPage);
      } else {
        loginPageLogger.warn('Google sign-in failed', outcome);
        setErrorCode(resolvedErrorCode || 'auth/google-signin-failed');
        setError(errorLike.message);
      }
      return;
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isPopupIssue = isPopupRecoverableAuthError(err);
      const resolvedErrorCode = resolveAuthErrorCode(err);

      if (isPopupIssue) {
        if (await waitForRecoverablePopupResolution()) {
          return;
        }
        setErrorCode(resolvedErrorCode || 'auth/popup-recoverable');
        setError(AUTH_UI_COPY.blockedPopupStayOnPage);
      } else {
        loginPageLogger.warn('Google sign-in failed', err);
        setErrorCode(resolvedErrorCode || 'auth/google-signin-failed');
        setError(errorMessage || 'Error al iniciar sesión con Google');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const toggleBackgroundMode = () => {
    setBackgroundMode(prev => {
      const nextMode = prev === 'day' ? 'night' : 'day';
      persistLoginBackgroundMode(nextMode);
      return nextMode;
    });
  };

  const isDayGradient = backgroundMode === 'day';

  return {
    error,
    errorCode,
    isGoogleLoading,
    isAnyLoading: isGoogleLoading,
    isDayGradient,
    backgroundMode,
    canRetryGoogleSignIn: errorCode === 'auth/role-validation-unavailable' && !isGoogleLoading,
    handleGoogleSignIn,
    toggleBackgroundMode,
  };
};
