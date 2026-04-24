import { resolveModuleFromPathname } from '@/hooks/controllers/appStateNavigationController';
import type { ModuleType } from '@/constants/navigationConfig';

type LoadRouteComponents = () => Promise<unknown>;

export interface AuthenticatedRoutePreloadOptions {
  pathname: string | undefined;
  loadCensusComponents?: LoadRouteComponents;
  loadCensusRegisterContent?: LoadRouteComponents;
}

export interface AuthenticatedShellPreloadOptions {
  loadAuthenticatedShell?: LoadRouteComponents;
}

const defaultLoadAuthenticatedShell: LoadRouteComponents = () =>
  import('@/app-shell/runtime/AuthenticatedAppShell');

const defaultLoadCensusComponents: LoadRouteComponents = () =>
  import('@/features/census/public-components');

const defaultLoadCensusRegisterContent: LoadRouteComponents = () =>
  import('@/features/census/components/CensusRegisterContent');

const normalizePathname = (pathname: string | undefined): string =>
  (pathname ?? '/').replace(/^\/+|\/+$/g, '');

const resolvePreloadModuleFromPathname = (pathname: string | undefined): ModuleType | null => {
  const normalizedPath = normalizePathname(pathname);
  if (normalizedPath === 'censo') {
    return 'CENSUS';
  }
  return resolveModuleFromPathname(pathname);
};

export const shouldPreloadAuthenticatedShellForPathname = (
  pathname: string | undefined
): boolean => {
  const normalizedPath = normalizePathname(pathname);
  if (!normalizedPath || normalizedPath === 'login') {
    return false;
  }
  return resolvePreloadModuleFromPathname(pathname) !== null;
};

export const preloadAuthenticatedShellChunk = async ({
  loadAuthenticatedShell = defaultLoadAuthenticatedShell,
}: AuthenticatedShellPreloadOptions = {}): Promise<void> => {
  await loadAuthenticatedShell();
};

export const preloadAuthenticatedRouteChunk = async ({
  pathname,
  loadCensusComponents = defaultLoadCensusComponents,
  loadCensusRegisterContent = defaultLoadCensusRegisterContent,
}: AuthenticatedRoutePreloadOptions): Promise<void> => {
  if (resolvePreloadModuleFromPathname(pathname) !== 'CENSUS') {
    return;
  }

  await Promise.all([loadCensusComponents(), loadCensusRegisterContent()]);
};

export const preloadDefaultPostLoginRoute = async ({
  loadCensusComponents = defaultLoadCensusComponents,
  loadCensusRegisterContent = defaultLoadCensusRegisterContent,
}: {
  loadCensusComponents?: LoadRouteComponents;
  loadCensusRegisterContent?: LoadRouteComponents;
} = {}): Promise<void> => {
  await Promise.all([loadCensusComponents(), loadCensusRegisterContent()]);
};
