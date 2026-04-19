import { describe, expect, it } from 'vitest';
import {
  resolvePreMountLoadingScreenDecision,
  resolveRuntimeLoadingScreenMode,
} from '@/app-shell/bootstrap/appShellLoadingPolicy';
import type { AppBootstrapState } from '@/app-shell/bootstrap/useAppBootstrapState';

const createLoadingBootstrapState = (phase: 'bootstrapping' | 'rehydrating') =>
  ({
    status: 'loading',
    phase,
    auth: {
      sessionState: {
        status: 'unauthenticated',
        user: null,
      },
    },
  }) as unknown as Extract<AppBootstrapState, { status: 'loading' }>;

describe('appShellLoadingPolicy', () => {
  it('skips the pre-mount loading screen on the census route', () => {
    expect(
      resolvePreMountLoadingScreenDecision({
        pathname: '/census',
        hasRecentAuthenticatedSessionHint: false,
        hasPersistedFirebaseAuthHint: false,
        hasActiveFirebaseSession: false,
      })
    ).toEqual({
      shouldRender: false,
      preferLoginShell: false,
    });
  });

  it('prefers the login shell on pre-mount when no auth hints exist', () => {
    expect(
      resolvePreMountLoadingScreenDecision({
        pathname: '/',
        hasRecentAuthenticatedSessionHint: false,
        hasPersistedFirebaseAuthHint: false,
        hasActiveFirebaseSession: false,
      })
    ).toEqual({
      shouldRender: true,
      preferLoginShell: true,
    });
  });

  it('keeps runtime loading silent on census even while auth is still loading', () => {
    expect(
      resolveRuntimeLoadingScreenMode({
        pathname: '/census',
        bootstrapState: createLoadingBootstrapState('rehydrating'),
      })
    ).toBe('silent');
  });

  it('uses the login shell only during root-route bootstrapping', () => {
    expect(
      resolveRuntimeLoadingScreenMode({
        pathname: '/',
        bootstrapState: createLoadingBootstrapState('bootstrapping'),
      })
    ).toBe('login-shell');

    expect(
      resolveRuntimeLoadingScreenMode({
        pathname: '/',
        bootstrapState: createLoadingBootstrapState('rehydrating'),
      })
    ).toBe('default');
  });
});
