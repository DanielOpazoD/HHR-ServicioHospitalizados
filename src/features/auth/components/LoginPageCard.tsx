import React from 'react';
import { AlertCircle, Loader2, RotateCcw } from 'lucide-react';

import { useConfirmDialog } from '@/context';
import { AUTH_UI_COPY } from '@/services/auth/authUiCopy';
import { resetLocalAppStorage } from '@/services/storage/core';

interface LoginPageCardProps {
  isAnyLoading: boolean;
  isGoogleLoading: boolean;
  error: string | null;
  errorCode: string | null;
  canRetryGoogleSignIn?: boolean;
  onGoogleSignIn: () => void | Promise<void>;
}

const GoogleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

export const LoginPageCard: React.FC<LoginPageCardProps> = ({
  isAnyLoading,
  isGoogleLoading,
  error,
  errorCode,
  canRetryGoogleSignIn = false,
  onGoogleSignIn,
}) => {
  const { confirm } = useConfirmDialog();

  const handleResetLocalSession = async () => {
    const confirmed = await confirm({
      title: AUTH_UI_COPY.resetStorageTitle,
      message: AUTH_UI_COPY.resetStorageConfirm,
      confirmText: AUTH_UI_COPY.resetStorageConfirmAction,
      cancelText: 'Volver',
      variant: 'info',
    });

    if (confirmed) {
      await resetLocalAppStorage();
    }
  };

  return (
    <div className="bg-white/85 backdrop-blur-md border border-white/40 rounded-3xl shadow-[0_24px_60px_-30px_rgba(15,23,42,0.45)] p-10 relative overflow-hidden animate-login-reveal animate-login-reveal-delay-2">
      <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-medical-400 to-medical-600"></div>

      <h2 className="text-xl font-bold text-slate-800 mb-2 text-center text-balance">
        Acceso al Sistema
      </h2>
      <div className="mb-8" />

      <button
        type="button"
        onClick={onGoogleSignIn}
        disabled={isAnyLoading}
        data-testid="login-google-button"
        className="w-full bg-white hover:bg-slate-50 disabled:bg-slate-100 border-2 border-slate-200 text-slate-700 font-bold py-4 px-4 rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 shadow-sm hover:shadow-lg hover:border-medical-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]"
      >
        {isGoogleLoading ? (
          <>
            <Loader2 className="w-6 h-6 animate-spin text-medical-600" />
            Conectando con Google...
          </>
        ) : (
          <>
            <GoogleIcon className="w-6 h-6" />
            Ingresar con Google
          </>
        )}
      </button>

      <div className="mt-3 flex justify-center">
        <button
          type="button"
          onClick={() => void handleResetLocalSession()}
          disabled={isAnyLoading}
          data-testid="login-reset-local-button"
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/70 px-2.5 py-1.5 text-[11px] font-medium text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:text-slate-300"
        >
          <RotateCcw className="h-3 w-3" />
          {AUTH_UI_COPY.resetStorageAction}
        </button>
      </div>

      {isGoogleLoading && (
        <div
          data-testid="login-google-pending"
          className="mt-4 rounded-2xl border border-medical-100 bg-medical-50/80 px-4 py-3 text-center"
        >
          <p className="text-sm font-semibold text-medical-800">{AUTH_UI_COPY.popupPendingTitle}</p>
          <p className="mt-1 text-xs text-medical-700 text-balance">
            {AUTH_UI_COPY.popupPendingHint}
          </p>
        </div>
      )}

      {error && (
        <div className="mt-6 animate-fade-in">
          <div
            data-testid="login-error-alert"
            data-auth-error-code={errorCode || undefined}
            className="flex items-center gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-red-700 text-sm text-balance"
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
          {canRetryGoogleSignIn && (
            <div className="mt-3 rounded-2xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-center">
              <p className="text-xs text-amber-800 text-balance">
                {AUTH_UI_COPY.roleValidationRetryHint}
              </p>
              <button
                type="button"
                onClick={() => void onGoogleSignIn()}
                className="mt-3 inline-flex items-center justify-center rounded-xl bg-amber-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-amber-600"
                data-testid="login-retry-button"
              >
                {AUTH_UI_COPY.roleValidationRetryAction}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
