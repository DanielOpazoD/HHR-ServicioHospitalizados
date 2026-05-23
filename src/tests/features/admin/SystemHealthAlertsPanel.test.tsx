import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { SystemHealthAlertsPanel } from '@/features/admin/components/SystemHealthAlertsPanel';
import type { UserHealthStatus } from '@/services/admin/healthService';

const baseStatus = (): UserHealthStatus => ({
  uid: 'u1',
  email: 'user@example.com',
  displayName: 'User',
  lastSeen: '2026-02-19T20:00:00.000Z',
  isOnline: true,
  isOutdated: false,
  pendingMutations: 0,
  pendingSyncTasks: 0,
  failedSyncTasks: 1,
  conflictSyncTasks: 0,
  retryingSyncTasks: 0,
  syncOrphanedTasks: 0,
  oldestPendingAgeMs: 0,
  remoteSyncReason: 'ready',
  versionUpdateReason: 'current',
  localErrorCount: 0,
  degradedLocalPersistence: false,
  repositoryWarningCount: 0,
  slowestRepositoryOperationMs: 0,
  operationalObservedCount: 0,
  operationalFailureCount: 0,
  operationalRetryableCount: 0,
  operationalRecoverableCount: 0,
  operationalDegradedCount: 0,
  operationalBlockedCount: 0,
  operationalUnauthorizedCount: 0,
  operationalLastHourObservedCount: 0,
  operationalSyncObservedCount: 0,
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
  operationalTopObservedCategory: undefined,
  operationalTopObservedOperation: undefined,
  latestOperationalOperation: undefined,
  latestOperationalRuntimeState: undefined,
  appVersion: 'v1',
  platform: 'test',
  userAgent: 'vitest',
});

describe('SystemHealthAlertsPanel', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('lets support clear current global alerts and keeps the panel clean for the same fingerprint', async () => {
    const status = baseStatus();
    const { rerender } = render(<SystemHealthAlertsPanel stats={[status]} />);

    expect(await screen.findByText('Sincronizaciones fallidas')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: /Limpiar alertas/i }));

    expect(await screen.findByText('Sin alertas activas.')).toBeInTheDocument();
    expect(screen.getByText(/Alertas globales limpiadas desde/i)).toBeInTheDocument();
    expect(window.localStorage.getItem('hhr_system_health_alert_snapshot_v1')).toContain(
      'dismissed'
    );

    rerender(<SystemHealthAlertsPanel stats={[status]} />);
    await waitFor(() => {
      expect(screen.queryByText('Sincronizaciones fallidas')).not.toBeInTheDocument();
    });
  });
});
