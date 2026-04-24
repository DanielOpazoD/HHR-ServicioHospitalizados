import type { AppBootstrapState } from '@/app-shell/bootstrap/useAppBootstrapState';
import { shouldRenderInitialLoadingScreen } from '@/components/ui/InitialLoadingScreen';
import { hasActiveFirebaseSession } from '@/services/auth/authFallback';
import { hasPersistedFirebaseAuthHint } from '@/services/auth/authStorageHints';
import { resolveModuleFromPathname } from '@/hooks/controllers/appStateNavigationController';

export type AppShellLoadingScreenMode =
  | 'silent'
  | 'default'
  | 'login-shell'
  | 'bootstrap-route-chrome';

export interface PreMountLoadingScreenDecision {
  shouldRender: boolean;
  preferLoginShell: boolean;
  renderBootstrapRouteChrome: boolean;
}

const normalizePathname = (pathname: string | undefined): string =>
  (pathname ?? '/').replace(/^\/+|\/+$/g, '');

const isLoginShellPath = (pathname: string | undefined): boolean => {
  const normalizedPath = normalizePathname(pathname);
  return normalizedPath === '' || normalizedPath === 'login';
};

export const resolvePreMountLoadingScreenDecision = ({
  pathname,
  hasPersistedFirebaseAuthHint: providedPersistedFirebaseAuthHint,
  hasActiveFirebaseSession: providedActiveFirebaseSession,
}: {
  pathname: string | undefined;
  hasRecentAuthenticatedSessionHint?: boolean;
  hasPersistedFirebaseAuthHint?: boolean;
  hasActiveFirebaseSession?: boolean;
}): PreMountLoadingScreenDecision => {
  const persistedFirebaseAuthHint =
    providedPersistedFirebaseAuthHint ?? hasPersistedFirebaseAuthHint();
  const activeFirebaseSession = providedActiveFirebaseSession ?? hasActiveFirebaseSession();
  const hasStrongAuthenticatedSessionHint = persistedFirebaseAuthHint || activeFirebaseSession;

  if (isLoginShellPath(pathname)) {
    return {
      shouldRender: true,
      preferLoginShell: true,
      renderBootstrapRouteChrome: false,
    };
  }

  if (resolveModuleFromPathname(pathname) !== null && !hasStrongAuthenticatedSessionHint) {
    return {
      shouldRender: true,
      preferLoginShell: true,
      renderBootstrapRouteChrome: false,
    };
  }

  return {
    shouldRender: false,
    preferLoginShell: false,
    renderBootstrapRouteChrome:
      resolveModuleFromPathname(pathname) !== null && hasStrongAuthenticatedSessionHint,
  };
};

const hasAuthorizedRuntimeEvidence = (
  auth: Extract<AppBootstrapState, { status: 'loading' }>['auth']
): boolean =>
  auth.sessionState.status === 'authorized' ||
  auth.isAuthenticated ||
  auth.isAuthorizedSession ||
  auth.isFirebaseConnected ||
  Boolean(auth.currentUser) ||
  Boolean(auth.authorizedUser);

export const resolveRuntimeLoadingScreenMode = ({
  pathname,
  bootstrapState,
}: {
  pathname: string | undefined;
  bootstrapState: Extract<AppBootstrapState, { status: 'loading' }>;
}): AppShellLoadingScreenMode => {
  if (isLoginShellPath(pathname) && bootstrapState.auth.sessionState.status !== 'authorized') {
    return 'login-shell';
  }

  if (isLoginShellPath(pathname)) {
    return 'silent';
  }

  const routeModule = resolveModuleFromPathname(pathname);
  if (routeModule !== null && hasAuthorizedRuntimeEvidence(bootstrapState.auth)) {
    return 'bootstrap-route-chrome';
  }

  if (routeModule !== null) {
    return 'login-shell';
  }

  if (!shouldRenderInitialLoadingScreen(pathname)) {
    return 'silent';
  }

  return 'silent';
};
