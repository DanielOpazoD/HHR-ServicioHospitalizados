import { getAuthRedirectRuntimeSupport } from '@/services/auth/authRedirectRuntime';
import { AUTH_UI_COPY } from '@/services/auth/authUiCopy';

type LoginRuntimePolicy = {
  preferRedirectOnLocalhost: boolean;
  isLocalhostRuntime: boolean;
  forcePopupForE2E: boolean;
  canUseRedirectAuth: boolean;
  redirectSupportLevel: 'disabled' | 'warning' | 'ready';
  redirectDisabledReason: string | null;
  alternateAccessHint: string | null;
};

export const getLoginRuntimePolicy = (): LoginRuntimePolicy => {
  const redirectRuntimeSupport = getAuthRedirectRuntimeSupport();
  const isLocalE2ERuntime =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const hasE2ERedirectOverride =
    typeof window !== 'undefined' && !!window.localStorage?.getItem('hhr_e2e_redirect_mode');
  const forcePopupForE2E =
    (import.meta.env.VITE_E2E_MODE === 'true' || isLocalE2ERuntime) &&
    typeof window !== 'undefined' &&
    window.localStorage?.getItem('hhr_e2e_force_popup') === 'true';
  const canUseE2EAlternateAccess =
    hasE2ERedirectOverride && (forcePopupForE2E || isLocalE2ERuntime);
  return {
    preferRedirectOnLocalhost: redirectRuntimeSupport.preferRedirectOnLocalhost,
    isLocalhostRuntime: redirectRuntimeSupport.isLocalhostRuntime,
    forcePopupForE2E,
    canUseRedirectAuth: canUseE2EAlternateAccess || redirectRuntimeSupport.canUseRedirectAuth,
    redirectSupportLevel: redirectRuntimeSupport.supportLevel,
    redirectDisabledReason: canUseE2EAlternateAccess
      ? null
      : redirectRuntimeSupport.redirectDisabledReason,
    alternateAccessHint: canUseE2EAlternateAccess
      ? AUTH_UI_COPY.alternateAccessHint
      : redirectRuntimeSupport.canUseRedirectAuth
        ? AUTH_UI_COPY.alternateAccessHint
        : redirectRuntimeSupport.supportSummary,
  };
};

export const getRedirectErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : AUTH_UI_COPY.redirectGenericError;
