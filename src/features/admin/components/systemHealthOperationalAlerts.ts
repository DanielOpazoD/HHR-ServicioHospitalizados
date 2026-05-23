import { evaluateSystemHealthState } from '@/features/admin/components/systemHealthStatusPolicy';
import type { UserHealthStatus } from '@/services/admin/healthService';
import {
  DEFAULT_SYSTEM_HEALTH_THRESHOLDS,
  PROLONGED_OFFLINE_USER_AGE_MS,
  SYSTEM_HEALTH_ALERT_SLA_MINUTES,
} from '@/services/admin/systemHealthOperationalBudgets';

export type OperationalAlertSeverity = 'warning' | 'critical';

export interface OperationalAlert {
  key: string;
  title: string;
  description: string;
  severity: OperationalAlertSeverity;
  recommendedAction: string;
  slaMinutes: number;
  affectedUsers: string[];
  affectedCount: number;
}

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

const uniqueEmails = (users: UserHealthStatus[]): string[] =>
  Array.from(new Set(users.map(user => user.email).filter(Boolean)));

const byHealthLevel = (statuses: UserHealthStatus[]): UserHealthStatus[] =>
  statuses.filter(status => evaluateSystemHealthState(status).level === 'critical');

export const buildOperationalAlerts = (
  statuses: UserHealthStatus[],
  nowMs: number = Date.now()
): OperationalAlert[] => {
  if (statuses.length === 0) return [];

  const criticalUsers = byHealthLevel(statuses);
  const warningUsers = statuses.filter(
    status => evaluateSystemHealthState(status).level === 'warning'
  );
  const failedSyncUsers = statuses.filter(status => status.failedSyncTasks > 0);
  const conflictUsers = statuses.filter(status => (status.conflictSyncTasks || 0) > 0);
  const staleQueueUsers = statuses.filter(
    status =>
      (status.oldestPendingAgeMs || 0) >=
      DEFAULT_SYSTEM_HEALTH_THRESHOLDS.criticalOldestPendingAgeMs
  );
  const recoveredNullRealtimeUsers = statuses.filter(
    status => (status.operationalDailyRecordRecoveredRealtimeNullCount || 0) > 0
  );
  const syncReadUnavailableUsers = statuses.filter(
    status => (status.operationalSyncReadUnavailableCount || 0) > 0
  );
  const syncOwnershipDriftUsers = statuses.filter(status => (status.syncOrphanedTasks || 0) > 0);
  const runtimeContractMismatchUsers = statuses.filter(
    status => status.versionUpdateReason === 'runtime_contract_mismatch'
  );
  const schemaAheadUsers = statuses.filter(
    status => status.versionUpdateReason === 'schema_ahead_of_client'
  );
  const indexedDbFallbackUsers = statuses.filter(
    status => (status.operationalIndexedDbFallbackModeCount || 0) > 0
  );
  const authBootstrapTimeoutUsers = statuses.filter(
    status => (status.operationalAuthBootstrapTimeoutCount || 0) > 0
  );
  const prolongedOfflineUsers = statuses.filter(status => {
    if (status.isOnline) return false;
    const ageMs = nowMs - new Date(status.lastSeen).getTime();
    return Number.isFinite(ageMs) && ageMs >= PROLONGED_OFFLINE_USER_AGE_MS;
  });

  const alerts: OperationalAlert[] = [];

  if (criticalUsers.length > 0) {
    alerts.push({
      key: 'critical-users',
      title: 'Usuarios en estado critico',
      description: 'Hay usuarios con riesgo alto de perdida de sincronizacion.',
      severity: 'critical',
      recommendedAction:
        'Contactar al usuario y ejecutar limpieza local + reintento de sincronizacion en menos de 10 minutos.',
      slaMinutes: SYSTEM_HEALTH_ALERT_SLA_MINUTES.criticalUsers,
      affectedUsers: uniqueEmails(criticalUsers),
      affectedCount: criticalUsers.length,
    });
  }

  if (failedSyncUsers.length > 0) {
    alerts.push({
      key: 'failed-sync',
      title: 'Sincronizaciones fallidas',
      description: 'Existen tareas fallidas que requieren revision de permisos o red.',
      severity: 'critical',
      recommendedAction:
        'Verificar permisos Firestore/Storage y reintentar cola. Si persiste, escalar a soporte tecnico.',
      slaMinutes: SYSTEM_HEALTH_ALERT_SLA_MINUTES.failedSync,
      affectedUsers: uniqueEmails(failedSyncUsers),
      affectedCount: failedSyncUsers.length,
    });
  }

  if (conflictUsers.length > 0) {
    alerts.push({
      key: 'sync-conflicts',
      title: 'Conflictos de sincronizacion',
      description: 'Se detectaron conflictos pendientes de resolucion o reintento.',
      severity: 'critical',
      recommendedAction:
        'Revisar panel de conflictos, confirmar merge sugerido y reintentar sincronizacion inmediatamente.',
      slaMinutes: SYSTEM_HEALTH_ALERT_SLA_MINUTES.syncConflicts,
      affectedUsers: uniqueEmails(conflictUsers),
      affectedCount: conflictUsers.length,
    });
  }

  if (staleQueueUsers.length > 0) {
    alerts.push({
      key: 'stale-queue',
      title: 'Cola atascada (>= 15 min)',
      description: 'La cola de outbox mantiene antiguedad critica.',
      severity: 'warning',
      recommendedAction:
        'Solicitar reintento de cola y validar conectividad de red del equipo afectado.',
      slaMinutes: SYSTEM_HEALTH_ALERT_SLA_MINUTES.staleQueue,
      affectedUsers: uniqueEmails(staleQueueUsers),
      affectedCount: staleQueueUsers.length,
    });
  }

  if (syncReadUnavailableUsers.length > 0) {
    alerts.push({
      key: 'sync-runtime-unavailable',
      title: 'Lectura de cola no disponible',
      description: 'Hay clientes donde la telemetría de sync quedó ilegible o bloqueada.',
      severity: 'critical',
      recommendedAction:
        'Validar IndexedDB/cola local en el equipo afectado y revisar conectividad antes de continuar usando el censo.',
      slaMinutes: SYSTEM_HEALTH_ALERT_SLA_MINUTES.failedSync,
      affectedUsers: uniqueEmails(syncReadUnavailableUsers),
      affectedCount: syncReadUnavailableUsers.length,
    });
  }

  if (syncOwnershipDriftUsers.length > 0) {
    alerts.push({
      key: 'sync-ownership-drift',
      title: 'Outbox heredado entre sesiones',
      description: 'Hay clientes con tareas pendientes que no pertenecen a la sesión actual.',
      severity: 'critical',
      recommendedAction:
        'Forzar logout manual y validar limpieza local antes de permitir que otro usuario continúe trabajando.',
      slaMinutes: SYSTEM_HEALTH_ALERT_SLA_MINUTES.failedSync,
      affectedUsers: uniqueEmails(syncOwnershipDriftUsers),
      affectedCount: syncOwnershipDriftUsers.length,
    });
  }

  if (runtimeContractMismatchUsers.length > 0) {
    alerts.push({
      key: 'runtime-contract-mismatch',
      title: 'Contrato runtime incompatible',
      description: 'Hay clientes con frontend/backend fuera de contrato compatible.',
      severity: 'critical',
      recommendedAction:
        'Solicitar recarga inmediata y confirmar que el usuario ya esté en el deploy vigente antes de continuar.',
      slaMinutes: SYSTEM_HEALTH_ALERT_SLA_MINUTES.failedSync,
      affectedUsers: uniqueEmails(runtimeContractMismatchUsers),
      affectedCount: runtimeContractMismatchUsers.length,
    });
  }

  if (schemaAheadUsers.length > 0) {
    alerts.push({
      key: 'schema-ahead-client',
      title: 'Schema remoto por delante del cliente',
      description: 'Hay clientes viejos que podrían quedar bloqueados para evitar corrupción.',
      severity: 'critical',
      recommendedAction:
        'Actualizar el cliente inmediatamente. No continuar operando hasta confirmar recarga del deploy vigente.',
      slaMinutes: SYSTEM_HEALTH_ALERT_SLA_MINUTES.failedSync,
      affectedUsers: uniqueEmails(schemaAheadUsers),
      affectedCount: schemaAheadUsers.length,
    });
  }

  if (indexedDbFallbackUsers.length > 0) {
    alerts.push({
      key: 'indexeddb-fallback',
      title: 'Fallback local activado',
      description: 'Clientes degradaron a modo fallback por problemas en IndexedDB.',
      severity: 'warning',
      recommendedAction:
        'Solicitar recarga controlada del navegador y revisar si IndexedDB puede reabrirse sin perder cambios pendientes.',
      slaMinutes: SYSTEM_HEALTH_ALERT_SLA_MINUTES.warningUsers,
      affectedUsers: uniqueEmails(indexedDbFallbackUsers),
      affectedCount: indexedDbFallbackUsers.length,
    });
  }

  if (authBootstrapTimeoutUsers.length > 0) {
    alerts.push({
      key: 'auth-bootstrap-timeout',
      title: 'Bootstrap auth prolongado',
      description: 'Se observaron timeouts de inicio de sesión que degradan el arranque.',
      severity: 'warning',
      recommendedAction:
        'Revisar conectividad/auth bootstrap del usuario y confirmar si el inicio de sesión termina recuperándose o requiere reintento.',
      slaMinutes: SYSTEM_HEALTH_ALERT_SLA_MINUTES.warningUsers,
      affectedUsers: uniqueEmails(authBootstrapTimeoutUsers),
      affectedCount: authBootstrapTimeoutUsers.length,
    });
  }

  if (recoveredNullRealtimeUsers.length > 0) {
    alerts.push({
      key: 'daily-record-null-recovered',
      title: 'Registro diario recuperado desde null realtime',
      description:
        'Se detectaron vaciados transitorios del registro diario que el cliente logró reparar.',
      severity: 'warning',
      recommendedAction:
        'Monitorear si el usuario vuelve a ver el día actual vacío y revisar suscripción realtime/local cache si el patrón se repite.',
      slaMinutes: SYSTEM_HEALTH_ALERT_SLA_MINUTES.warningUsers,
      affectedUsers: uniqueEmails(recoveredNullRealtimeUsers),
      affectedCount: recoveredNullRealtimeUsers.length,
    });
  }

  if (prolongedOfflineUsers.length > 0) {
    alerts.push({
      key: 'offline-users',
      title: 'Usuarios offline prolongados',
      description: 'Usuarios sin conexion por mas de 15 minutos con sesion activa reciente.',
      severity: 'warning',
      recommendedAction:
        'Validar conectividad local y confirmar que no existan cambios pendientes antes de cerrar sesion.',
      slaMinutes: SYSTEM_HEALTH_ALERT_SLA_MINUTES.offlineUsers,
      affectedUsers: uniqueEmails(prolongedOfflineUsers),
      affectedCount: prolongedOfflineUsers.length,
    });
  }

  if (alerts.length === 0 && warningUsers.length > 0) {
    alerts.push({
      key: 'warning-users',
      title: 'Usuarios en advertencia',
      description: 'Hay degradacion leve en sincronizacion que requiere monitoreo.',
      severity: 'warning',
      recommendedAction:
        'Monitorear evolucion y escalar si la alerta permanece por mas de 30 minutos.',
      slaMinutes: SYSTEM_HEALTH_ALERT_SLA_MINUTES.warningUsers,
      affectedUsers: uniqueEmails(warningUsers),
      affectedCount: warningUsers.length,
    });
  }

  return alerts.sort((a, b) => {
    if (a.severity !== b.severity) {
      return a.severity === 'critical' ? -1 : 1;
    }
    return b.affectedCount - a.affectedCount;
  });
};

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

export const buildOperationalAlertFingerprint = (alert: OperationalAlert): string =>
  JSON.stringify({
    key: alert.key,
    severity: alert.severity,
    affectedUsers: [...alert.affectedUsers].sort(),
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
