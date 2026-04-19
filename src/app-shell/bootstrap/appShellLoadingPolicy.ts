import type { AppBootstrapState } from '@/app-shell/bootstrap/useAppBootstrapState';
import { shouldRenderInitialLoadingScreen } from '@/components/ui/InitialLoadingScreen';

export type AppShellLoadingScreenMode = 'silent' | 'default' | 'login-shell';

export interface PreMountLoadingScreenDecision {
  shouldRender: boolean;
  preferLoginShell: boolean;
}

export const resolvePreMountLoadingScreenDecision = ({
  pathname,
  hasRecentAuthenticatedSessionHint,
  hasPersistedFirebaseAuthHint,
  hasActiveFirebaseSession,
}: {
  pathname: string | undefined;
  hasRecentAuthenticatedSessionHint: boolean;
  hasPersistedFirebaseAuthHint: boolean;
  hasActiveFirebaseSession: boolean;
}): PreMountLoadingScreenDecision => {
  if (!shouldRenderInitialLoadingScreen(pathname) || hasRecentAuthenticatedSessionHint) {
    return {
      shouldRender: false,
      preferLoginShell: false,
    };
  }

  return {
    shouldRender: true,
    preferLoginShell: !hasPersistedFirebaseAuthHint && !hasActiveFirebaseSession,
  };
};

export const resolveRuntimeLoadingScreenMode = ({
  pathname,
  bootstrapState,
  hasRecentAuthenticatedSessionHint,
}: {
  pathname: string | undefined;
  bootstrapState: Extract<AppBootstrapState, { status: 'loading' }>;
  hasRecentAuthenticatedSessionHint: boolean;
}): AppShellLoadingScreenMode => {
  if (!shouldRenderInitialLoadingScreen(pathname)) {
    return 'silent';
  }

  if (
    bootstrapState.phase === 'bootstrapping' &&
    bootstrapState.auth.sessionState.status === 'unauthenticated' &&
    !hasRecentAuthenticatedSessionHint
  ) {
    return 'login-shell';
  }

  return 'default';
};

export const shouldSuppressUnauthenticatedAppRoute = ({
  pathname,
  hasRecentAuthenticatedSessionHint,
}: {
  pathname: string | undefined;
  hasRecentAuthenticatedSessionHint: boolean;
}): boolean => hasRecentAuthenticatedSessionHint && !shouldRenderInitialLoadingScreen(pathname);
