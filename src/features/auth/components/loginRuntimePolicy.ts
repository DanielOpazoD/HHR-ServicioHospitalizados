import { getAuthRedirectRuntimeSupport } from '@/services/auth/authRedirectRuntime';
import { AUTH_UI_COPY } from '@/services/auth/authUiCopy';

type LoginRuntimePolicy = {
  preferRedirectOnLocalhost: boolean;
  isLocalhostRuntime: boolean;
  forcePopupForE2E: boolean;
  shouldAutoFallbackToRedirect: boolean;
  canUseRedirectAuth: boolean;
  redirectSupportLevel: 'disabled' | 'warning' | 'ready';
  redirectDisabledReason: string | null;
  alternateAccessHint: string | null;
};

export const getLoginRuntimePolicy = (): LoginRuntimePolicy => {
  const redirectRuntimeSupport = getAuthRedirectRuntimeSupport();
  const forcePopupForE2E =
    import.meta.env.VITE_E2E_MODE === 'true' &&
    typeof window !== 'undefined' &&
    window.localStorage?.getItem('hhr_e2e_force_popup') === 'true';
  const autoRedirectFallbackEnabled =
    String(import.meta.env.VITE_AUTH_AUTO_REDIRECT_FALLBACK || 'true').toLowerCase() !== 'false';

  return {
    preferRedirectOnLocalhost: redirectRuntimeSupport.preferRedirectOnLocalhost,
    isLocalhostRuntime: redirectRuntimeSupport.isLocalhostRuntime,
    forcePopupForE2E,
    shouldAutoFallbackToRedirect:
      autoRedirectFallbackEnabled && !forcePopupForE2E && redirectRuntimeSupport.canUseRedirectAuth,
    canUseRedirectAuth: redirectRuntimeSupport.canUseRedirectAuth,
    redirectSupportLevel: redirectRuntimeSupport.supportLevel,
    redirectDisabledReason: redirectRuntimeSupport.redirectDisabledReason,
    alternateAccessHint: redirectRuntimeSupport.canUseRedirectAuth
      ? AUTH_UI_COPY.alternateAccessHint
      : redirectRuntimeSupport.supportSummary,
  };
};

export const getRedirectErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : AUTH_UI_COPY.redirectGenericError;
