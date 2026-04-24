import { resolveModuleFromPathname } from '@/hooks/controllers/appStateNavigationController';

type LoadRouteComponents = () => Promise<unknown>;

export interface AuthenticatedRoutePreloadOptions {
  pathname: string | undefined;
  loadCensusComponents?: LoadRouteComponents;
}

const defaultLoadCensusComponents: LoadRouteComponents = () =>
  import('@/features/census/public-components');

export const preloadAuthenticatedRouteChunk = async ({
  pathname,
  loadCensusComponents = defaultLoadCensusComponents,
}: AuthenticatedRoutePreloadOptions): Promise<void> => {
  if (resolveModuleFromPathname(pathname) !== 'CENSUS') {
    return;
  }

  await loadCensusComponents();
};

export const preloadDefaultPostLoginRoute = async ({
  loadCensusComponents = defaultLoadCensusComponents,
}: {
  loadCensusComponents?: LoadRouteComponents;
} = {}): Promise<void> => {
  await loadCensusComponents();
};
