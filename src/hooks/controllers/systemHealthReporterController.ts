import type { UserHealthStatus } from '@/services/admin/healthService';
import type { SyncQueueTelemetry } from '@/services/storage/syncQueueService';
import type { RepositoryPerformanceSummary } from '@/services/repositories/repositoryPerformance';
import { CURRENT_SCHEMA_VERSION } from '@/constants/version';
import { BACKEND_RUNTIME_CONTRACT_VERSION } from '@/constants/runtimeContracts';
import type { UserRole } from '@/types';
import type { OperationalTelemetrySummary } from '@/services/observability/operationalTelemetryService';

export interface BuildUserHealthStatusOptions {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  isFirebaseConnected: boolean;
  isOutdated: boolean;
  mutatingCount: number;
  localErrorCount: number;
  degradedLocalPersistence: boolean;
  navigatorOnline: boolean;
  platform: string;
  userAgent: string;
  syncTelemetry: SyncQueueTelemetry;
  repositoryPerformance: RepositoryPerformanceSummary;
  operationalTelemetry: OperationalTelemetrySummary;
}

const HEALTH_REPORTER_ROLES = new Set<UserRole>(['admin', 'nurse_hospital']);

export const canReportSystemHealthForRole = (role: UserRole | undefined): boolean =>
  !!role && HEALTH_REPORTER_ROLES.has(role);

export const buildUserHealthStatus = (options: BuildUserHealthStatusOptions): UserHealthStatus => ({
  uid: options.uid,
  email: options.email || 'unknown',
  displayName: options.displayName || 'Usuario',
  lastSeen: new Date().toISOString(),
  isOnline: options.isFirebaseConnected && options.navigatorOnline,
  isOutdated: options.isOutdated,
  pendingMutations: options.mutatingCount + options.syncTelemetry.pending,
  pendingSyncTasks: options.syncTelemetry.pending,
  failedSyncTasks: options.syncTelemetry.failed,
  conflictSyncTasks: options.syncTelemetry.conflict,
  retryingSyncTasks: options.syncTelemetry.retrying,
  oldestPendingAgeMs: options.syncTelemetry.oldestPendingAgeMs,
  localErrorCount: options.localErrorCount,
  degradedLocalPersistence: options.degradedLocalPersistence,
  repositoryWarningCount: options.repositoryPerformance.warningCount,
  slowestRepositoryOperationMs: options.repositoryPerformance.slowestOperationMs,
  operationalObservedCount: options.operationalTelemetry.recentObservedCount,
  operationalFailureCount: options.operationalTelemetry.recentFailedCount,
  operationalLastHourObservedCount: options.operationalTelemetry.lastHourObservedCount,
  operationalSyncObservedCount: options.operationalTelemetry.syncObservedCount,
  operationalIndexedDbObservedCount: options.operationalTelemetry.indexedDbObservedCount,
  operationalClinicalDocumentObservedCount:
    options.operationalTelemetry.clinicalDocumentObservedCount,
  operationalCreateDayObservedCount: options.operationalTelemetry.createDayObservedCount,
  operationalExportBackupObservedCount: options.operationalTelemetry.exportOrBackupObservedCount,
  latestOperationalIssueAt: options.operationalTelemetry.latestIssueAt,
  appVersion: `v${CURRENT_SCHEMA_VERSION} (sync-batch:${options.syncTelemetry.batchSize}, backend-contract:${BACKEND_RUNTIME_CONTRACT_VERSION})`,
  platform: options.platform,
  userAgent: options.userAgent,
});
