type LoginRuntimePolicy = {
  preferRedirectOnLocalhost: boolean;
  isLocalhostRuntime: boolean;
  forcePopupForE2E: boolean;
  shouldAutoFallbackToRedirect: boolean;
};

export const getLoginRuntimePolicy = (): LoginRuntimePolicy => {
  const preferRedirectOnLocalhost =
    String(import.meta.env.VITE_AUTH_PREFER_REDIRECT_ON_LOCALHOST || 'false').toLowerCase() ===
    'true';
  const isLocalhostRuntime =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  const forcePopupForE2E =
    import.meta.env.VITE_E2E_MODE === 'true' &&
    typeof window !== 'undefined' &&
    window.localStorage?.getItem('hhr_e2e_force_popup') === 'true';
  const autoRedirectFallbackEnabled =
    String(import.meta.env.VITE_AUTH_AUTO_REDIRECT_FALLBACK || 'true').toLowerCase() !== 'false';

  return {
    preferRedirectOnLocalhost,
    isLocalhostRuntime,
    forcePopupForE2E,
    shouldAutoFallbackToRedirect:
      autoRedirectFallbackEnabled && !forcePopupForE2E && !isLocalhostRuntime,
  };
};

export const getRedirectErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : 'No fue posible iniciar por redirección.';
