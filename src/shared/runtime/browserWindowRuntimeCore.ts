export interface BrowserWindowRuntime {
  alert: (message: string) => void;
  confirm: (message: string) => boolean;
  open: (url: string, target?: string) => Window | null;
  reload: () => void;
  getLocationOrigin: () => string;
  getLocationPathname: () => string;
  getLocationHref: () => string;
  getViewportWidth: () => number;
  getLocalStorageItem: (key: string) => string | null;
  setLocalStorageItem: (key: string, value: string) => void;
  removeLocalStorageItem: (key: string) => void;
}

const hasWindow = (): boolean => typeof window !== 'undefined';

const readWindowValue = <T>(fallback: T, resolver: (runtimeWindow: Window) => T): T => {
  if (!hasWindow()) {
    return fallback;
  }

  return resolver(window);
};

const runWithWindow = (effect: (runtimeWindow: Window) => void): void => {
  if (!hasWindow()) {
    return;
  }

  effect(window);
};

export const createBrowserWindowRuntime = (): BrowserWindowRuntime => ({
  alert: message => {
    runWithWindow(runtimeWindow => {
      runtimeWindow.alert(message);
    });
  },
  confirm: message => readWindowValue(false, runtimeWindow => runtimeWindow.confirm(message)),
  open: (url, target = '_blank') =>
    readWindowValue(null, runtimeWindow => runtimeWindow.open(url, target)),
  reload: () => {
    runWithWindow(runtimeWindow => {
      runtimeWindow.location.reload();
    });
  },
  getLocationOrigin: () => readWindowValue('', runtimeWindow => runtimeWindow.location.origin),
  getLocationPathname: () => readWindowValue('', runtimeWindow => runtimeWindow.location.pathname),
  getLocationHref: () => readWindowValue('', runtimeWindow => runtimeWindow.location.href),
  getViewportWidth: () => readWindowValue(0, runtimeWindow => runtimeWindow.innerWidth),
  getLocalStorageItem: key =>
    readWindowValue(null, runtimeWindow => runtimeWindow.localStorage.getItem(key)),
  setLocalStorageItem: (key, value) => {
    runWithWindow(runtimeWindow => {
      runtimeWindow.localStorage.setItem(key, value);
    });
  },
  removeLocalStorageItem: key => {
    runWithWindow(runtimeWindow => {
      runtimeWindow.localStorage.removeItem(key);
    });
  },
});

export const defaultBrowserWindowRuntime = createBrowserWindowRuntime();
