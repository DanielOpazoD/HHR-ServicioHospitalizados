import {
  defaultBrowserWindowRuntime,
  type BrowserWindowRuntime,
} from '@/shared/runtime/browserWindowRuntime';

export interface SharedCensusBrowserRuntime {
  alert: (message: string) => void;
  open: (url: string, target?: string) => void;
}

export const createSharedCensusBrowserRuntime = (
  runtime: BrowserWindowRuntime = defaultBrowserWindowRuntime
): SharedCensusBrowserRuntime => ({
  alert: message => runtime.alert(message),
  open: (url, target = '_blank') => runtime.open(url, target),
});

export const defaultSharedCensusBrowserRuntime = createSharedCensusBrowserRuntime();
