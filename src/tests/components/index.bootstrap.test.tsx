import React from 'react';
import { waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockBootstrapAppRuntime,
  mockInstallBootstrapRuntimeErrorListeners,
  mockRecordBootstrapRuntimeError,
  mockRecordBootstrapRuntimeResult,
  mockGetFirebaseStartupFailureMessage,
  mockResolvePreMountLoadingScreenDecision,
  mockMountFirebaseConfigWarning,
  mockHasActiveFirebaseSession,
  mockHasPersistedFirebaseAuthHint,
  mockHasRecentAuthenticatedSessionHint,
  mockCreateRoot,
  mockRootRender,
  mockDetachBootstrapRuntimeErrorListeners,
  mockBootLoggerInfo,
  mockBootLoggerError,
} = vi.hoisted(() => ({
  mockBootstrapAppRuntime: vi.fn(),
  mockInstallBootstrapRuntimeErrorListeners: vi.fn(),
  mockRecordBootstrapRuntimeError: vi.fn(),
  mockRecordBootstrapRuntimeResult: vi.fn(),
  mockGetFirebaseStartupFailureMessage: vi.fn(),
  mockResolvePreMountLoadingScreenDecision: vi.fn(),
  mockMountFirebaseConfigWarning: vi.fn(),
  mockHasActiveFirebaseSession: vi.fn(),
  mockHasPersistedFirebaseAuthHint: vi.fn(),
  mockHasRecentAuthenticatedSessionHint: vi.fn(),
  mockCreateRoot: vi.fn(),
  mockRootRender: vi.fn(),
  mockDetachBootstrapRuntimeErrorListeners: vi.fn(),
  mockBootLoggerInfo: vi.fn(),
  mockBootLoggerError: vi.fn(),
}));

vi.mock('react-dom/client', () => ({
  default: {
    createRoot: (...args: unknown[]) => mockCreateRoot(...args),
  },
  createRoot: (...args: unknown[]) => mockCreateRoot(...args),
}));

vi.mock('@/app-shell/bootstrap/bootstrapAppRuntime', () => ({
  bootstrapAppRuntime: (...args: unknown[]) => mockBootstrapAppRuntime(...args),
}));

vi.mock('@/app-shell/bootstrap/bootstrapRuntimeTelemetry', () => ({
  installBootstrapRuntimeErrorListeners: (...args: unknown[]) =>
    mockInstallBootstrapRuntimeErrorListeners(...args),
  recordBootstrapRuntimeError: (...args: unknown[]) => mockRecordBootstrapRuntimeError(...args),
  recordBootstrapRuntimeResult: (...args: unknown[]) => mockRecordBootstrapRuntimeResult(...args),
}));

vi.mock('@/services/auth/firebaseStartupUiPolicy', () => ({
  getFirebaseStartupFailureMessage: (...args: unknown[]) =>
    mockGetFirebaseStartupFailureMessage(...args),
}));

vi.mock('@/components/ui/InitialLoadingScreen', () => ({
  InitialLoadingScreen: ({ preferLoginShell }: { preferLoginShell?: boolean }) => (
    <div data-testid="pre-mount-loading-screen" data-prefer-login-shell={preferLoginShell} />
  ),
}));

vi.mock('@/app-shell/bootstrap/BootstrapCensusChrome', () => {
  const MockBootstrapRouteChrome = () => <div data-testid="bootstrap-route-chrome" />;
  return {
    BootstrapRouteChrome: MockBootstrapRouteChrome,
  };
});

vi.mock('@/services/auth/authFallback', () => ({
  hasActiveFirebaseSession: (...args: unknown[]) => mockHasActiveFirebaseSession(...args),
}));

vi.mock('@/services/auth/authStorageHints', () => ({
  hasPersistedFirebaseAuthHint: (...args: unknown[]) => mockHasPersistedFirebaseAuthHint(...args),
  hasRecentAuthenticatedSessionHint: (...args: unknown[]) =>
    mockHasRecentAuthenticatedSessionHint(...args),
}));

vi.mock('@/app-shell/bootstrap/appShellLoadingPolicy', () => ({
  resolvePreMountLoadingScreenDecision: (...args: unknown[]) =>
    mockResolvePreMountLoadingScreenDecision(...args),
}));

vi.mock('@/services/firebase-runtime/firebaseStartupDiagnostics', () => ({
  mountFirebaseConfigWarning: (...args: unknown[]) => mockMountFirebaseConfigWarning(...args),
}));

vi.mock('@/services/utils/loggerScope', async () => {
  const { createLoggerScopeMock } = await import('@/tests/utils/loggerScopeMock');
  return createLoggerScopeMock({
    error: mockBootLoggerError,
    info: mockBootLoggerInfo,
  });
});

vi.mock('@/App', () => ({
  default: () => <div data-testid="mock-app">Mock App</div>,
}));

const flushBootstrapWork = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('index bootstrap entrypoint', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    document.body.innerHTML = '<div id="root"></div>';

    mockRootRender.mockReset();
    mockDetachBootstrapRuntimeErrorListeners.mockReset();
    mockCreateRoot.mockReturnValue({
      render: mockRootRender,
    });
    mockInstallBootstrapRuntimeErrorListeners.mockReturnValue(
      mockDetachBootstrapRuntimeErrorListeners
    );
    mockResolvePreMountLoadingScreenDecision.mockReturnValue({
      shouldRender: false,
      preferLoginShell: false,
      renderBootstrapRouteChrome: false,
    });
    mockHasActiveFirebaseSession.mockReturnValue(false);
    mockHasPersistedFirebaseAuthHint.mockReturnValue(false);
    mockHasRecentAuthenticatedSessionHint.mockReturnValue(false);
    mockGetFirebaseStartupFailureMessage.mockReturnValue('Firebase startup failed');

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        pathname: '/',
        search: '',
      },
      writable: true,
    });
  });

  it('throws immediately when the root mount point is missing', async () => {
    document.body.innerHTML = '';

    await expect(import('@/index')).rejects.toThrow('Could not find root element to mount to');
    expect(mockCreateRoot).not.toHaveBeenCalled();
  });

  it('renders the pre-mount loading screen and stops on reload outcomes', async () => {
    mockResolvePreMountLoadingScreenDecision.mockReturnValue({
      shouldRender: true,
      preferLoginShell: false,
      renderBootstrapRouteChrome: false,
    });
    mockBootstrapAppRuntime.mockResolvedValue({
      status: 'reload',
      stage: 'client_recovery',
      clientRecovery: {
        status: 'reload',
        reason: 'legacy-sw',
      },
    });

    await import('@/index');
    await flushBootstrapWork();

    expect(mockCreateRoot).toHaveBeenCalledTimes(1);
    expect(mockRootRender).toHaveBeenCalledTimes(1);
    const renderElement = mockRootRender.mock.calls[0][0];
    expect(renderElement.props.children.props.pathname).toBe('/');
    expect(mockRecordBootstrapRuntimeResult).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'reload' })
    );
    expect(mockDetachBootstrapRuntimeErrorListeners).toHaveBeenCalledTimes(1);
  });

  it('renders the bootstrap route chrome before React app mount when requested', async () => {
    mockResolvePreMountLoadingScreenDecision.mockReturnValue({
      shouldRender: false,
      preferLoginShell: false,
      renderBootstrapRouteChrome: true,
    });
    mockBootstrapAppRuntime.mockResolvedValue({
      status: 'reload',
      stage: 'client_recovery',
      clientRecovery: {
        status: 'reload',
        reason: 'legacy-sw',
      },
    });

    await import('@/index');
    await flushBootstrapWork();

    expect(mockRootRender).toHaveBeenCalledTimes(1);
    const renderElement = mockRootRender.mock.calls[0][0];
    expect(renderElement.props.children.type.name).toBe('MockBootstrapRouteChrome');
    expect(mockDetachBootstrapRuntimeErrorListeners).toHaveBeenCalledTimes(1);
  });

  it('mounts the firebase startup warning when bootstrap is blocked', async () => {
    mockBootstrapAppRuntime.mockResolvedValue({
      status: 'blocked',
      stage: 'firebase_ready',
      message: 'No se pudo iniciar la app',
      warningCopy: {
        title: 'Configuracion faltante',
        summary: 'Falta algo',
        steps: ['Paso 1'],
      },
      clientRecovery: {
        status: 'continue',
        reason: null,
      },
    });

    await import('@/index');
    await flushBootstrapWork();

    expect(mockMountFirebaseConfigWarning).toHaveBeenCalledWith('No se pudo iniciar la app', {
      title: 'Configuracion faltante',
      summary: 'Falta algo',
      steps: ['Paso 1'],
    });
    expect(mockRootRender).not.toHaveBeenCalled();
    expect(mockDetachBootstrapRuntimeErrorListeners).toHaveBeenCalledTimes(1);
  });

  it('renders the application when bootstrap continues', async () => {
    mockBootstrapAppRuntime.mockResolvedValue({
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

    await import('@/index');
    await flushBootstrapWork();

    expect(mockBootLoggerInfo).toHaveBeenCalledWith('Rendering application');
    await waitFor(() => {
      expect(mockRootRender).toHaveBeenCalledTimes(1);
    });
    const renderElement = mockRootRender.mock.calls[0][0];
    expect(renderElement.props.children.type).toBeTypeOf('function');
    expect(mockMountFirebaseConfigWarning).not.toHaveBeenCalled();
    expect(mockDetachBootstrapRuntimeErrorListeners).toHaveBeenCalledTimes(1);
  });

  it('mounts the app-shell load warning for chunk-load bootstrap failures', async () => {
    const failure = new Error('Failed to fetch dynamically imported module: /assets/app.js');
    mockBootstrapAppRuntime.mockRejectedValue(failure);

    await import('@/index');
    await flushBootstrapWork();

    expect(mockRecordBootstrapRuntimeError).toHaveBeenCalledWith(failure);
    expect(mockMountFirebaseConfigWarning).toHaveBeenCalledWith(
      'No se pudo cargar una parte crítica de la interfaz.',
      expect.objectContaining({
        title: 'No se pudo completar el arranque',
      })
    );
    expect(mockDetachBootstrapRuntimeErrorListeners).toHaveBeenCalledTimes(1);
  });

  it('mounts the generic firebase startup warning for non-chunk bootstrap failures', async () => {
    const failure = new Error('firebase runtime exploded');
    mockBootstrapAppRuntime.mockRejectedValue(failure);

    await import('@/index');
    await flushBootstrapWork();

    expect(mockBootLoggerError).toHaveBeenCalledWith('Firebase initialization failed', failure);
    expect(mockMountFirebaseConfigWarning).toHaveBeenCalledWith('Firebase startup failed');
    expect(mockDetachBootstrapRuntimeErrorListeners).toHaveBeenCalledTimes(1);
  });
});
