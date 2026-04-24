import { describe, expect, it, vi } from 'vitest';
import {
  preloadDefaultPostLoginRoute,
  preloadAuthenticatedRouteChunk,
} from '@/app-shell/bootstrap/authenticatedRoutePreloadController';

describe('authenticatedRoutePreloadController', () => {
  it('preloads the census chunk for root and census refreshes', async () => {
    const loadCensusComponents = vi.fn().mockResolvedValue({});

    await preloadAuthenticatedRouteChunk({
      pathname: '/',
      loadCensusComponents,
    });
    await preloadAuthenticatedRouteChunk({
      pathname: '/census',
      loadCensusComponents,
    });

    expect(loadCensusComponents).toHaveBeenCalledTimes(2);
  });

  it('does not preload census for non-census module refreshes', async () => {
    const loadCensusComponents = vi.fn().mockResolvedValue({});

    await preloadAuthenticatedRouteChunk({
      pathname: '/nursing-handoff',
      loadCensusComponents,
    });

    expect(loadCensusComponents).not.toHaveBeenCalled();
  });

  it('preloads the default post-login route from the login screen', async () => {
    const loadCensusComponents = vi.fn().mockResolvedValue({});

    await preloadDefaultPostLoginRoute({ loadCensusComponents });

    expect(loadCensusComponents).toHaveBeenCalledTimes(1);
  });
});
