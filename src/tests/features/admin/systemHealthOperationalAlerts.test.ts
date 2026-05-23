import { describe, expect, it } from 'vitest';
import { UserHealthStatus } from '@/services/admin/healthService';
import {
  EMPTY_OPERATIONAL_ALERT_SNAPSHOT,
  applyOperationalAlertsSnapshot,
  buildOperationalAlerts,
  clearOperationalAlertsSnapshot,
  getVisibleOperationalAlerts,
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

describe('systemHealthOperationalAlerts', () => {
  it('returns critical alerts when there are failed sync users', () => {
    const status = baseStatus();
    status.failedSyncTasks = 1;
    status.recentEvents = [
      {
        id: 'sync-1',
        source: 'operational',
        category: 'sync',
        severity: 'critical',
        status: 'open',
        timestamp: '2026-02-19T19:58:00.000Z',
        message: 'UPDATE_DAILY_RECORD fallida en cola local',
        operation: 'partial_update_retry',
        module: 'Censo diario',
        action: 'Revisar permisos/reglas y sesión del usuario.',
        route: 'daily:2026-02-19',
      },
    ];

    const alerts = buildOperationalAlerts([status]);
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0].severity).toBe('critical');
    const failedSync = alerts.find(alert => alert.key === 'failed-sync');
    expect(failedSync).toMatchObject({
      originLabel: 'Censo diario / partial_update_retry',
      actionLabel: 'Revisar permisos/reglas y sesión del usuario.',
      routeLabel: 'daily:2026-02-19',
      lastSeenAt: '2026-02-19T19:58:00.000Z',
      affectedUserLabels: ['User'],
    });
  });

  it('returns warning alert when users are offline for prolonged time', () => {
    const status = baseStatus();
    status.isOnline = false;
    status.lastSeen = new Date(FIXED_NOW_MS - 20 * 60 * 1000).toISOString();

    const alerts = buildOperationalAlerts([status], FIXED_NOW_MS);
    expect(alerts.some(alert => alert.key === 'offline-users')).toBe(true);
  });

  it('returns runtime incident alerts for sync unreadable and recovered daily-record nulls', () => {
    const status = baseStatus();
    status.operationalSyncReadUnavailableCount = 1;
    status.operationalDailyRecordRecoveredRealtimeNullCount = 1;

    const alerts = buildOperationalAlerts([status], FIXED_NOW_MS);
    expect(alerts.some(alert => alert.key === 'sync-runtime-unavailable')).toBe(true);
    expect(alerts.some(alert => alert.key === 'daily-record-null-recovered')).toBe(true);
  });

  it('returns critical alerts for ownership drift and runtime mismatch', () => {
    const status = baseStatus();
    status.syncOrphanedTasks = 2;
    status.versionUpdateReason = 'runtime_contract_mismatch';

    const alerts = buildOperationalAlerts([status], FIXED_NOW_MS);
    expect(alerts.some(alert => alert.key === 'sync-ownership-drift')).toBe(true);
    expect(alerts.some(alert => alert.key === 'runtime-contract-mismatch')).toBe(true);
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

  it('clears current global alerts and starts a new alert window from the current fingerprint', () => {
    const status = baseStatus();
    status.failedSyncTasks = 1;
    const alerts = buildOperationalAlerts([status], FIXED_NOW_MS);

    const opened = applyOperationalAlertsSnapshot(
      EMPTY_OPERATIONAL_ALERT_SNAPSHOT,
      alerts,
      '2026-02-19T20:00:00.000Z'
    );
    const cleared = clearOperationalAlertsSnapshot(opened, alerts, '2026-02-19T20:05:00.000Z');

    expect(cleared.history).toEqual([]);
    expect(getVisibleOperationalAlerts(alerts, cleared)).toEqual([]);

    const sameFingerprint = applyOperationalAlertsSnapshot(
      cleared,
      alerts,
      '2026-02-19T20:06:00.000Z'
    );
    expect(Object.keys(sameFingerprint.active)).toHaveLength(0);
    expect(sameFingerprint.history).toEqual([]);

    const secondStatus = baseStatus();
    secondStatus.uid = 'u2';
    secondStatus.email = 'other@example.com';
    secondStatus.failedSyncTasks = 1;
    const changedAlerts = buildOperationalAlerts([status, secondStatus], FIXED_NOW_MS);
    const reopened = applyOperationalAlertsSnapshot(
      sameFingerprint,
      changedAlerts,
      '2026-02-19T20:07:00.000Z'
    );

    expect(Object.keys(reopened.active).length).toBeGreaterThan(0);
    expect(reopened.history.some(event => event.type === 'opened')).toBe(true);
  });
});
