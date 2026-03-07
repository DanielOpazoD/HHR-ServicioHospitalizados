import { describe, expect, it } from 'vitest';
import {
  buildUserHealthStatus,
  canReportSystemHealthForRole,
} from '@/hooks/controllers/systemHealthReporterController';

describe('systemHealthReporterController', () => {
  it('allows health reporting only for admin and nursing roles', () => {
    expect(canReportSystemHealthForRole('admin')).toBe(true);
    expect(canReportSystemHealthForRole('nurse_hospital')).toBe(true);
    expect(canReportSystemHealthForRole('doctor_urgency')).toBe(false);
    expect(canReportSystemHealthForRole('viewer')).toBe(false);
    expect(canReportSystemHealthForRole(undefined)).toBe(false);
  });

  it('builds a normalized health payload with sync and repository metrics', () => {
    const status = buildUserHealthStatus({
      uid: 'u1',
      email: 'user@example.com',
      displayName: 'User',
      isFirebaseConnected: true,
      isOutdated: false,
      mutatingCount: 2,
      localErrorCount: 3,
      degradedLocalPersistence: true,
      navigatorOnline: true,
      platform: 'MacIntel',
      userAgent: 'Vitest',
      syncTelemetry: {
        pending: 4,
        failed: 1,
        conflict: 2,
        retrying: 1,
        oldestPendingAgeMs: 9000,
        batchSize: 25,
      },
      repositoryPerformance: {
        totalRecorded: 12,
        warningCount: 3,
        slowestOperationMs: 480,
        slowestOperation: 'getForDate',
        latestWarningAt: '2026-03-01T00:00:00.000Z',
        recentWarningOperations: [],
      },
      operationalTelemetry: {
        recentEventCount: 5,
        recentFailedCount: 2,
        recentObservedCount: 3,
        syncFailureCount: 1,
        syncObservedCount: 2,
        degradedLocalCount: 1,
        indexedDbObservedCount: 1,
        clinicalDocumentObservedCount: 1,
        createDayObservedCount: 1,
        exportObservedCount: 1,
        backupObservedCount: 1,
        exportOrBackupObservedCount: 2,
        latestIssueAt: '2026-03-02T00:00:00.000Z',
      },
    });

    expect(status.pendingMutations).toBe(6);
    expect(status.pendingSyncTasks).toBe(4);
    expect(status.failedSyncTasks).toBe(1);
    expect(status.degradedLocalPersistence).toBe(true);
    expect(status.repositoryWarningCount).toBe(3);
    expect(status.slowestRepositoryOperationMs).toBe(480);
    expect(status.operationalObservedCount).toBe(3);
    expect(status.operationalFailureCount).toBe(2);
    expect(status.operationalSyncObservedCount).toBe(2);
    expect(status.operationalIndexedDbObservedCount).toBe(1);
    expect(status.operationalClinicalDocumentObservedCount).toBe(1);
    expect(status.operationalCreateDayObservedCount).toBe(1);
    expect(status.operationalExportBackupObservedCount).toBe(2);
    expect(status.appVersion).toContain('sync-batch:25');
  });
});
