import { useMemo, useState } from 'react';
import { signInWithGoogle, signInWithGoogleRedirect } from '@/services/auth/authService';
import { isPopupRecoverableAuthError } from '@/services/auth/authErrorPolicy';
import {
  getLoginRuntimePolicy,
  getRedirectErrorMessage,
} from '@/features/auth/components/loginRuntimePolicy';
import { AUTH_UI_COPY } from '@/services/auth/authUiCopy';

type BackgroundMode = 'auto' | 'day' | 'night';

export interface LoginPageControllerState {
  error: string | null;
  isGoogleLoading: boolean;
  isRedirectLoading: boolean;
  showAlternateAccess: boolean;
  isAnyLoading: boolean;
  isDayGradient: boolean;
  handleGoogleSignIn: () => Promise<void>;
  handleAlternateAccess: () => Promise<void>;
  toggleBackgroundMode: () => void;
}

export const useLoginPageController = (onLoginSuccess: () => void): LoginPageControllerState => {
  const [error, setError] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isRedirectLoading, setIsRedirectLoading] = useState(false);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>('auto');
  const [showAlternateAccess, setShowAlternateAccess] = useState(false);
  const loginRuntimePolicy = useMemo(() => getLoginRuntimePolicy(), []);

  const runRedirectFlow = async () => {
    if (!loginRuntimePolicy.canUseRedirectAuth) {
      setError(loginRuntimePolicy.redirectDisabledReason || AUTH_UI_COPY.redirectUnavailable);
      return;
    }

    setIsRedirectLoading(true);
    try {
      await signInWithGoogleRedirect();
    } catch (redirectError) {
      setError(getRedirectErrorMessage(redirectError));
    } finally {
      setIsRedirectLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsGoogleLoading(true);
    setShowAlternateAccess(false);

    try {
      if (
        loginRuntimePolicy.isLocalhostRuntime &&
        loginRuntimePolicy.preferRedirectOnLocalhost &&
        !loginRuntimePolicy.forcePopupForE2E
      ) {
        await runRedirectFlow();
        return;
      }

      await signInWithGoogle();
      onLoginSuccess();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isPopupIssue = isPopupRecoverableAuthError(err);

      if (isPopupIssue) {
        setShowAlternateAccess(true);
        if (loginRuntimePolicy.shouldAutoFallbackToRedirect) {
          setError(AUTH_UI_COPY.blockedPopupRetrying);
          await runRedirectFlow();
          return;
        }

        setError(AUTH_UI_COPY.blockedPopupManual);
      } else {
        console.error('[LoginPage] Google sign-in failed', err);
        setError(errorMessage || 'Error al iniciar sesión con Google');
      }
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleAlternateAccess = async () => {
    setError(null);
    await runRedirectFlow();
  };

  const toggleBackgroundMode = () => {
    setBackgroundMode(prev => {
      if (prev === 'auto') return 'day';
      if (prev === 'day') return 'night';
      return 'auto';
    });
  };

  const currentHour = new Date().getHours();
  const isAutoDayWindow = currentHour >= 8 && currentHour < 20;
  const isDayGradient = backgroundMode === 'auto' ? isAutoDayWindow : backgroundMode === 'day';

  return {
    error,
    isGoogleLoading,
    isRedirectLoading,
    showAlternateAccess,
    isAnyLoading: isGoogleLoading || isRedirectLoading,
    isDayGradient,
    handleGoogleSignIn,
    handleAlternateAccess,
    toggleBackgroundMode,
  };
};
