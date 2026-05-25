import type { UserHealthStatus } from '@/services/admin/healthService';
import type { SyncQueueTelemetry } from '@/services/storage/sync';
import type { RepositoryPerformanceSummary } from '@/services/repositories/repositoryPerformance';
import type { UserRole } from '@/types/authRoleTypes';
import type { OperationalTelemetrySummary } from '@/services/observability/operationalTelemetryContracts';
import type { OperationalTelemetryEvent } from '@/services/observability/operationalTelemetryTypes';
import type { ErrorLog } from '@/services/logging/errorLogTypes';
import type { SyncQueueOperationSnapshot } from '@/services/storage/sync';
import type {
  FirestoreSyncReason,
  RemoteSyncRuntimeStatus,
} from '@/services/repositories/repositoryConfig';
import type { UserHealthRecentEvent, VersionUpdateReason } from '@/services/admin/healthService';
import { buildSystemHealthAppVersion } from '@/hooks/controllers/systemHealthAppVersion';

export interface BuildUserHealthStatusOptions {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  isFirebaseConnected: boolean;
  isOutdated: boolean;
  remoteSyncReason: FirestoreSyncReason;
  versionUpdateReason: VersionUpdateReason;
  mutatingCount: number;
  localErrorCount: number;
  degradedLocalPersistence: boolean;
  navigatorOnline: boolean;
  platform: string;
  userAgent: string;
  syncTelemetry: SyncQueueTelemetry;
  repositoryPerformance: RepositoryPerformanceSummary;
  operationalTelemetry: OperationalTelemetrySummary;
  recentEvents?: UserHealthRecentEvent[];
}

export interface BuildRecentUserHealthEventsOptions {
  localErrors: ErrorLog[];
  operationalEvents: OperationalTelemetryEvent[];
  recentSyncOperations?: SyncQueueOperationSnapshot[];
  maxEvents?: number;
}

const HEALTH_REPORTER_ROLES = new Set<UserRole>(['admin', 'nurse_hospital']);

export const canReportSystemHealthForRole = (role: UserRole | undefined): boolean =>
  !!role && HEALTH_REPORTER_ROLES.has(role);

export const canReportSystemHealthForRuntime = (
  role: UserRole | undefined,
  remoteSyncStatus: RemoteSyncRuntimeStatus
): boolean => canReportSystemHealthForRole(role) && remoteSyncStatus === 'ready';

const CONTEXT_SUMMARY_LABELS: Record<string, string> = {
  clinicaldate: 'fecha clinica',
  bedlabel: 'cama',
  fieldlabel: 'campo',
  patchtype: 'tipo',
  bedid: 'cama',
  fieldkey: 'campo',
};
const CONTEXT_KEYS = [
  'clinicaldate',
  'bedlabel',
  'fieldlabel',
  'patchtype',
  'bedid',
  'fieldkey',
  'module',
  'section',
  'screen',
  'feature',
  'component',
  'action',
  'button',
];
const CONTEXT_SUMMARY_PRIORITY = new Map(CONTEXT_KEYS.map((key, index) => [key, index]));
const PRIVATE_CONTEXT_KEYS = new Set(['patient', 'patientname', 'rut', 'diagnosis', 'diagnostico']);
const SYNC_CONTEXT_LABELS: Record<string, string> = {
  clinical: 'Censo diario',
  staffing: 'Dotacion',
  movements: 'Movimientos',
  handoff: 'Entrega turno',
  metadata: 'Metadata',
  unknown: 'Sincronizacion local',
};
const SYNC_FIELD_LABELS: Record<string, string> = {
  pathology: 'Diagnostico',
  specialty: 'Especialidad',
  secondarySpecialty: 'Especialidad secundaria',
  status: 'Estado',
  patientName: 'Nombre paciente',
  rut: 'RUT',
  age: 'Edad',
  admissionDate: 'Fecha de ingreso',
  admissionTime: 'Hora de ingreso',
  bedMode: 'Tipo de cupo',
  devices: 'Dispositivos',
  deviceDetails: 'Detalle dispositivos',
  clinicalEvents: 'Eventos clinicos',
  handoffNoteDayShift: 'Nota entrega dia',
  handoffNoteNightShift: 'Nota entrega noche',
  medicalHandoffNote: 'Nota medica',
  isUPC: 'UPC',
  upcChecklist: 'Checklist UPC',
  surgicalComplication: 'Complicacion quirurgica',
  isBlocked: 'Bloqueo de cama',
  blockedReason: 'Motivo de bloqueo',
};

const toContextString = (
  context: Record<string, unknown> | undefined,
  key: string
): string | undefined => {
  const value = context?.[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
};

const truncateText = (value: string, maxLength = 180): string =>
  value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;

const toPathname = (url: string | undefined): string | undefined => {
  if (!url) return undefined;
  try {
    return new URL(url).pathname;
  } catch {
    return url.startsWith('/') ? url : undefined;
  }
};

const inferModuleFromPathname = (pathname: string | undefined): string | undefined => {
  if (!pathname) return undefined;
  if (pathname.includes('censo') || pathname.includes('census')) return 'Censo diario';
  if (pathname.includes('handoff') || pathname.includes('entrega')) return 'Entrega turno';
  if (pathname.includes('transfer') || pathname.includes('traslado')) return 'Gestion traslados';
  if (pathname.includes('audit')) return 'Auditoria clinica';
  if (pathname.includes('diagnostics') || pathname.includes('observabilidad'))
    return 'Observabilidad';
  return undefined;
};

const mapErrorSeverity = (severity: ErrorLog['severity']): UserHealthRecentEvent['severity'] =>
  severity === 'critical' || severity === 'high' ? 'critical' : 'warning';

const mapTelemetrySeverity = (
  event: OperationalTelemetryEvent
): UserHealthRecentEvent['severity'] => {
  if (event.status === 'failed' || event.runtimeState === 'blocked') return 'critical';
  if (event.status === 'partial' || event.status === 'degraded') return 'warning';
  return 'info';
};

const mapTelemetryStatus = (event: OperationalTelemetryEvent): UserHealthRecentEvent['status'] =>
  event.runtimeState === 'recoverable' || event.status === 'partial' ? 'recovered' : 'open';

const buildContextSummary = (context: Record<string, unknown> | undefined): string[] => {
  if (!context) return [];
  return Object.entries(context)
    .filter(([key, value]) => {
      const normalizedKey = key.toLowerCase();
      return (
        !PRIVATE_CONTEXT_KEYS.has(normalizedKey) &&
        CONTEXT_KEYS.includes(normalizedKey) &&
        typeof value === 'string' &&
        value.trim().length > 0
      );
    })
    .sort(
      ([leftKey], [rightKey]) =>
        (CONTEXT_SUMMARY_PRIORITY.get(leftKey.toLowerCase()) ?? CONTEXT_KEYS.length) -
        (CONTEXT_SUMMARY_PRIORITY.get(rightKey.toLowerCase()) ?? CONTEXT_KEYS.length)
    )
    .map(([key, value]) => {
      const normalizedKey = key.toLowerCase();
      return `${CONTEXT_SUMMARY_LABELS[normalizedKey] || key}: ${String(value).trim()}`;
    })
    .slice(0, 4);
};

const toIsoTimestamp = (value: number | undefined): string => {
  const date = new Date(value || Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

const buildSyncOperationModule = (operation: SyncQueueOperationSnapshot): string => {
  const contextLabels = Array.from(
    new Set((operation.contexts || []).map(context => SYNC_CONTEXT_LABELS[context] || context))
  ).filter(Boolean);

  if (contextLabels.length > 0) return contextLabels.join(' / ');
  return operation.type === 'UPDATE_DAILY_RECORD' ? 'Censo diario' : 'Paciente';
};

const buildSyncOperationMessage = (operation: SyncQueueOperationSnapshot): string => {
  if (operation.status === 'CONFLICT') return `${operation.type} con conflicto en cola local`;
  if (operation.status === 'FAILED') return `${operation.type} fallida en cola local`;
  return `${operation.type} pendiente en cola local`;
};

const buildSyncOperationSeverity = (
  operation: SyncQueueOperationSnapshot
): UserHealthRecentEvent['severity'] => {
  if (operation.status === 'FAILED' || operation.status === 'CONFLICT') return 'critical';
  if (operation.lastErrorSeverity === 'critical' || operation.lastErrorSeverity === 'high') {
    return 'critical';
  }
  return 'warning';
};

const buildSyncOperationIssue = (operation: SyncQueueOperationSnapshot): string | undefined => {
  if (operation.lastErrorCategory && operation.lastErrorCode) {
    return `${operation.lastErrorCategory}: ${operation.lastErrorCode}`;
  }
  return operation.error;
};

const getClinicalDateFromSyncKey = (key: string | undefined): string | undefined => {
  const match = /^daily:(\d{4}-\d{2}-\d{2})$/.exec(key || '');
  return match?.[1];
};

const getFieldLabelFromPath = (fieldPath: string | undefined): string | undefined => {
  if (!fieldPath) return undefined;
  const [fieldKey] = fieldPath.split('.');
  return SYNC_FIELD_LABELS[fieldKey] || fieldKey;
};

const buildSyncOperationClinicalContextSummary = (
  operation: SyncQueueOperationSnapshot
): string[] => {
  const changedPath = operation.syncContract?.changedPaths?.find(path =>
    /^beds\.[^.]+(?:\.|$)/.test(path)
  );
  if (!changedPath) return [];

  const [, bedId, ...fieldParts] = changedPath.split('.');
  const fieldKey = fieldParts.join('.');
  return [
    getClinicalDateFromSyncKey(operation.key)
      ? `fecha clinica: ${getClinicalDateFromSyncKey(operation.key)}`
      : '',
    bedId ? `cama: Cama ${bedId}` : '',
    fieldKey ? `campo: ${getFieldLabelFromPath(fieldKey)}` : 'campo: Cama completa',
    `tipo: ${operation.type}`,
  ].filter(Boolean);
};

const buildSyncOperationHealthEvents = (
  operations: SyncQueueOperationSnapshot[] | undefined
): UserHealthRecentEvent[] =>
  (operations || [])
    .filter(operation => operation.status === 'FAILED' || operation.status === 'CONFLICT')
    .map(operation => {
      const issue = buildSyncOperationIssue(operation);
      const clinicalContextSummary = buildSyncOperationClinicalContextSummary(operation);
      return {
        id: `sync_queue:${operation.id || `${operation.type}:${operation.timestamp}`}`,
        source: 'operational',
        category: 'sync',
        severity: buildSyncOperationSeverity(operation),
        status: 'open',
        timestamp: toIsoTimestamp(operation.lastErrorAt || operation.timestamp),
        message: buildSyncOperationMessage(operation),
        operation: operation.origin || operation.recoveryPolicy || operation.type,
        module: buildSyncOperationModule(operation),
        action: operation.lastErrorAction || 'Revisar cola local y reintentar sincronizacion.',
        route: operation.key || 'Cola local del usuario',
        runtimeState: operation.status === 'CONFLICT' ? 'blocked' : undefined,
        telemetryStatus: operation.status === 'FAILED' ? 'failed' : 'degraded',
        issues: issue ? [truncateText(issue)] : [],
        contextSummary:
          clinicalContextSummary.length > 0
            ? clinicalContextSummary
            : [
                `estado: ${operation.status}`,
                `reintentos: ${operation.retryCount}`,
                operation.recoveryPolicy ? `politica: ${operation.recoveryPolicy}` : '',
                operation.contexts?.length ? `contextos: ${operation.contexts.join(', ')}` : '',
              ].filter(Boolean),
      };
    });

const getModuleFromContext = (context: Record<string, unknown> | undefined): string | undefined =>
  toContextString(context, 'module') ||
  toContextString(context, 'section') ||
  toContextString(context, 'screen') ||
  toContextString(context, 'feature') ||
  toContextString(context, 'component');

const getActionFromContext = (context: Record<string, unknown> | undefined): string | undefined =>
  toContextString(context, 'action') || toContextString(context, 'button');

const getOperationFromContext = (
  context: Record<string, unknown> | undefined
): string | undefined => toContextString(context, 'operation') || toContextString(context, 'event');

export const buildRecentUserHealthEvents = ({
  localErrors,
  operationalEvents,
  recentSyncOperations,
  maxEvents = 12,
}: BuildRecentUserHealthEventsOptions): UserHealthRecentEvent[] => {
  const localErrorEvents: UserHealthRecentEvent[] = localErrors.map(error => {
    const route = toPathname(error.url);
    return {
      id: `local_error:${error.id}`,
      source: 'local_error',
      category: 'local_error',
      severity: mapErrorSeverity(error.severity),
      status: 'open',
      timestamp: error.timestamp,
      message: truncateText(error.message),
      operation: getOperationFromContext(error.context),
      module: getModuleFromContext(error.context) || inferModuleFromPathname(route),
      action: getActionFromContext(error.context),
      route,
      contextSummary: buildContextSummary(error.context),
    };
  });

  const operationalHealthEvents: UserHealthRecentEvent[] = operationalEvents
    .filter(event => event.status !== 'success')
    .map(event => ({
      id: `operational:${event.category}:${event.operation}:${event.timestamp}`,
      source: 'operational',
      category: event.category,
      severity: mapTelemetrySeverity(event),
      status: mapTelemetryStatus(event),
      timestamp: event.timestamp,
      message: truncateText(event.issues?.[0] || event.operation),
      operation: event.operation,
      module: getModuleFromContext(event.context),
      action: getActionFromContext(event.context),
      route: toContextString(event.context, 'route'),
      runtimeState: event.runtimeState,
      telemetryStatus: event.status,
      issues: event.issues?.slice(0, 3),
      contextSummary: buildContextSummary(event.context),
    }));

  const syncQueueEvents = buildSyncOperationHealthEvents(recentSyncOperations);

  return [...localErrorEvents, ...operationalHealthEvents, ...syncQueueEvents]
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, maxEvents);
};

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
  syncOrphanedTasks: options.syncTelemetry.orphanedTasks || 0,
  oldestPendingAgeMs: options.syncTelemetry.oldestPendingAgeMs,
  remoteSyncReason: options.remoteSyncReason,
  versionUpdateReason: options.versionUpdateReason,
  localErrorCount: options.localErrorCount,
  degradedLocalPersistence: options.degradedLocalPersistence,
  repositoryWarningCount: options.repositoryPerformance.warningCount,
  slowestRepositoryOperationMs: options.repositoryPerformance.slowestOperationMs,
  operationalObservedCount: options.operationalTelemetry.recentObservedCount,
  operationalFailureCount: options.operationalTelemetry.recentFailedCount,
  operationalRetryableCount: options.operationalTelemetry.recentRetryableCount,
  operationalRecoverableCount: options.operationalTelemetry.recentRecoverableCount,
  operationalDegradedCount: options.operationalTelemetry.recentDegradedCount,
  operationalBlockedCount: options.operationalTelemetry.recentBlockedCount,
  operationalUnauthorizedCount: options.operationalTelemetry.recentUnauthorizedCount,
  operationalLastHourObservedCount: options.operationalTelemetry.lastHourObservedCount,
  operationalSyncObservedCount: options.operationalTelemetry.syncObservedCount,
  operationalIndexedDbObservedCount: options.operationalTelemetry.indexedDbObservedCount,
  operationalClinicalDocumentObservedCount:
    options.operationalTelemetry.clinicalDocumentObservedCount,
  operationalCreateDayObservedCount: options.operationalTelemetry.createDayObservedCount,
  operationalHandoffObservedCount: options.operationalTelemetry.handoffObservedCount,
  operationalExportBackupObservedCount: options.operationalTelemetry.exportOrBackupObservedCount,
  operationalDailyRecordRecoveredRealtimeNullCount:
    options.operationalTelemetry.dailyRecordRecoveredRealtimeNullCount,
  operationalDailyRecordConfirmedRealtimeNullCount:
    options.operationalTelemetry.dailyRecordConfirmedRealtimeNullCount,
  operationalSyncReadUnavailableCount: options.operationalTelemetry.syncReadUnavailableCount,
  operationalIndexedDbFallbackModeCount: options.operationalTelemetry.indexedDbFallbackModeCount,
  operationalAuthBootstrapTimeoutCount: options.operationalTelemetry.authBootstrapTimeoutCount,
  operationalTopObservedCategory: options.operationalTelemetry.topObservedCategory,
  operationalTopObservedOperation: options.operationalTelemetry.topObservedOperation,
  latestOperationalOperation: options.operationalTelemetry.latestObservedOperation,
  latestOperationalRuntimeState: options.operationalTelemetry.latestRuntimeState,
  latestOperationalIssueAt: options.operationalTelemetry.latestIssueAt,
  recentEvents: options.recentEvents || [],
  appVersion: buildSystemHealthAppVersion(options.syncTelemetry.batchSize),
  platform: options.platform,
  userAgent: options.userAgent,
});
