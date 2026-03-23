import React from 'react';
import { Palette } from 'lucide-react';
import { GamesMenu } from '@/features/games';
import { LoginPageCard } from './LoginPageCard';
import { LoginPageFooter } from './LoginPageFooter';
import { LoginPageHeader } from './LoginPageHeader';
import { useLoginPageController } from './useLoginPageController';

export interface LoginPageProps {
  onLoginSuccess: () => void;
  accessMode?: 'default' | 'shared-census';
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, accessMode = 'default' }) => {
  const {
    error,
    errorCode,
    isGoogleLoading,
    isAnyLoading,
    isDayGradient,
    canRetryGoogleSignIn,
    handleGoogleSignIn,
    toggleBackgroundMode,
  } = useLoginPageController(onLoginSuccess);
  const loginBackgroundClass = isDayGradient
    ? 'bg-gradient-to-br from-slate-50 via-blue-50/50 to-slate-100'
    : 'bg-gradient-to-br from-slate-600 via-slate-700 to-slate-900';

  return (
    <div
      data-testid="login-page"
      data-auth-state={isGoogleLoading ? 'google-loading' : 'idle'}
      className={`min-h-screen ${loginBackgroundClass} flex items-center justify-center p-4 relative overflow-hidden transition-colors duration-1000`}
    >
      <div className="absolute top-4 right-4 z-50">
        <GamesMenu />
      </div>
      <button
        type="button"
        onClick={toggleBackgroundMode}
        className="absolute bottom-3 right-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-black/10 text-white/80 backdrop-blur-sm transition hover:bg-black/20"
        aria-label="Cambiar modo de fondo"
        title="Cambiar modo de fondo"
      >
        <Palette className="h-3.5 w-3.5" />
      </button>
      <div className="w-full max-w-sm">
        <LoginPageHeader isDayGradient={isDayGradient} />
        <LoginPageCard
          isAnyLoading={isAnyLoading}
          isGoogleLoading={isGoogleLoading}
          accessMode={accessMode}
          error={error}
          errorCode={errorCode}
          canRetryGoogleSignIn={canRetryGoogleSignIn}
          onGoogleSignIn={handleGoogleSignIn}
        />
        <LoginPageFooter isDayGradient={isDayGradient} />
      </div>
    </div>
  );
};
