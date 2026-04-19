import type { AppBootstrapState } from '@/app-shell/bootstrap/useAppBootstrapState';
import { shouldRenderInitialLoadingScreen } from '@/components/ui/InitialLoadingScreen';
import { hasActiveFirebaseSession } from '@/services/auth/authFallback';
import {
  hasPersistedFirebaseAuthHint,
  hasRecentAuthenticatedSessionHint,
} from '@/services/auth/authStorageHints';

export type AppShellLoadingScreenMode = 'silent' | 'default' | 'login-shell';

export interface PreMountLoadingScreenDecision {
  shouldRender: boolean;
  preferLoginShell: boolean;
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

  if (!shouldRenderInitialLoadingScreen(pathname) || recentAuthenticatedSessionHint) {
    return {
      shouldRender: false,
      preferLoginShell: false,
    };
  }

  return {
    shouldRender: true,
    preferLoginShell: !persistedFirebaseAuthHint && !activeFirebaseSession,
  };
};

export const resolveRuntimeLoadingScreenMode = ({
  pathname,
  bootstrapState,
}: {
  pathname: string | undefined;
  bootstrapState: Extract<AppBootstrapState, { status: 'loading' }>;
}): AppShellLoadingScreenMode => {
  if (!shouldRenderInitialLoadingScreen(pathname)) {
    return 'silent';
  }

  if (
    bootstrapState.phase === 'bootstrapping' &&
    bootstrapState.auth.sessionState.status === 'unauthenticated'
  ) {
    return 'login-shell';
  }

  return 'default';
};
