import React from 'react';

interface LoginPageHeaderProps {
  isDayGradient: boolean;
}

export const LoginPageHeader: React.FC<LoginPageHeaderProps> = ({ isDayGradient }) => (
  <div className="mb-10 text-center animate-login-reveal animate-login-reveal-delay-1">
    <div className="inline-flex items-center justify-center h-24 w-24 rounded-2xl bg-white/88 p-2 shadow-xl shadow-slate-950/20 backdrop-blur-md animate-float">
      <div className="flex h-full w-full items-center justify-center rounded-xl bg-white">
        <img
          src="/images/logos/logo_HHR.svg"
          alt="Hospital Hanga Roa"
          className="h-full w-full object-contain"
        />
      </div>
    </div>
    <h1
      className={`mt-6 font-display text-3xl font-bold tracking-tight sm:text-[2.1rem] ${
        isDayGradient ? 'text-white' : 'text-white'
      }`}
    >
      Hospital Hanga Roa
    </h1>
    <p className={`mt-2 text-sm ${isDayGradient ? 'text-white/86' : 'text-sky-100/82'}`}>
      Sistema Estadístico de Hospitalizados
    </p>
  </div>
);
