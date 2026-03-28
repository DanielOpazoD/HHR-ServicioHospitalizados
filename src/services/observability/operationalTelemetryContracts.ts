import type {
  OperationalTelemetryCategory,
  OperationalTelemetryStatus,
} from '@/services/observability/operationalTelemetryTypes';
import type { OperationalRuntimeState } from '@/services/observability/operationalRuntimeState';

export interface OperationalTelemetrySummary {
  recentEventCount: number;
  recentFailedCount: number;
  recentObservedCount: number;
  recentRetryableCount: number;
  recentRecoverableCount: number;
  recentDegradedCount: number;
  recentBlockedCount: number;
  recentUnauthorizedCount: number;
  lastHourObservedCount: number;
  syncFailureCount: number;
  syncObservedCount: number;
  degradedLocalCount: number;
  indexedDbObservedCount: number;
  clinicalDocumentObservedCount: number;
  createDayObservedCount: number;
  handoffObservedCount: number;
  exportObservedCount: number;
  backupObservedCount: number;
  exportOrBackupObservedCount: number;
  dailyRecordRecoveredRealtimeNullCount: number;
  dailyRecordConfirmedRealtimeNullCount: number;
  syncReadUnavailableCount: number;
  indexedDbFallbackModeCount: number;
  authBootstrapTimeoutCount: number;
  topObservedCategory?: OperationalTelemetryCategory;
  topObservedOperation?: string;
  latestObservedOperation?: string;
  latestRuntimeState?: OperationalRuntimeState;
  latestIssueAt?: string;
}

export interface OperationalOutcomeLike {
  status: OperationalTelemetryStatus;
  issues?: Array<{ message?: string }>;
}
