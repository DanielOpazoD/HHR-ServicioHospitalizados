import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockPrepareClientBootstrap,
  mockGetFirebaseReady,
  mockGetStartupFailureMessage,
  mockPerformClientHardReset,
} = vi.hoisted(() => ({
  mockPrepareClientBootstrap: vi.fn(),
  mockGetFirebaseReady: vi.fn(),
  mockGetStartupFailureMessage: vi.fn(),
  mockPerformClientHardReset: vi.fn(),
}));

vi.mock('@/services/config/clientBootstrapRecovery', () => ({
  prepareClientBootstrap: (...args: unknown[]) => mockPrepareClientBootstrap(...args),
}));

vi.mock('@/services/firebase-runtime/firebaseConfigRuntimeAdapter', () => ({
  defaultFirebaseConfigRuntimeAdapter: {
    get ready() {
      return mockGetFirebaseReady();
    },
    getApp: () => ({ name: 'app' }),
    getAuth: () => ({ name: 'auth' }),
    getOptionalDb: () => ({ name: 'db' }),
  },
}));

vi.mock('@/services/auth/firebaseStartupUiPolicy', () => ({
  getFirebaseStartupFailureMessage: (...args: unknown[]) => mockGetStartupFailureMessage(...args),
}));

vi.mock('@/services/storage/indexeddb/indexedDbMaintenanceService', () => ({
  performClientHardReset: (...args: unknown[]) => mockPerformClientHardReset(...args),
}));

import {
  bootstrapAppRuntime,
  reconcileBootstrapRuntime,
  resolveBootstrapFailureResolution,
} from '@/app-shell/bootstrap/bootstrapAppRuntime';

describe('bootstrapAppRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    mockGetStartupFailureMessage.mockReturnValue('Firebase startup failed');
    mockPerformClientHardReset.mockResolvedValue(undefined);
  });

  it('returns reload when client recovery requires a reload', async () => {
    mockPrepareClientBootstrap.mockResolvedValue({
      status: 'reload',
      reason: 'legacy-sw',
    });

    const result = await bootstrapAppRuntime();

    expect(result).toEqual({
      status: 'reload',
      stage: 'client_recovery',
      clientRecovery: {
        status: 'reload',
        reason: 'legacy-sw',
      },
    });
    expect(mockGetFirebaseReady).not.toHaveBeenCalled();
  });

  it('returns continue when recovery passes and firebase is ready', async () => {
    mockPrepareClientBootstrap.mockResolvedValue({
      status: 'continue',
      reason: null,
    });
    mockGetFirebaseReady.mockReturnValue(
      Promise.resolve({ app: { name: 'app' }, auth: { name: 'auth' } })
    );

    const result = await bootstrapAppRuntime();

    expect(result).toEqual({
      status: 'continue',
      stage: 'firebase_ready',
      clientRecovery: {
        status: 'continue',
        reason: null,
      },
      services: {
        app: { name: 'app' },
        auth: { name: 'auth' },
        db: { name: 'db' },
      },
    });
  });

  it('returns blocked when firebase bootstrap fails', async () => {
    const failure = new Error('boom');
    mockPrepareClientBootstrap.mockResolvedValue({
      status: 'continue',
      reason: 'local-dev',
    });
    mockGetFirebaseReady.mockReturnValue(Promise.reject(failure));

    const result = await bootstrapAppRuntime();

    expect(result).toEqual({
      status: 'blocked',
      stage: 'firebase_ready',
      clientRecovery: {
        status: 'continue',
        reason: 'local-dev',
      },
      error: failure,
      message: 'Firebase startup failed',
    });
    expect(mockGetStartupFailureMessage).toHaveBeenCalledTimes(1);
  });

  it('triggers a hard reset instead of a Firebase warning for IndexedDB backing-store failures', async () => {
    const failure = {
      name: 'UnknownError',
      message: 'Internal error opening backing store for indexedDB.open.',
    };
    mockPrepareClientBootstrap.mockResolvedValue({
      status: 'continue',
      reason: null,
    });
    mockGetFirebaseReady.mockReturnValue(Promise.reject(failure));

    const result = await bootstrapAppRuntime();

    expect(mockPerformClientHardReset).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: 'reload',
      stage: 'firebase_ready',
      clientRecovery: {
        status: 'continue',
        reason: null,
      },
    });
  });

  it('also attempts hard reset once when bootstrap times out in a broken browser session', async () => {
    const failure = new Error('Firebase initialization timed out');
    mockPrepareClientBootstrap.mockResolvedValue({
      status: 'continue',
      reason: null,
    });
    mockGetFirebaseReady.mockReturnValue(Promise.reject(failure));

    const result = await bootstrapAppRuntime();

    expect(mockPerformClientHardReset).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: 'reload',
      stage: 'firebase_ready',
      clientRecovery: {
        status: 'continue',
        reason: null,
      },
    });
  });

  it('shows a local-browser warning after a repair attempt already happened', async () => {
    sessionStorage.setItem('hhr_bootstrap_storage_repair_v1', '1');
    const failure = new Error('Firebase initialization timed out');
    mockPrepareClientBootstrap.mockResolvedValue({
      status: 'continue',
      reason: null,
    });
    mockGetFirebaseReady.mockReturnValue(Promise.reject(failure));

    const result = await bootstrapAppRuntime();

    expect(mockPerformClientHardReset).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      status: 'blocked',
      stage: 'firebase_ready',
      message: 'No se pudo iniciar correctamente por un problema local del navegador.',
      warningCopy: expect.objectContaining({
        title: 'Problema local del navegador',
      }),
    });
  });

  it('reuses the same client reconciliation entrypoint for background checks', async () => {
    mockPrepareClientBootstrap.mockResolvedValue({
      status: 'continue',
      reason: null,
    });

    const result = await reconcileBootstrapRuntime();

    expect(result).toEqual({
      status: 'continue',
      reason: null,
    });
    expect(mockPrepareClientBootstrap).toHaveBeenCalledTimes(1);
  });

  it('plans a hard reset on the first local-storage bootstrap failure', () => {
    expect(
      resolveBootstrapFailureResolution(new Error('Firebase initialization timed out'), false)
    ).toEqual({
      action: 'hard_reset_reload',
    });
  });

  it('returns a blocked local-browser warning after a repair attempt already happened', () => {
    expect(
      resolveBootstrapFailureResolution(
        new Error('Internal error opening backing store for indexedDB.open.'),
        true
      )
    ).toMatchObject({
      action: 'blocked',
      messageOverride: 'No se pudo iniciar correctamente por un problema local del navegador.',
      warningCopy: expect.objectContaining({
        title: 'Problema local del navegador',
      }),
    });
  });

  it('keeps non-storage bootstrap failures as generic blocked errors', () => {
    expect(
      resolveBootstrapFailureResolution(new Error('unexpected runtime failure'), false)
    ).toEqual({
      action: 'blocked',
    });
  });
});
