import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetLocalStorageItem = vi.fn();
const mockSetLocalStorageItem = vi.fn();
const mockReload = vi.fn();

vi.mock('@/shared/runtime/browserWindowRuntimeCore', () => ({
  defaultBrowserWindowRuntime: {
    getLocalStorageItem: (...args: unknown[]) => mockGetLocalStorageItem(...args),
    setLocalStorageItem: (...args: unknown[]) => mockSetLocalStorageItem(...args),
    reload: (...args: unknown[]) => mockReload(...args),
  },
}));

import {
  getClientBootstrapRecoveryConstants,
  prepareClientBootstrap,
} from '@/services/config/clientBootstrapRecovery';

type ServiceWorkerRegistrationStub = {
  unregister: ReturnType<typeof vi.fn>;
  active?: { scriptURL?: string } | null;
  waiting?: { scriptURL?: string } | null;
  installing?: { scriptURL?: string } | null;
};

const createRegistration = (scriptURL: string): ServiceWorkerRegistrationStub => ({
  unregister: vi.fn().mockResolvedValue(true),
  active: { scriptURL },
  waiting: null,
  installing: null,
});

describe('prepareClientBootstrap', () => {
  let mockCachesDelete: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
    mockGetLocalStorageItem.mockReset();
    mockSetLocalStorageItem.mockReset();
    mockReload.mockReset();

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        hostname: 'app.example.com',
      },
    });

    mockCachesDelete = vi.fn().mockResolvedValue(true);

    Object.defineProperty(globalThis, 'caches', {
      configurable: true,
      value: {
        keys: vi.fn().mockResolvedValue(['static-v1']),
        delete: mockCachesDelete,
      },
    });

    Object.defineProperty(globalThis.navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistrations: vi.fn().mockResolvedValue([]),
      },
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: () => 'application/json; charset=utf-8',
        },
        json: vi.fn().mockResolvedValue({
          version: 'deploy-002',
          buildDate: '2026-04-03T00:00:00.000Z',
        }),
      })
    );
  });

  it('stores the current version on first bootstrap visit', async () => {
    mockGetLocalStorageItem.mockReturnValue(null);

    const result = await prepareClientBootstrap();

    expect(result).toEqual({ status: 'continue', reason: null });
    expect(mockSetLocalStorageItem).toHaveBeenCalledWith('hhr_app_version', 'deploy-002');
    expect(mockReload).not.toHaveBeenCalled();
  });

  it('reloads once when a legacy /sw.js registration is detected', async () => {
    const legacyRegistration = createRegistration('https://app.example.com/sw.js');
    (navigator.serviceWorker.getRegistrations as ReturnType<typeof vi.fn>).mockResolvedValue([
      legacyRegistration,
    ]);
    mockGetLocalStorageItem.mockReturnValue('deploy-002');

    const { firebaseConfigCacheKey, bootstrapRecoveryKey } = getClientBootstrapRecoveryConstants();
    localStorage.setItem(firebaseConfigCacheKey, JSON.stringify({ apiKey: 'stale' }));

    const result = await prepareClientBootstrap();

    expect(result).toEqual({ status: 'reload', reason: 'legacy-sw' });
    expect(legacyRegistration.unregister).toHaveBeenCalledTimes(2);
    expect(mockCachesDelete).toHaveBeenCalledWith('static-v1');
    expect(localStorage.getItem(firebaseConfigCacheKey)).toBeNull();
    expect(sessionStorage.getItem(bootstrapRecoveryKey)).toBe('legacy-sw');
    expect(mockReload).toHaveBeenCalledTimes(1);
  });

  it('reloads once when the deployed version changes', async () => {
    mockGetLocalStorageItem.mockReturnValue('deploy-001');

    const { firebaseConfigCacheKey, bootstrapRecoveryKey } = getClientBootstrapRecoveryConstants();
    localStorage.setItem(firebaseConfigCacheKey, JSON.stringify({ apiKey: 'stale' }));

    const result = await prepareClientBootstrap();

    expect(result).toEqual({ status: 'reload', reason: 'version-change' });
    expect(mockSetLocalStorageItem).toHaveBeenCalledWith('hhr_app_version', 'deploy-002');
    expect(mockCachesDelete).toHaveBeenCalledWith('static-v1');
    expect(localStorage.getItem(firebaseConfigCacheKey)).toBeNull();
    expect(sessionStorage.getItem(bootstrapRecoveryKey)).toBe('version-change');
    expect(mockReload).toHaveBeenCalledTimes(1);
  });
});
