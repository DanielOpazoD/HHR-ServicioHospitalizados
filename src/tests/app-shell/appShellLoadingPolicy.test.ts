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

const createAuthorizedLoadingBootstrapState = (phase: 'bootstrapping' | 'rehydrating') =>
  ({
    status: 'loading',
    phase,
    auth: {
      sessionState: {
        status: 'authorized',
        user: { uid: 'user-1' },
      },
    },
  }) as unknown as Extract<AppBootstrapState, { status: 'loading' }>;

describe('appShellLoadingPolicy', () => {
  it('keeps the login shell on the census route when only a soft same-tab auth hint exists', () => {
    expect(
      resolvePreMountLoadingScreenDecision({
        pathname: '/census',
        hasRecentAuthenticatedSessionHint: true,
        hasPersistedFirebaseAuthHint: false,
        hasActiveFirebaseSession: false,
      })
    ).toEqual({
      shouldRender: true,
      preferLoginShell: true,
      renderBootstrapRouteChrome: false,
    });
  });

  it('renders the bootstrap route chrome on the census route when strong Firebase auth evidence exists', () => {
    expect(
      resolvePreMountLoadingScreenDecision({
        pathname: '/census',
        hasRecentAuthenticatedSessionHint: false,
        hasPersistedFirebaseAuthHint: true,
        hasActiveFirebaseSession: false,
      })
    ).toEqual({
      shouldRender: false,
      preferLoginShell: false,
      renderBootstrapRouteChrome: true,
    });
  });

  it('keeps the login shell on the root route even when auth hints exist', () => {
    expect(
      resolvePreMountLoadingScreenDecision({
        pathname: '/',
        hasRecentAuthenticatedSessionHint: false,
        hasPersistedFirebaseAuthHint: true,
        hasActiveFirebaseSession: false,
      })
    ).toEqual({
      shouldRender: true,
      preferLoginShell: true,
      renderBootstrapRouteChrome: false,
    });
  });

  it('keeps the login shell on the explicit login route even when auth hints exist', () => {
    expect(
      resolvePreMountLoadingScreenDecision({
        pathname: '/login',
        hasRecentAuthenticatedSessionHint: true,
        hasPersistedFirebaseAuthHint: true,
        hasActiveFirebaseSession: true,
      })
    ).toEqual({
      shouldRender: true,
      preferLoginShell: true,
      renderBootstrapRouteChrome: false,
    });
  });

  it('renders the bootstrap route chrome on other authenticated module routes too', () => {
    expect(
      resolvePreMountLoadingScreenDecision({
        pathname: '/nursing-handoff',
        hasRecentAuthenticatedSessionHint: false,
        hasPersistedFirebaseAuthHint: true,
        hasActiveFirebaseSession: false,
      })
    ).toEqual({
      shouldRender: false,
      preferLoginShell: false,
      renderBootstrapRouteChrome: true,
    });
  });

  it('renders the login shell on pre-mount root even when no auth hints exist', () => {
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
      renderBootstrapRouteChrome: false,
    });
  });

  it('keeps census in the login shell while runtime has no authorized evidence', () => {
    expect(
      resolveRuntimeLoadingScreenMode({
        pathname: '/census',
        bootstrapState: createLoadingBootstrapState('rehydrating'),
      })
    ).toBe('login-shell');
  });

  it('keeps runtime loading on census route chrome once auth is authorized', () => {
    expect(
      resolveRuntimeLoadingScreenMode({
        pathname: '/census',
        bootstrapState: createAuthorizedLoadingBootstrapState('rehydrating'),
      })
    ).toBe('bootstrap-route-chrome');
  });

  it('keeps root-route bootstrapping in the login shell', () => {
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
    ).toBe('login-shell');
  });

  it('keeps other module routes in the login shell while rehydrating without authorized evidence', () => {
    expect(
      resolveRuntimeLoadingScreenMode({
        pathname: '/transfer-management',
        bootstrapState: createLoadingBootstrapState('rehydrating'),
      })
    ).toBe('login-shell');
  });

  it('keeps authorized module routes on the route chrome while bootstrapping too', () => {
    expect(
      resolveRuntimeLoadingScreenMode({
        pathname: '/nursing-handoff',
        bootstrapState: createAuthorizedLoadingBootstrapState('bootstrapping'),
      })
    ).toBe('bootstrap-route-chrome');

    expect(
      resolveRuntimeLoadingScreenMode({
        pathname: '/medical-handoff',
        bootstrapState: createAuthorizedLoadingBootstrapState('bootstrapping'),
      })
    ).toBe('bootstrap-route-chrome');
  });

  it('keeps authenticated root-route bootstrapping silent', () => {
    expect(
      resolveRuntimeLoadingScreenMode({
        pathname: '/',
        bootstrapState: createAuthorizedLoadingBootstrapState('bootstrapping'),
      })
    ).toBe('silent');
  });
});
