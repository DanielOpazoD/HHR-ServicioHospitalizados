import React from 'react';
import { MoonStar, SunMedium } from 'lucide-react';
import { LoginPageCard } from './LoginPageCard';
import { LoginPageFooter } from './LoginPageFooter';
import { LoginPageHeader } from './LoginPageHeader';
import { useLoginPageController } from './useLoginPageController';

export interface LoginPageProps {
  onLoginSuccess: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
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
  const BackgroundModeIcon = isDayGradient ? SunMedium : MoonStar;
  const backgroundModeLabel = isDayGradient ? 'Día' : 'Noche';

  return (
    <div
      data-testid="login-page"
      data-auth-state={isGoogleLoading ? 'google-loading' : 'idle'}
      className="relative min-h-screen overflow-hidden bg-slate-950"
    >
      {/* Both background images stay mounted and crossfade via opacity so the
          day ↔ night toggle feels continuous instead of a hard cut. Preloads
          both images on first paint (minor cost, big perceptual win). */}
      <div
        className={`absolute inset-0 bg-cover bg-center transition-opacity duration-700 ease-out ${
          isDayGradient ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ backgroundImage: `url('/images/login/hhr-login-day.png')` }}
        aria-hidden="true"
      />
      <div
        className={`absolute inset-0 bg-cover bg-center transition-opacity duration-700 ease-out ${
          isDayGradient ? 'opacity-0' : 'opacity-100'
        }`}
        style={{ backgroundImage: `url('/images/login/hhr-login-night.png')` }}
        aria-hidden="true"
      />
      <div
        className={`absolute inset-0 transition-all duration-1000 ${
          isDayGradient
            ? 'bg-[linear-gradient(115deg,rgba(15,23,42,0.82)_0%,rgba(15,23,42,0.62)_36%,rgba(15,23,42,0.28)_64%,rgba(255,255,255,0.08)_100%)]'
            : 'bg-[linear-gradient(115deg,rgba(2,6,23,0.92)_0%,rgba(2,6,23,0.78)_35%,rgba(2,6,23,0.44)_66%,rgba(2,6,23,0.22)_100%)]'
        }`}
        aria-hidden="true"
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.14),transparent_26%)]"
        aria-hidden="true"
      />
      <button
        type="button"
        onClick={toggleBackgroundMode}
        className="absolute right-4 top-4 z-20 inline-flex items-center gap-2 rounded-full border border-white/18 bg-slate-950/28 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/88 shadow-lg shadow-slate-950/30 backdrop-blur-md transition hover:bg-slate-950/38 sm:right-6 sm:top-6"
        aria-label="Cambiar modo de fondo"
        title="Cambiar modo de fondo"
      >
        <BackgroundModeIcon className="h-3.5 w-3.5" />
        <span>{backgroundModeLabel}</span>
      </button>
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-6 sm:px-6">
        <div className="w-full max-w-sm">
          <LoginPageHeader isDayGradient={isDayGradient} />
          <LoginPageCard
            isDayGradient={isDayGradient}
            isAnyLoading={isAnyLoading}
            isGoogleLoading={isGoogleLoading}
            error={error}
            errorCode={errorCode}
            canRetryGoogleSignIn={canRetryGoogleSignIn}
            onGoogleSignIn={handleGoogleSignIn}
          />
          <LoginPageFooter isDayGradient={isDayGradient} />
        </div>
      </div>
    </div>
  );
};
