import type { AppBootstrapState } from '@/app-shell/bootstrap/useAppBootstrapState';
import { shouldRenderInitialLoadingScreen } from '@/components/ui/InitialLoadingScreen';

export type AppShellLoadingScreenMode = 'silent' | 'default' | 'login-shell';

export interface PreMountLoadingScreenDecision {
  shouldRender: boolean;
  preferLoginShell: boolean;
}

export const resolvePreMountLoadingScreenDecision = ({
  pathname: _pathname,
  hasRecentAuthenticatedSessionHint: _providedRecentAuthenticatedSessionHint,
  hasPersistedFirebaseAuthHint: _providedPersistedFirebaseAuthHint,
  hasActiveFirebaseSession: _providedActiveFirebaseSession,
}: {
  pathname: string | undefined;
  hasRecentAuthenticatedSessionHint?: boolean;
  hasPersistedFirebaseAuthHint?: boolean;
  hasActiveFirebaseSession?: boolean;
}): PreMountLoadingScreenDecision => {
  return {
    shouldRender: false,
    preferLoginShell: false,
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

  if (bootstrapState.phase === 'rehydrating') {
    return 'silent';
  }

  return 'silent';
};
