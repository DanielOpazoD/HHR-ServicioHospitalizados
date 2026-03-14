import { useState } from 'react';
import { signInWithGoogle } from '@/services/auth/authService';
import { isPopupRecoverableAuthError, resolveAuthErrorCode } from '@/services/auth/authErrorPolicy';
import { AUTH_UI_COPY } from '@/services/auth/authUiCopy';

type BackgroundMode = 'auto' | 'day' | 'night';

export interface LoginPageControllerState {
  error: string | null;
  errorCode: string | null;
  isGoogleLoading: boolean;
  isAnyLoading: boolean;
  isDayGradient: boolean;
  handleGoogleSignIn: () => Promise<void>;
  toggleBackgroundMode: () => void;
}

export const useLoginPageController = (onLoginSuccess: () => void): LoginPageControllerState => {
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>('auto');

  const handleGoogleSignIn = async () => {
    setError(null);
    setErrorCode(null);
    setIsGoogleLoading(true);

    try {
      await signInWithGoogle();
      onLoginSuccess();
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const isPopupIssue = isPopupRecoverableAuthError(err);
      const resolvedErrorCode = resolveAuthErrorCode(err);

      if (isPopupIssue) {
        setErrorCode(resolvedErrorCode || 'auth/popup-recoverable');
        setError(AUTH_UI_COPY.blockedPopupStayOnPage);
      } else {
        console.error('[LoginPage] Google sign-in failed', err);
        setErrorCode(resolvedErrorCode || 'auth/google-signin-failed');
        setError(errorMessage || 'Error al iniciar sesión con Google');
      }
    } finally {
      setIsGoogleLoading(false);
    }
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
    errorCode,
    isGoogleLoading,
    isAnyLoading: isGoogleLoading,
    isDayGradient,
    handleGoogleSignIn,
    toggleBackgroundMode,
  };
};
