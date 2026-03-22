import { describe, expect, it } from 'vitest';
import type { UserHealthStatus } from '@/services/admin/healthService';
import {
  buildSystemHealthMetricCards,
  filterSystemHealthStats,
  formatLatestOperationalSummary,
} from '@/features/admin/components/systemHealthDashboardUtils';

const baseStatus = (overrides: Partial<UserHealthStatus> = {}): UserHealthStatus => ({
  uid: 'u1',
  email: 'user@example.com',
  displayName: 'User Example',
  lastSeen: '2026-03-13T00:00:00.000Z',
  isOnline: true,
  isOutdated: false,
  pendingMutations: 0,
  pendingSyncTasks: 0,
  failedSyncTasks: 0,
  conflictSyncTasks: 0,
  retryingSyncTasks: 0,
  oldestPendingAgeMs: 0,
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
  latestOperationalRuntimeState: undefined,
  appVersion: 'v1',
  platform: 'MacIntel',
  userAgent: 'Vitest',
  ...overrides,
});

describe('systemHealthDashboardUtils', () => {
  it('filters by email and display name with trimmed case-insensitive search', () => {
    const stats = [
      baseStatus(),
      baseStatus({
        uid: 'u2',
        email: 'other@example.com',
        displayName: 'Nurse Two',
      }),
    ];

    expect(filterSystemHealthStats(stats, '  nurse  ')).toHaveLength(1);
    expect(filterSystemHealthStats(stats, 'USER@EXAMPLE.COM')).toHaveLength(1);
    expect(filterSystemHealthStats(stats, '')).toHaveLength(2);
  });

  it('formats missing operational timestamps defensively', () => {
    expect(formatLatestOperationalSummary()).toBe('Sin observaciones recientes');
  });

  it('builds a stable metrics card set for the summary grid', () => {
    const cards = buildSystemHealthMetricCards({
      totalUsers: 2,
      onlineUsers: 1,
      offlineUsers: 1,
      outdatedUsers: 0,
      degradedLocalPersistenceUsers: 1,
      usersWithRepositoryWarnings: 1,
      usersWithSyncFailures: 1,
      totalPendingSyncTasks: 0,
      totalFailedSyncTasks: 1,
      totalConflictSyncTasks: 1,
      totalLocalErrorCount: 3,
      totalRepositoryWarnings: 2,
      maxSlowRepositoryOperationMs: 2500,
      oldestObservedPendingAgeMs: 0,
      totalOperationalObservedCount: 5,
      totalOperationalFailureCount: 2,
      totalOperationalRetryableCount: 1,
      totalOperationalRecoverableCount: 2,
      totalOperationalDegradedCount: 1,
      totalOperationalBlockedCount: 1,
      totalOperationalUnauthorizedCount: 1,
      totalOperationalLastHourObservedCount: 1,
      totalOperationalSyncObservedCount: 2,
      totalOperationalIndexedDbObservedCount: 1,
      totalOperationalClinicalDocumentObservedCount: 1,
      totalOperationalCreateDayObservedCount: 0,
      totalOperationalHandoffObservedCount: 1,
      totalOperationalExportBackupObservedCount: 1,
      topOperationalCategory: 'sync',
      topOperationalOperation: 'retry_queue',
      topOperationalRuntimeState: 'recoverable',
      usersWithRecentOperationalIssues: 1,
      latestOperationalIssueAt: undefined,
    });

    expect(cards).toHaveLength(10);
    expect(cards[0].title).toBe('Usuarios');
    expect(cards[3].detail).toContain('1 usuarios');
    expect(cards[6].detail).toContain('Bloqueadas: 1');
    expect(cards[8].detail).toContain('Estado dominante: recoverable');
  });
});
