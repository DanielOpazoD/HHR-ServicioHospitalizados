import { db } from '../infrastructure/db';
import { healthServiceLogger } from '@/services/admin/adminLoggers';
import type { OperationalRuntimeState } from '@/services/observability/operationalRuntimeState';

const HEALTH_COLLECTION = 'system_health';
const STATS_DOC = 'stats';
const USERS_SUBCOLLECTION = 'users';

export interface UserHealthStatus {
  uid: string;
  email: string;
  displayName: string;
  lastSeen: string;
  isOnline: boolean;
  isOutdated: boolean;
  pendingMutations: number;
  pendingSyncTasks: number;
  failedSyncTasks: number;
  conflictSyncTasks: number;
  retryingSyncTasks: number;
  oldestPendingAgeMs: number;
  localErrorCount: number;
  degradedLocalPersistence: boolean;
  repositoryWarningCount: number;
  slowestRepositoryOperationMs: number;
  operationalObservedCount: number;
  operationalFailureCount: number;
  operationalRetryableCount: number;
  operationalRecoverableCount: number;
  operationalDegradedCount: number;
  operationalBlockedCount: number;
  operationalUnauthorizedCount: number;
  operationalLastHourObservedCount: number;
  operationalSyncObservedCount: number;
  operationalIndexedDbObservedCount: number;
  operationalClinicalDocumentObservedCount: number;
  operationalCreateDayObservedCount: number;
  operationalHandoffObservedCount: number;
  operationalExportBackupObservedCount: number;
  operationalDailyRecordRecoveredRealtimeNullCount?: number;
  operationalDailyRecordConfirmedRealtimeNullCount?: number;
  operationalSyncReadUnavailableCount?: number;
  operationalIndexedDbFallbackModeCount?: number;
  operationalAuthBootstrapTimeoutCount?: number;
  operationalTopObservedCategory?: string;
  operationalTopObservedOperation?: string;
  latestOperationalOperation?: string;
  latestOperationalRuntimeState?: OperationalRuntimeState;
  latestOperationalIssueAt?: string;
  appVersion: string;
  platform: string;
  userAgent: string;
}

export interface SystemHealthSummary {
  totalUsers: number;
  onlineUsers: number;
  offlineUsers: number;
  outdatedUsers: number;
  degradedLocalPersistenceUsers: number;
  usersWithRepositoryWarnings: number;
  usersWithSyncFailures: number;
  totalPendingSyncTasks: number;
  totalFailedSyncTasks: number;
  totalConflictSyncTasks: number;
  totalLocalErrorCount: number;
  totalRepositoryWarnings: number;
  maxSlowRepositoryOperationMs: number;
  oldestObservedPendingAgeMs: number;
  totalOperationalObservedCount: number;
  totalOperationalFailureCount: number;
  totalOperationalRetryableCount: number;
  totalOperationalRecoverableCount: number;
  totalOperationalDegradedCount: number;
  totalOperationalBlockedCount: number;
  totalOperationalUnauthorizedCount: number;
  totalOperationalLastHourObservedCount: number;
  totalOperationalSyncObservedCount: number;
  totalOperationalIndexedDbObservedCount: number;
  totalOperationalClinicalDocumentObservedCount: number;
  totalOperationalCreateDayObservedCount: number;
  totalOperationalHandoffObservedCount: number;
  totalOperationalExportBackupObservedCount: number;
  totalOperationalDailyRecordRecoveredRealtimeNullCount: number;
  totalOperationalDailyRecordConfirmedRealtimeNullCount: number;
  totalOperationalSyncReadUnavailableCount: number;
  totalOperationalIndexedDbFallbackModeCount: number;
  totalOperationalAuthBootstrapTimeoutCount: number;
  topOperationalCategory?: string;
  topOperationalOperation?: string;
  topOperationalRuntimeState?: OperationalRuntimeState;
  usersWithRecentOperationalIssues: number;
  latestOperationalIssueAt?: string;
}

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toBoolean = (value: unknown, fallback = false): boolean =>
  typeof value === 'boolean' ? value : fallback;

const toStringValue = (value: unknown, fallback = ''): string =>
  typeof value === 'string' && value.trim().length > 0 ? value : fallback;

const isHealthPermissionError = (error: unknown): boolean => {
  const authError = error as { code?: string; message?: string };
  const code = String(authError?.code || '').toLowerCase();
  const message = String(authError?.message || '').toLowerCase();
  return code.includes('permission') || message.includes('missing or insufficient permissions');
};

export const normalizeUserHealthStatus = (raw: Partial<UserHealthStatus>): UserHealthStatus => ({
  uid: toStringValue(raw.uid, 'unknown'),
  email: toStringValue(raw.email, 'unknown@local'),
  displayName: toStringValue(raw.displayName, 'Usuario sin nombre'),
  lastSeen: toStringValue(raw.lastSeen, new Date(0).toISOString()),
  isOnline: toBoolean(raw.isOnline, false),
  isOutdated: toBoolean(raw.isOutdated, false),
  pendingMutations: toNumber(raw.pendingMutations),
  pendingSyncTasks: toNumber(raw.pendingSyncTasks),
  failedSyncTasks: toNumber(raw.failedSyncTasks),
  conflictSyncTasks: toNumber(raw.conflictSyncTasks),
  retryingSyncTasks: toNumber(raw.retryingSyncTasks),
  oldestPendingAgeMs: toNumber(raw.oldestPendingAgeMs),
  localErrorCount: toNumber(raw.localErrorCount),
  degradedLocalPersistence: toBoolean(raw.degradedLocalPersistence, false),
  repositoryWarningCount: toNumber(raw.repositoryWarningCount),
  slowestRepositoryOperationMs: toNumber(raw.slowestRepositoryOperationMs),
  operationalObservedCount: toNumber(raw.operationalObservedCount),
  operationalFailureCount: toNumber(raw.operationalFailureCount),
  operationalRetryableCount: toNumber(raw.operationalRetryableCount),
  operationalRecoverableCount: toNumber(raw.operationalRecoverableCount),
  operationalDegradedCount: toNumber(raw.operationalDegradedCount),
  operationalBlockedCount: toNumber(raw.operationalBlockedCount),
  operationalUnauthorizedCount: toNumber(raw.operationalUnauthorizedCount),
  operationalLastHourObservedCount: toNumber(raw.operationalLastHourObservedCount),
  operationalSyncObservedCount: toNumber(raw.operationalSyncObservedCount),
  operationalIndexedDbObservedCount: toNumber(raw.operationalIndexedDbObservedCount),
  operationalClinicalDocumentObservedCount: toNumber(raw.operationalClinicalDocumentObservedCount),
  operationalCreateDayObservedCount: toNumber(raw.operationalCreateDayObservedCount),
  operationalHandoffObservedCount: toNumber(raw.operationalHandoffObservedCount),
  operationalExportBackupObservedCount: toNumber(raw.operationalExportBackupObservedCount),
  operationalDailyRecordRecoveredRealtimeNullCount: toNumber(
    raw.operationalDailyRecordRecoveredRealtimeNullCount
  ),
  operationalDailyRecordConfirmedRealtimeNullCount: toNumber(
    raw.operationalDailyRecordConfirmedRealtimeNullCount
  ),
  operationalSyncReadUnavailableCount: toNumber(raw.operationalSyncReadUnavailableCount),
  operationalIndexedDbFallbackModeCount: toNumber(raw.operationalIndexedDbFallbackModeCount),
  operationalAuthBootstrapTimeoutCount: toNumber(raw.operationalAuthBootstrapTimeoutCount),
  operationalTopObservedCategory:
    typeof raw.operationalTopObservedCategory === 'string'
      ? raw.operationalTopObservedCategory
      : undefined,
  operationalTopObservedOperation:
    typeof raw.operationalTopObservedOperation === 'string'
      ? raw.operationalTopObservedOperation
      : undefined,
  latestOperationalOperation:
    typeof raw.latestOperationalOperation === 'string' ? raw.latestOperationalOperation : undefined,
  latestOperationalRuntimeState:
    raw.latestOperationalRuntimeState === 'retryable' ||
    raw.latestOperationalRuntimeState === 'recoverable' ||
    raw.latestOperationalRuntimeState === 'degraded' ||
    raw.latestOperationalRuntimeState === 'blocked' ||
    raw.latestOperationalRuntimeState === 'unauthorized'
      ? raw.latestOperationalRuntimeState
      : undefined,
  latestOperationalIssueAt:
    typeof raw.latestOperationalIssueAt === 'string' ? raw.latestOperationalIssueAt : undefined,
  appVersion: toStringValue(raw.appVersion, 'unknown'),
  platform: toStringValue(raw.platform, 'unknown'),
  userAgent: toStringValue(raw.userAgent, 'unknown'),
});

export const buildSystemHealthSummary = (statuses: UserHealthStatus[]): SystemHealthSummary => {
  const latestOperationalIssueAt = statuses
    .map(status => status.latestOperationalIssueAt)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .sort()
    .at(-1);
  const topCount = (values: string[]): string | undefined => {
    if (values.length === 0) return undefined;
    const counts = values.reduce<Record<string, number>>((acc, value) => {
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  };
  const topOperationalCategory = topCount(
    statuses
      .map(status => status.operationalTopObservedCategory)
      .filter((value): value is string => Boolean(value))
  );
  const topOperationalOperation = topCount(
    statuses
      .map(status => status.operationalTopObservedOperation)
      .filter((value): value is string => Boolean(value))
  );
  const topOperationalRuntimeState = topCount(
    statuses
      .map(status => status.latestOperationalRuntimeState)
      .filter((value): value is OperationalRuntimeState => Boolean(value))
  ) as OperationalRuntimeState | undefined;

  return {
    totalUsers: statuses.length,
    onlineUsers: statuses.filter(status => status.isOnline).length,
    offlineUsers: statuses.filter(status => !status.isOnline).length,
    outdatedUsers: statuses.filter(status => status.isOutdated).length,
    degradedLocalPersistenceUsers: statuses.filter(status => status.degradedLocalPersistence)
      .length,
    usersWithRepositoryWarnings: statuses.filter(status => status.repositoryWarningCount > 0)
      .length,
    usersWithSyncFailures: statuses.filter(
      status => status.failedSyncTasks > 0 || status.conflictSyncTasks > 0
    ).length,
    totalPendingSyncTasks: statuses.reduce((sum, status) => sum + status.pendingSyncTasks, 0),
    totalFailedSyncTasks: statuses.reduce((sum, status) => sum + status.failedSyncTasks, 0),
    totalConflictSyncTasks: statuses.reduce((sum, status) => sum + status.conflictSyncTasks, 0),
    totalLocalErrorCount: statuses.reduce((sum, status) => sum + status.localErrorCount, 0),
    totalRepositoryWarnings: statuses.reduce(
      (sum, status) => sum + status.repositoryWarningCount,
      0
    ),
    maxSlowRepositoryOperationMs: statuses.reduce(
      (max, status) => Math.max(max, status.slowestRepositoryOperationMs),
      0
    ),
    oldestObservedPendingAgeMs: statuses.reduce(
      (max, status) => Math.max(max, status.oldestPendingAgeMs),
      0
    ),
    totalOperationalObservedCount: statuses.reduce(
      (sum, status) => sum + status.operationalObservedCount,
      0
    ),
    totalOperationalFailureCount: statuses.reduce(
      (sum, status) => sum + status.operationalFailureCount,
      0
    ),
    totalOperationalRetryableCount: statuses.reduce(
      (sum, status) => sum + status.operationalRetryableCount,
      0
    ),
    totalOperationalRecoverableCount: statuses.reduce(
      (sum, status) => sum + status.operationalRecoverableCount,
      0
    ),
    totalOperationalDegradedCount: statuses.reduce(
      (sum, status) => sum + status.operationalDegradedCount,
      0
    ),
    totalOperationalBlockedCount: statuses.reduce(
      (sum, status) => sum + status.operationalBlockedCount,
      0
    ),
    totalOperationalUnauthorizedCount: statuses.reduce(
      (sum, status) => sum + status.operationalUnauthorizedCount,
      0
    ),
    totalOperationalLastHourObservedCount: statuses.reduce(
      (sum, status) => sum + status.operationalLastHourObservedCount,
      0
    ),
    totalOperationalSyncObservedCount: statuses.reduce(
      (sum, status) => sum + status.operationalSyncObservedCount,
      0
    ),
    totalOperationalIndexedDbObservedCount: statuses.reduce(
      (sum, status) => sum + status.operationalIndexedDbObservedCount,
      0
    ),
    totalOperationalClinicalDocumentObservedCount: statuses.reduce(
      (sum, status) => sum + status.operationalClinicalDocumentObservedCount,
      0
    ),
    totalOperationalCreateDayObservedCount: statuses.reduce(
      (sum, status) => sum + status.operationalCreateDayObservedCount,
      0
    ),
    totalOperationalHandoffObservedCount: statuses.reduce(
      (sum, status) => sum + status.operationalHandoffObservedCount,
      0
    ),
    totalOperationalExportBackupObservedCount: statuses.reduce(
      (sum, status) => sum + status.operationalExportBackupObservedCount,
      0
    ),
    totalOperationalDailyRecordRecoveredRealtimeNullCount: statuses.reduce(
      (sum, status) => sum + (status.operationalDailyRecordRecoveredRealtimeNullCount || 0),
      0
    ),
    totalOperationalDailyRecordConfirmedRealtimeNullCount: statuses.reduce(
      (sum, status) => sum + (status.operationalDailyRecordConfirmedRealtimeNullCount || 0),
      0
    ),
    totalOperationalSyncReadUnavailableCount: statuses.reduce(
      (sum, status) => sum + (status.operationalSyncReadUnavailableCount || 0),
      0
    ),
    totalOperationalIndexedDbFallbackModeCount: statuses.reduce(
      (sum, status) => sum + (status.operationalIndexedDbFallbackModeCount || 0),
      0
    ),
    totalOperationalAuthBootstrapTimeoutCount: statuses.reduce(
      (sum, status) => sum + (status.operationalAuthBootstrapTimeoutCount || 0),
      0
    ),
    topOperationalCategory,
    topOperationalOperation,
    topOperationalRuntimeState,
    usersWithRecentOperationalIssues: statuses.filter(status => !!status.latestOperationalIssueAt)
      .length,
    latestOperationalIssueAt,
  };
};

export const reportUserHealth = async (status: UserHealthStatus): Promise<void> => {
  try {
    const path = `${STATS_DOC}/${HEALTH_COLLECTION}/${USERS_SUBCOLLECTION}`;
    await db.setDoc(path, status.uid, {
      ...status,
      lastSeen: new Date().toISOString(),
    });
  } catch (error) {
    if (isHealthPermissionError(error)) {
      return;
    }
    healthServiceLogger.error('Failed to report health', error);
  }
};

export const subscribeToSystemHealth = (onUpdate: (data: UserHealthStatus[]) => void) => {
  const path = `${STATS_DOC}/${HEALTH_COLLECTION}/${USERS_SUBCOLLECTION}`;
  return db.subscribeQuery<Partial<UserHealthStatus>>(
    path,
    {
      orderBy: [{ field: 'lastSeen', direction: 'desc' }],
      limit: 50,
    },
    users => {
      onUpdate(users.map(normalizeUserHealthStatus));
    }
  );
};

export const getSystemHealthSnapshot = async (): Promise<UserHealthStatus[]> => {
  try {
    const path = `${STATS_DOC}/${HEALTH_COLLECTION}/${USERS_SUBCOLLECTION}`;
    const users = await db.getDocs<Partial<UserHealthStatus>>(path, {
      orderBy: [{ field: 'lastSeen', direction: 'desc' }],
      limit: 100,
    });
    return users.map(normalizeUserHealthStatus);
  } catch (error) {
    healthServiceLogger.error('Failed to fetch health snapshot', error);
    return [];
  }
};
