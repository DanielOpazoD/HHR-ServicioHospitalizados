import type { UserHealthStatus } from '@/services/admin/healthService';

export interface OperationalAlertContextFallback {
  originLabel: string;
  actionLabel: string;
  routeLabel: string;
}

export interface OperationalAlertContext {
  affectedUserLabels: string[];
  originLabel?: string;
  actionLabel?: string;
  routeLabel?: string;
  lastSeenAt?: string;
}

const uniqueUserLabels = (users: UserHealthStatus[]): string[] =>
  Array.from(new Set(users.map(user => user.displayName || user.email).filter(Boolean)));

const buildEventOriginLabel = (
  event: NonNullable<UserHealthStatus['recentEvents']>[number] | undefined,
  fallback: string
): string => {
  if (!event) return fallback;
  if (event.module && event.operation) return `${event.module} / ${event.operation}`;
  return event.module || event.operation || fallback;
};

export const buildOperationalAlertContext = (
  users: UserHealthStatus[],
  fallback: OperationalAlertContextFallback
): OperationalAlertContext => {
  const latestEvent = users
    .flatMap(user => user.recentEvents || [])
    .filter(event => event.status !== 'resolved')
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))[0];
  const latestUserTimestamp = users
    .map(user => user.latestOperationalIssueAt || user.lastSeen)
    .sort((a, b) => Date.parse(b || '') - Date.parse(a || ''))[0];

  return {
    affectedUserLabels: uniqueUserLabels(users),
    originLabel: buildEventOriginLabel(latestEvent, fallback.originLabel),
    actionLabel: latestEvent?.action || fallback.actionLabel,
    routeLabel: latestEvent?.route || fallback.routeLabel,
    lastSeenAt: latestEvent?.timestamp || latestUserTimestamp,
  };
};
