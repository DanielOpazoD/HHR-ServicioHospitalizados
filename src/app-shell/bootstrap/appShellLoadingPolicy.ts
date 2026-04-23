import type { AppBootstrapState } from '@/app-shell/bootstrap/useAppBootstrapState';
import { shouldRenderInitialLoadingScreen } from '@/components/ui/InitialLoadingScreen';
import { hasActiveFirebaseSession } from '@/services/auth/authFallback';
import {
  hasPersistedFirebaseAuthHint,
  hasRecentAuthenticatedSessionHint,
} from '@/services/auth/authStorageHints';
import { resolveModuleFromPathname } from '@/hooks/useAppState';

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

export const resolvePreMountLoadingScreenDecision = ({
  pathname,
  hasRecentAuthenticatedSessionHint: providedRecentAuthenticatedSessionHint,
  hasPersistedFirebaseAuthHint: providedPersistedFirebaseAuthHint,
  hasActiveFirebaseSession: providedActiveFirebaseSession,
}: {
  pathname: string | undefined;
  hasRecentAuthenticatedSessionHint?: boolean;
  hasPersistedFirebaseAuthHint?: boolean;
  hasActiveFirebaseSession?: boolean;
}): PreMountLoadingScreenDecision => {
  const recentAuthenticatedSessionHint =
    providedRecentAuthenticatedSessionHint ?? hasRecentAuthenticatedSessionHint();
  const persistedFirebaseAuthHint =
    providedPersistedFirebaseAuthHint ?? hasPersistedFirebaseAuthHint();
  const activeFirebaseSession = providedActiveFirebaseSession ?? hasActiveFirebaseSession();
  const hasAuthenticatedSessionHint =
    recentAuthenticatedSessionHint || persistedFirebaseAuthHint || activeFirebaseSession;

  return {
    shouldRender: false,
    preferLoginShell: false,
    renderBootstrapRouteChrome:
      resolveModuleFromPathname(pathname) !== null && hasAuthenticatedSessionHint,
  };
};

export const resolveRuntimeLoadingScreenMode = ({
  pathname,
  bootstrapState,
}: {
  pathname: string | undefined;
  bootstrapState: Extract<AppBootstrapState, { status: 'loading' }>;
}): AppShellLoadingScreenMode => {
  if (resolveModuleFromPathname(pathname) !== null && bootstrapState.phase === 'rehydrating') {
    return 'bootstrap-route-chrome';
  }

  if (!shouldRenderInitialLoadingScreen(pathname)) {
    return 'silent';
  }

  return 'silent';
};
