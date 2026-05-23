import type { OperationalAlert, OperationalAlertSeverity } from './systemHealthOperationalAlerts';

export interface OperationalAlertHistoryEvent {
  key: string;
  title: string;
  severity: OperationalAlertSeverity;
  type: 'opened' | 'resolved';
  at: string;
  affectedCount: number;
}

export interface OperationalAlertSnapshotState {
  active: Record<
    string,
    {
      title: string;
      severity: OperationalAlertSeverity;
      affectedCount: number;
      updatedAt: string;
      fingerprint: string;
    }
  >;
  dismissed?: Record<string, { fingerprint: string; dismissedAt: string }>;
  history: OperationalAlertHistoryEvent[];
  lastClearedAt?: string;
}

export const EMPTY_OPERATIONAL_ALERT_SNAPSHOT: OperationalAlertSnapshotState = {
  active: {},
  dismissed: {},
  history: [],
};

export const buildOperationalAlertFingerprint = (alert: OperationalAlert): string =>
  JSON.stringify({
    key: alert.key,
    severity: alert.severity,
    affectedUsers: [...alert.affectedUsers].sort(),
    originLabel: alert.originLabel,
    actionLabel: alert.actionLabel,
    routeLabel: alert.routeLabel,
  });

export const isOperationalAlertDismissed = (
  snapshot: OperationalAlertSnapshotState,
  alert: OperationalAlert
): boolean =>
  snapshot.dismissed?.[alert.key]?.fingerprint === buildOperationalAlertFingerprint(alert);

export const getVisibleOperationalAlerts = (
  alerts: OperationalAlert[],
  snapshot: OperationalAlertSnapshotState
): OperationalAlert[] => alerts.filter(alert => !isOperationalAlertDismissed(snapshot, alert));

export const applyOperationalAlertsSnapshot = (
  previous: OperationalAlertSnapshotState,
  currentAlerts: OperationalAlert[],
  nowIso: string,
  maxHistoryEntries: number = 50
): OperationalAlertSnapshotState => {
  const nextActive: OperationalAlertSnapshotState['active'] = {};
  const nextHistory: OperationalAlertHistoryEvent[] = [...previous.history];

  const previousActive = previous.active;
  const visibleAlerts = getVisibleOperationalAlerts(currentAlerts, previous);
  const currentByKey = new Map(visibleAlerts.map(alert => [alert.key, alert]));

  for (const [key, alert] of currentByKey) {
    nextActive[key] = {
      title: alert.title,
      severity: alert.severity,
      affectedCount: alert.affectedCount,
      updatedAt: nowIso,
      fingerprint: buildOperationalAlertFingerprint(alert),
    };

    if (!previousActive[key]) {
      nextHistory.push({
        key,
        title: alert.title,
        severity: alert.severity,
        type: 'opened',
        at: nowIso,
        affectedCount: alert.affectedCount,
      });
    }
  }

  for (const [key, previousAlert] of Object.entries(previousActive)) {
    if (!currentByKey.has(key)) {
      nextHistory.push({
        key,
        title: previousAlert.title,
        severity: previousAlert.severity,
        type: 'resolved',
        at: nowIso,
        affectedCount: previousAlert.affectedCount,
      });
    }
  }

  return {
    active: nextActive,
    dismissed: previous.dismissed || {},
    history: nextHistory.slice(-maxHistoryEntries),
    lastClearedAt: previous.lastClearedAt,
  };
};

export const clearOperationalAlertsSnapshot = (
  previous: OperationalAlertSnapshotState,
  currentAlerts: OperationalAlert[],
  nowIso: string
): OperationalAlertSnapshotState => {
  const dismissed = { ...(previous.dismissed || {}) };
  for (const alert of currentAlerts) {
    dismissed[alert.key] = {
      fingerprint: buildOperationalAlertFingerprint(alert),
      dismissedAt: nowIso,
    };
  }

  return {
    active: {},
    dismissed,
    history: [],
    lastClearedAt: nowIso,
  };
};
