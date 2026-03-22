import { describe, expect, it } from 'vitest';
import { UserHealthStatus } from '@/services/admin/healthService';
import {
  EMPTY_OPERATIONAL_ALERT_SNAPSHOT,
  applyOperationalAlertsSnapshot,
  buildOperationalAlerts,
} from '@/features/admin/components/systemHealthOperationalAlerts';

const FIXED_NOW_MS = Date.parse('2026-02-19T20:00:00.000Z');
const FIXED_LAST_SEEN = '2026-02-19T20:00:00.000Z';

const baseStatus = (): UserHealthStatus => ({
  uid: 'u1',
  email: 'user@example.com',
  displayName: 'User',
  lastSeen: FIXED_LAST_SEEN,
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
  operationalTopObservedCategory: undefined,
  operationalTopObservedOperation: undefined,
  latestOperationalOperation: undefined,
  latestOperationalRuntimeState: undefined,
  appVersion: 'v1',
  platform: 'test',
  userAgent: 'vitest',
});

describe('systemHealthOperationalAlerts', () => {
  it('returns critical alerts when there are failed sync users', () => {
    const status = baseStatus();
    status.failedSyncTasks = 1;

    const alerts = buildOperationalAlerts([status]);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].severity).toBe('critical');
    expect(alerts.some(alert => alert.key === 'failed-sync')).toBe(true);
  });

  it('returns warning alert when users are offline for prolonged time', () => {
    const status = baseStatus();
    status.isOnline = false;
    status.lastSeen = new Date(FIXED_NOW_MS - 20 * 60 * 1000).toISOString();

    const alerts = buildOperationalAlerts([status], FIXED_NOW_MS);
    expect(alerts.some(alert => alert.key === 'offline-users')).toBe(true);
  });

  it('tracks open and resolved events in snapshot history', () => {
    const status = baseStatus();
    status.failedSyncTasks = 1;
    const openedAlerts = buildOperationalAlerts([status]);

    const opened = applyOperationalAlertsSnapshot(
      EMPTY_OPERATIONAL_ALERT_SNAPSHOT,
      openedAlerts,
      '2026-02-19T20:00:00.000Z'
    );
    expect(opened.history[0]?.type).toBe('opened');
    expect(Object.keys(opened.active).length).toBeGreaterThan(0);

    const resolved = applyOperationalAlertsSnapshot(opened, [], '2026-02-19T20:10:00.000Z');
    expect(resolved.history.some(event => event.type === 'resolved')).toBe(true);
    expect(Object.keys(resolved.active)).toHaveLength(0);
  });
});
