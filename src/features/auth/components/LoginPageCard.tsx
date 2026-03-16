import React from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';

import { AUTH_UI_COPY } from '@/services/auth/authUiCopy';
import { resetLocalAppStorage } from '@/services/storage/core';

interface LoginPageCardProps {
  isAnyLoading: boolean;
  isGoogleLoading: boolean;
  accessMode: 'default' | 'shared-census';
  error: string | null;
  errorCode: string | null;
  onGoogleSignIn: () => void;
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
  accessMode,
  error,
  errorCode,
  onGoogleSignIn,
}) => (
  <div className="bg-white/85 backdrop-blur-md border border-white/40 rounded-3xl shadow-[0_24px_60px_-30px_rgba(15,23,42,0.45)] p-10 relative overflow-hidden animate-login-reveal animate-login-reveal-delay-2">
    <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-medical-400 to-medical-600"></div>

    <h2 className="text-xl font-bold text-slate-800 mb-2 text-center text-balance">
      {accessMode === 'shared-census' ? 'Acceso al Censo Compartido' : 'Acceso al Sistema'}
    </h2>
    {accessMode === 'shared-census' ? (
      <p className="text-sm text-slate-500 mb-6 text-center">
        Inicia sesión con tu correo autorizado para ver el censo diario.
      </p>
    ) : (
      <div className="mb-8" />
    )}

    <button
      type="button"
      onClick={onGoogleSignIn}
      disabled={isAnyLoading}
      data-testid="login-google-button"
      className="w-full bg-white hover:bg-slate-50 disabled:bg-slate-100 border-2 border-slate-200 text-slate-700 font-bold py-4 px-4 rounded-2xl transition-all duration-300 flex items-center justify-center gap-3 shadow-sm hover:shadow-lg hover:border-medical-300 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99]"
    >
      {isGoogleLoading ? (
        <Loader2 className="w-6 h-6 animate-spin text-medical-600" />
      ) : (
        <>
          <GoogleIcon className="w-6 h-6" />
          Ingresar con Google
        </>
      )}
    </button>

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
        <div className="mt-2 text-center">
          <button
            onClick={async () => {
              if (confirm(AUTH_UI_COPY.resetStorageConfirm)) {
                await resetLocalAppStorage();
              }
            }}
            className="text-[10px] text-slate-400 hover:text-medical-600 underline font-medium uppercase tracking-wider"
          >
            {AUTH_UI_COPY.resetStorageAction}
          </button>
        </div>
      </div>
    )}
  </div>
);
