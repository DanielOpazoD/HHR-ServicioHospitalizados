import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserHealthStatus } from '@/services/admin/healthService';
import { SystemHealthDashboard } from '@/features/admin/components/SystemHealthDashboard';

const mocks = vi.hoisted(() => ({
  deleteUserHealthSnapshot: vi.fn(),
  reopenSystemHealthIncident: vi.fn(),
  resolveSystemHealthIncident: vi.fn(),
  confirm: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock('@/context/UIContext', () => ({
  useConfirmDialog: () => ({ confirm: mocks.confirm }),
  useNotification: () => ({ success: mocks.success, error: mocks.error }),
}));

vi.mock('@/features/admin/components/DailyOpsChecklistCard', () => ({
  DailyOpsChecklistCard: () => <div data-testid="daily-ops" />,
}));

vi.mock('@/features/admin/components/SystemHealthAlertsPanel', () => ({
  SystemHealthAlertsPanel: () => <div data-testid="alerts-panel" />,
}));

vi.mock('@/features/admin/components/SystemHealthSummaryGrid', () => ({
  SystemHealthSummaryGrid: () => <div data-testid="summary-grid" />,
}));

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    currentUser: {
      uid: 'admin-1',
      email: 'admin@example.com',
      displayName: 'Admin User',
    },
  }),
}));

const userStatus: UserHealthStatus = {
  uid: 'u1',
  email: 'user@example.com',
  displayName: 'User Example',
  lastSeen: '2026-05-22T14:10:00.000Z',
  isOnline: true,
  isOutdated: false,
  pendingMutations: 0,
  pendingSyncTasks: 0,
  failedSyncTasks: 1,
  conflictSyncTasks: 1,
  retryingSyncTasks: 0,
  syncOrphanedTasks: 0,
  oldestPendingAgeMs: 0,
  remoteSyncReason: 'ready',
  versionUpdateReason: 'current',
  localErrorCount: 1,
  degradedLocalPersistence: false,
  repositoryWarningCount: 0,
  slowestRepositoryOperationMs: 0,
  operationalObservedCount: 1,
  operationalFailureCount: 1,
  operationalRetryableCount: 0,
  operationalRecoverableCount: 0,
  operationalDegradedCount: 0,
  operationalBlockedCount: 1,
  operationalUnauthorizedCount: 0,
  operationalLastHourObservedCount: 1,
  operationalSyncObservedCount: 1,
  operationalIndexedDbObservedCount: 0,
  operationalClinicalDocumentObservedCount: 0,
  operationalCreateDayObservedCount: 0,
  operationalHandoffObservedCount: 0,
  operationalExportBackupObservedCount: 0,
  operationalDailyRecordRecoveredRealtimeNullCount: 0,
  operationalDailyRecordConfirmedRealtimeNullCount: 0,
  operationalSyncReadUnavailableCount: 0,
  operationalIndexedDbFallbackModeCount: 0,
  operationalAuthBootstrapTimeoutCount: 0,
  operationalTopObservedCategory: 'sync',
  operationalTopObservedOperation: 'daily_record_remote_write',
  latestOperationalOperation: 'daily_record_remote_write',
  latestOperationalRuntimeState: 'blocked',
  latestOperationalIssueAt: '2026-05-22T14:03:00.000Z',
  recentEvents: [
    {
      id: 'event-1',
      source: 'operational',
      category: 'sync',
      severity: 'critical',
      status: 'open',
      timestamp: '2026-05-22T14:03:00.000Z',
      message: 'Escritura remota bloqueada',
      operation: 'daily_record_remote_write',
      module: 'Censo diario',
      action: 'Guardar dia',
      route: '/censo',
      runtimeState: 'blocked',
      issues: ['permission-denied'],
    },
  ],
  appVersion: 'v1',
  platform: 'MacIntel',
  userAgent: 'Vitest',
};

vi.mock('@/services/admin/healthService', async () => {
  const actual = await vi.importActual<typeof import('@/services/admin/healthService')>(
    '@/services/admin/healthService'
  );
  return {
    ...actual,
    subscribeToSystemHealth: (onUpdate: (data: UserHealthStatus[]) => void) => {
      onUpdate([userStatus]);
      return vi.fn();
    },
    subscribeToSystemHealthIncidentResolutions: (
      onUpdate: (data: Record<string, unknown>) => void
    ) => {
      onUpdate({});
      return vi.fn();
    },
    deleteUserHealthSnapshot: mocks.deleteUserHealthSnapshot,
    reopenSystemHealthIncident: mocks.reopenSystemHealthIncident,
    resolveSystemHealthIncident: mocks.resolveSystemHealthIncident,
  };
});

describe('SystemHealthDashboard', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
    mocks.resolveSystemHealthIncident.mockResolvedValue(undefined);
    mocks.reopenSystemHealthIncident.mockResolvedValue(undefined);
  });

  it('shows filters, actionable incident detail and delete snapshot action', async () => {
    mocks.confirm.mockResolvedValue(true);
    mocks.deleteUserHealthSnapshot.mockResolvedValue(undefined);

    render(<SystemHealthDashboard />);

    expect(await screen.findByPlaceholderText('Buscar usuario...')).toBeInTheDocument();
    expect(screen.queryByText('Causas agrupadas')).not.toBeInTheDocument();
    expect(screen.queryByText('Linea temporal')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Exportar CSV/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Marcar visibles resueltos/i })).toBeInTheDocument();
    expect(screen.getByText('Incidencias activas')).toBeInTheDocument();
    expect(screen.getByText('Origen / donde ocurrio')).toBeInTheDocument();
    expect(screen.getByText('Accion observada')).toBeInTheDocument();
    expect(screen.getByText('Usuarios afectados')).toBeInTheDocument();
    expect(screen.getByText('Incidentes')).toBeInTheDocument();
    expect(screen.getAllByText('Criticos').length).toBeGreaterThan(0);
    expect(screen.getByText('Resueltos')).toBeInTheDocument();
    expect(screen.getByText('Ultimas 24 h')).toBeInTheDocument();
    expect(screen.getByText('Detalle operativo')).toBeInTheDocument();
    expect(screen.getAllByText('Escritura remota bloqueada').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Censo diario / daily_record_remote_write').length).toBeGreaterThan(
      0
    );
    expect(screen.getAllByText('Guardar dia').length).toBeGreaterThan(0);
    expect(screen.getByText('/censo')).toBeInTheDocument();
    expect(screen.queryByText('Detalle')).not.toBeInTheDocument();

    await userEvent.type(
      screen.getAllByPlaceholderText('Nota de resolucion...')[0],
      'Permiso corregido'
    );
    await userEvent.click(screen.getAllByRole('button', { name: /Marcar resuelto/i })[0]);

    await waitFor(() =>
      expect(mocks.resolveSystemHealthIncident).toHaveBeenCalledWith(
        expect.objectContaining({
          resolutionKey: 'u1:event-1',
          actor: expect.objectContaining({
            uid: 'admin-1',
            email: 'admin@example.com',
            displayName: 'Admin User',
          }),
          note: 'Permiso corregido',
        })
      )
    );
    expect((await screen.findAllByText('Resuelto')).length).toBeGreaterThan(0);
    expect(screen.getByText('Historial de resolucion')).toBeInTheDocument();
    expect(screen.getAllByText(/Admin User/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Permiso corregido/i).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: /Reabrir/i }).length).toBeGreaterThan(0);

    await userEvent.click(screen.getAllByRole('button', { name: /Reabrir/i })[0]);

    await waitFor(() =>
      expect(mocks.reopenSystemHealthIncident).toHaveBeenCalledWith(
        expect.objectContaining({
          resolutionKey: 'u1:event-1',
          actor: expect.objectContaining({
            uid: 'admin-1',
          }),
        })
      )
    );

    expect(
      (await screen.findAllByRole('button', { name: /Marcar resuelto/i })).length
    ).toBeGreaterThan(0);

    await userEvent.click(screen.getByTitle('Borrar registro de salud'));

    await waitFor(() => expect(mocks.deleteUserHealthSnapshot).toHaveBeenCalledWith('u1'));
    expect(mocks.success).toHaveBeenCalledWith('Registro de salud borrado', 'user@example.com');
  });

  it('marks all visible open incidents as resolved in bulk', async () => {
    render(<SystemHealthDashboard />);

    expect(await screen.findByPlaceholderText('Buscar usuario...')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Marcar visibles resueltos/i }));

    await waitFor(() =>
      expect(mocks.resolveSystemHealthIncident).toHaveBeenCalledWith(
        expect.objectContaining({
          resolutionKey: 'u1:event-1',
          note: 'Cierre operacional masivo desde Salud de usuarios',
        })
      )
    );
    expect(mocks.resolveSystemHealthIncident).toHaveBeenCalledTimes(4);
    expect(mocks.success).toHaveBeenCalledWith('Incidentes visibles marcados como resueltos', '4');
  });

  it('restores visible incidents when bulk resolve cannot be persisted', async () => {
    mocks.resolveSystemHealthIncident.mockRejectedValueOnce(new Error('permission-denied'));

    render(<SystemHealthDashboard />);

    expect(await screen.findByPlaceholderText('Buscar usuario...')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Marcar visibles resueltos/i }));

    await waitFor(() =>
      expect(mocks.error).toHaveBeenCalledWith(
        'No se pudieron resolver los incidentes visibles',
        'Error: permission-denied'
      )
    );
    expect(screen.getAllByRole('button', { name: /Marcar resuelto/i }).length).toBeGreaterThan(0);
  });
});
