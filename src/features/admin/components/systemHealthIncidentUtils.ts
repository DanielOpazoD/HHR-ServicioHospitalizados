import { evaluateSystemHealthState } from './systemHealthStatusPolicy';
import type {
  SystemHealthIncidentResolution,
  SystemHealthIncidentResolutionHistoryEntry,
  SystemHealthIncidentResolutionState,
  UserHealthEventSeverity,
  UserHealthRecentEvent,
  UserHealthStatus,
} from '@/services/admin/healthService';

export type SystemHealthDateRange = 'all' | 'day' | 'last24h' | 'last7d';
export type SystemHealthSeverityFilter = 'all' | UserHealthEventSeverity | 'healthy';
export type SystemHealthEventTypeFilter =
  | 'all'
  | 'sync'
  | 'local_error'
  | 'operational'
  | 'sync_conflict';

export interface SystemHealthTriageFilters {
  searchTerm: string;
  dateRange: SystemHealthDateRange;
  severity: SystemHealthSeverityFilter;
  eventType: SystemHealthEventTypeFilter;
  selectedDate?: string;
  nowMs?: number;
}

export interface SystemHealthIncidentRow {
  id: string;
  resolutionKey: string;
  title: string;
  timestamp: string;
  source: UserHealthRecentEvent['source'];
  category: UserHealthRecentEvent['category'];
  sourceLabel: string;
  categoryLabel: string;
  severity: UserHealthEventSeverity;
  status: UserHealthRecentEvent['status'];
  statusLabel: string;
  originLabel: string;
  actionLabel: string;
  routeLabel: string;
  userLabel: string;
  userUid: string;
  userEmail: string;
  resolvedAt?: string;
  resolvedByName?: string;
  resolutionNote?: string;
  resolutionHistory?: SystemHealthIncidentResolutionHistoryEntry[];
  details: string[];
}

export interface SystemHealthIncidentQueueRow extends SystemHealthIncidentRow {
  healthLevel: 'healthy' | 'warning' | 'critical';
}

export interface SystemHealthIncidentGroup {
  id: string;
  title: string;
  categoryLabel: string;
  originLabel: string;
  actionLabel: string;
  routeLabel: string;
  severity: UserHealthEventSeverity;
  status: UserHealthRecentEvent['status'] | 'recurrent';
  statusLabel: string;
  occurrenceCount: number;
  affectedUsers: number;
  firstSeenAt: string;
  lastSeenAt: string;
  userLabels: string[];
}

export interface SystemHealthIncidentTimelineDay {
  date: string;
  totalIncidents: number;
  criticalIncidents: number;
  warningIncidents: number;
  affectedUsers: number;
  firstSeenAt: string;
  lastSeenAt: string;
  durationMinutes: number;
}

export interface SystemHealthTriageTotals {
  totalIncidents: number;
  criticalIncidents: number;
  warningIncidents: number;
  affectedUsers: number;
  openIncidents: number;
  recoveredIncidents: number;
  resolvedIncidents: number;
}

export interface SystemHealthUserTriage {
  user: UserHealthStatus;
  healthLevel: 'healthy' | 'warning' | 'critical';
  incidents: SystemHealthIncidentRow[];
  latestIncidentAt?: string;
  criticalCount: number;
  warningCount: number;
}

export interface SystemHealthTriageModel {
  filteredUsers: UserHealthStatus[];
  selectedUser?: UserHealthStatus;
  selectedIncidents: SystemHealthIncidentRow[];
  userTriage: SystemHealthUserTriage[];
  incidentQueue: SystemHealthIncidentQueueRow[];
  incidentGroups: SystemHealthIncidentGroup[];
  timeline: SystemHealthIncidentTimelineDay[];
  totals: SystemHealthTriageTotals;
}

const CATEGORY_LABELS: Record<string, string> = {
  auth: 'Auth',
  daily_record: 'Censo diario',
  firestore: 'Firestore',
  sync: 'Sync',
  indexeddb: 'IndexedDB',
  integration: 'Integracion',
  export: 'Exportacion',
  backup: 'Backup',
  reminders: 'Recordatorios',
  transfers: 'Traslados',
  clinical_document: 'Documento clinico',
  create_day: 'Crear dia',
  handoff: 'Entrega turno',
  prescription: 'Recetas',
  local_error: 'Error local',
  sync_conflict: 'Conflicto',
  health_snapshot: 'Estado',
};

const SOURCE_LABELS: Record<string, string> = {
  local_error: 'Error local',
  operational: 'Operacional',
  sync_conflict: 'Conflicto',
  health_snapshot: 'Estado',
};

const STATUS_LABELS: Record<string, string> = {
  open: 'Abierto',
  recovered: 'Recuperado',
  resolved: 'Resuelto',
};

const toMs = (timestamp: string | undefined): number => {
  const value = Date.parse(timestamp || '');
  return Number.isFinite(value) ? value : 0;
};

const isWithinDateRange = (
  timestamp: string | undefined,
  dateRange: SystemHealthDateRange,
  selectedDate: string | undefined,
  nowMs: number
): boolean => {
  if (dateRange === 'all') return true;
  if (dateRange === 'day') {
    return !!selectedDate && !!timestamp && timestamp.slice(0, 10) === selectedDate;
  }
  const eventMs = toMs(timestamp);
  if (eventMs <= 0) return false;
  const maxAgeMs = dateRange === 'last24h' ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  return nowMs - eventMs <= maxAgeMs;
};

const labelFor = (labels: Record<string, string>, value: string | undefined, fallback: string) =>
  value ? labels[value] || value : fallback;

const buildOriginLabel = (event: UserHealthRecentEvent): string => {
  if (event.module && event.operation) return `${event.module} / ${event.operation}`;
  return event.module || event.operation || labelFor(CATEGORY_LABELS, event.category, 'Sin origen');
};

const buildSyntheticEvent = (
  user: UserHealthStatus,
  id: string,
  message: string,
  category: UserHealthRecentEvent['category'],
  severity: UserHealthEventSeverity,
  timestamp: string,
  metadata: Pick<UserHealthRecentEvent, 'module' | 'operation' | 'action' | 'route'> = {}
): UserHealthRecentEvent => ({
  id: `${user.uid}:${id}`,
  source: category === 'sync_conflict' ? 'sync_conflict' : 'health_snapshot',
  category,
  severity,
  status: 'open',
  timestamp,
  message,
  ...metadata,
});

const buildSyntheticHealthEvents = (user: UserHealthStatus): UserHealthRecentEvent[] => {
  const events: UserHealthRecentEvent[] = [];
  const knownEventTimestamp = user.recentEvents?.[0]?.timestamp;
  const syntheticTimestamp = user.latestOperationalIssueAt || knownEventTimestamp || user.lastSeen;

  if ((user.conflictSyncTasks || 0) > 0) {
    events.push(
      buildSyntheticEvent(
        user,
        'sync-conflicts',
        `${user.conflictSyncTasks} conflicto(s) de sincronizacion pendientes`,
        'sync_conflict',
        'critical',
        syntheticTimestamp,
        {
          module: 'Sincronizacion local',
          operation: 'outbox',
          action: 'Resolver conflicto pendiente',
          route: 'Modulo donde se genero la cola local',
        }
      )
    );
  }

  if (user.failedSyncTasks > 0) {
    events.push(
      buildSyntheticEvent(
        user,
        'failed-sync',
        `${user.failedSyncTasks} sincronizacion(es) fallidas`,
        'sync',
        'critical',
        syntheticTimestamp,
        {
          module: 'Sincronizacion local',
          operation:
            user.latestOperationalOperation || user.operationalTopObservedOperation || 'outbox',
          action: 'Reintentar sincronizacion',
          route: 'Cola local del usuario',
        }
      )
    );
  }

  if (
    user.localErrorCount > 0 &&
    !(user.recentEvents || []).some(event => event.source === 'local_error')
  ) {
    events.push(
      buildSyntheticEvent(
        user,
        'local-errors',
        `${user.localErrorCount} error(es) locales acumulados`,
        'local_error',
        user.localErrorCount >= 10 ? 'critical' : 'warning',
        syntheticTimestamp,
        {
          module: 'Navegador del usuario',
          operation: 'error_local_acumulado',
          action: 'Revisar consola/telemetria local',
          route: 'Sesion del usuario',
        }
      )
    );
  }

  return events;
};

export const buildSystemHealthIncidentRows = (user: UserHealthStatus): SystemHealthIncidentRow[] =>
  [...(user.recentEvents || []), ...buildSyntheticHealthEvents(user)]
    .sort((a, b) => toMs(b.timestamp) - toMs(a.timestamp))
    .map(event => ({
      id: event.id,
      resolutionKey: `${user.uid}:${event.id}`,
      title: event.message,
      timestamp: event.timestamp,
      source: event.source,
      category: event.category,
      sourceLabel: labelFor(SOURCE_LABELS, event.source, 'Evento'),
      categoryLabel: labelFor(CATEGORY_LABELS, event.category, 'Evento'),
      severity: event.severity,
      status: event.status,
      statusLabel: labelFor(STATUS_LABELS, event.status, 'Abierto'),
      originLabel: buildOriginLabel(event),
      actionLabel: event.action || 'Sin accion registrada',
      routeLabel: event.route || 'Sin ruta registrada',
      userLabel: user.displayName || user.email,
      userUid: user.uid,
      userEmail: user.email,
      details: [
        event.runtimeState ? `runtime: ${event.runtimeState}` : '',
        event.telemetryStatus ? `telemetria: ${event.telemetryStatus}` : '',
        ...(event.issues || []),
        ...(event.contextSummary || []),
      ].filter(Boolean),
    }));

const userMatchesSearch = (user: UserHealthStatus, searchTerm: string): boolean => {
  const normalized = searchTerm.trim().toLowerCase();
  if (!normalized) return true;
  return [user.displayName, user.email, user.uid].some(value =>
    String(value || '')
      .toLowerCase()
      .includes(normalized)
  );
};

const userMatchesSeverity = (
  user: UserHealthStatus,
  rows: SystemHealthIncidentRow[],
  severity: SystemHealthSeverityFilter
): boolean => {
  if (severity === 'all') return true;
  if (severity === 'healthy') return evaluateSystemHealthState(user).level === 'healthy';
  return rows.some(row => row.severity === severity);
};

const userMatchesEventType = (
  rows: SystemHealthIncidentRow[],
  eventType: SystemHealthEventTypeFilter
): boolean => {
  if (eventType === 'all') return true;
  if (eventType === 'operational') {
    return rows.some(row => row.source === 'operational');
  }
  return rows.some(row => row.category === eventType);
};

export const filterSystemHealthStatsForTriage = (
  stats: UserHealthStatus[],
  filters: SystemHealthTriageFilters
): UserHealthStatus[] => {
  const nowMs = filters.nowMs || Date.now();

  return stats.filter(user => {
    const rows = buildSystemHealthIncidentRows(user);
    const relevantTimestamp = rows[0]?.timestamp || user.latestOperationalIssueAt || user.lastSeen;
    return (
      userMatchesSearch(user, filters.searchTerm) &&
      isWithinDateRange(relevantTimestamp, filters.dateRange, filters.selectedDate, nowMs) &&
      userMatchesSeverity(user, rows, filters.severity) &&
      userMatchesEventType(rows, filters.eventType)
    );
  });
};

const severityRank = (severity: UserHealthEventSeverity): number => {
  if (severity === 'critical') return 0;
  if (severity === 'warning') return 1;
  return 2;
};

const statusRank = (status: UserHealthRecentEvent['status']): number => {
  if (status === 'open') return 0;
  if (status === 'recovered') return 1;
  return 2;
};

const buildIncidentCauseKey = (incident: SystemHealthIncidentRow): string =>
  [
    incident.category,
    incident.originLabel,
    incident.actionLabel,
    incident.routeLabel,
    incident.title.trim().toLowerCase(),
  ].join('|');

export const buildSystemHealthIncidentGroups = (
  incidents: SystemHealthIncidentQueueRow[]
): SystemHealthIncidentGroup[] => {
  const groups = new Map<string, SystemHealthIncidentQueueRow[]>();
  incidents.forEach(incident => {
    const key = buildIncidentCauseKey(incident);
    groups.set(key, [...(groups.get(key) || []), incident]);
  });

  return Array.from(groups.entries())
    .map(([id, groupIncidents]) => {
      const orderedByTime = [...groupIncidents].sort(
        (a, b) => toMs(a.timestamp) - toMs(b.timestamp)
      );
      const orderedBySeverity = [...groupIncidents].sort(
        (a, b) => severityRank(a.severity) - severityRank(b.severity)
      );
      const representative = orderedBySeverity[0];
      const userLabels = Array.from(new Set(groupIncidents.map(incident => incident.userLabel)));
      const hasOpen = groupIncidents.some(incident => incident.status === 'open');
      const allResolved = groupIncidents.every(incident => incident.status === 'resolved');
      const status: SystemHealthIncidentGroup['status'] =
        groupIncidents.length > 1 && hasOpen
          ? 'recurrent'
          : allResolved
            ? 'resolved'
            : representative.status;

      return {
        id,
        title: representative.title,
        categoryLabel: representative.categoryLabel,
        originLabel: representative.originLabel,
        actionLabel: representative.actionLabel,
        routeLabel: representative.routeLabel,
        severity: representative.severity,
        status,
        statusLabel:
          status === 'recurrent' ? 'Recurrente' : labelFor(STATUS_LABELS, status, 'Abierto'),
        occurrenceCount: groupIncidents.length,
        affectedUsers: userLabels.length,
        firstSeenAt: orderedByTime[0]?.timestamp || representative.timestamp,
        lastSeenAt: orderedByTime[orderedByTime.length - 1]?.timestamp || representative.timestamp,
        userLabels,
      };
    })
    .sort((a, b) => {
      const statusDelta =
        (a.status === 'recurrent' ? -1 : statusRank(a.status)) -
        (b.status === 'recurrent' ? -1 : statusRank(b.status));
      if (statusDelta !== 0) return statusDelta;
      const severityDelta = severityRank(a.severity) - severityRank(b.severity);
      if (severityDelta !== 0) return severityDelta;
      if (b.occurrenceCount !== a.occurrenceCount) return b.occurrenceCount - a.occurrenceCount;
      return toMs(b.lastSeenAt) - toMs(a.lastSeenAt);
    });
};

export const buildSystemHealthIncidentTimeline = (
  incidents: SystemHealthIncidentRow[]
): SystemHealthIncidentTimelineDay[] => {
  const groupedByDate = new Map<string, SystemHealthIncidentRow[]>();
  incidents.forEach(incident => {
    const date = incident.timestamp.slice(0, 10);
    if (!date) return;
    groupedByDate.set(date, [...(groupedByDate.get(date) || []), incident]);
  });

  return Array.from(groupedByDate.entries())
    .map(([date, dayIncidents]) => {
      const ordered = [...dayIncidents].sort((a, b) => toMs(a.timestamp) - toMs(b.timestamp));
      const firstSeenAt = ordered[0]?.timestamp || '';
      const lastSeenAt = ordered[ordered.length - 1]?.timestamp || firstSeenAt;
      const durationMs = Math.max(0, toMs(lastSeenAt) - toMs(firstSeenAt));

      return {
        date,
        totalIncidents: dayIncidents.length,
        criticalIncidents: dayIncidents.filter(incident => incident.severity === 'critical').length,
        warningIncidents: dayIncidents.filter(incident => incident.severity === 'warning').length,
        affectedUsers: new Set(dayIncidents.map(incident => incident.userUid)).size,
        firstSeenAt,
        lastSeenAt,
        durationMinutes: Math.round(durationMs / 60000),
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date));
};

const csvEscape = (value: unknown): string => {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
};

export const exportSystemHealthIncidentsCsv = (incidents: SystemHealthIncidentRow[]): string => {
  const header = [
    'fecha_hora',
    'usuario',
    'email',
    'severidad',
    'estado',
    'tipo',
    'origen',
    'accion',
    'ruta',
    'titulo',
    'detalles',
  ].join(',');
  const rows = incidents.map(incident =>
    [
      incident.timestamp,
      incident.userLabel,
      incident.userEmail,
      incident.severity,
      incident.statusLabel,
      incident.categoryLabel,
      incident.originLabel,
      incident.actionLabel,
      incident.routeLabel,
      incident.title,
      incident.details.join(' | '),
    ]
      .map(csvEscape)
      .join(',')
  );
  return [header, ...rows].join('\n');
};

export const buildSystemHealthTriageModel = (
  stats: UserHealthStatus[],
  {
    selectedUid,
    filters,
    resolutionState = {},
  }: {
    selectedUid: string | null;
    filters: SystemHealthTriageFilters;
    resolutionState?: SystemHealthIncidentResolutionState;
  }
): SystemHealthTriageModel => {
  const filteredUsers = filterSystemHealthStatsForTriage(stats, filters);
  const userTriage = filteredUsers.map(user => {
    const incidents = buildSystemHealthIncidentRows(user).map(incident =>
      resolveSystemHealthIncidentRow(incident, resolutionState[incident.resolutionKey])
    );
    return {
      user,
      healthLevel: evaluateSystemHealthState(user).level,
      incidents,
      latestIncidentAt: incidents[0]?.timestamp,
      criticalCount: incidents.filter(incident => incident.severity === 'critical').length,
      warningCount: incidents.filter(incident => incident.severity === 'warning').length,
    };
  });
  const selectedUser =
    filteredUsers.find(user => user.uid === selectedUid) || filteredUsers[0] || undefined;
  const selectedIncidents = selectedUser
    ? buildSystemHealthIncidentRows(selectedUser).map(incident =>
        resolveSystemHealthIncidentRow(incident, resolutionState[incident.resolutionKey])
      )
    : [];
  const incidentQueue = userTriage
    .flatMap(triage =>
      triage.incidents.map(incident => ({
        ...incident,
        healthLevel: triage.healthLevel,
      }))
    )
    .sort((a, b) => {
      const statusDelta = statusRank(a.status) - statusRank(b.status);
      if (statusDelta !== 0) return statusDelta;
      const severityDelta = severityRank(a.severity) - severityRank(b.severity);
      if (severityDelta !== 0) return severityDelta;
      return toMs(b.timestamp) - toMs(a.timestamp);
    });
  const incidentGroups = buildSystemHealthIncidentGroups(incidentQueue);
  const timeline = buildSystemHealthIncidentTimeline(incidentQueue);

  return {
    filteredUsers,
    selectedUser,
    selectedIncidents,
    userTriage,
    incidentQueue,
    incidentGroups,
    timeline,
    totals: {
      totalIncidents: incidentQueue.length,
      criticalIncidents: incidentQueue.filter(incident => incident.severity === 'critical').length,
      warningIncidents: incidentQueue.filter(incident => incident.severity === 'warning').length,
      affectedUsers: userTriage.filter(triage => triage.incidents.length > 0).length,
      openIncidents: incidentQueue.filter(incident => incident.status === 'open').length,
      recoveredIncidents: incidentQueue.filter(incident => incident.status === 'recovered').length,
      resolvedIncidents: incidentQueue.filter(incident => incident.status === 'resolved').length,
    },
  };
};

export const resolveSystemHealthIncidentRow = (
  row: SystemHealthIncidentRow,
  resolution?: SystemHealthIncidentResolution
): SystemHealthIncidentRow => {
  if (!resolution || resolution.status !== 'resolved') return row;
  return {
    ...row,
    status: 'resolved',
    statusLabel: 'Resuelto',
    resolvedAt: resolution.resolvedAt,
    resolvedByName: resolution.resolvedByName,
    resolutionNote: resolution.note,
    resolutionHistory: resolution.history,
    details: [
      ...row.details,
      resolution.resolvedAt ? `resuelto: ${resolution.resolvedAt}` : '',
      resolution.resolvedByName ? `por: ${resolution.resolvedByName}` : '',
      resolution.note ? `nota: ${resolution.note}` : '',
    ].filter(Boolean),
  };
};

export const shiftSystemHealthSelectedDate = (selectedDate: string, deltaDays: number): string => {
  const sourceDate = selectedDate ? new Date(`${selectedDate}T00:00:00.000Z`) : new Date();
  if (Number.isNaN(sourceDate.getTime())) return selectedDate;
  sourceDate.setUTCDate(sourceDate.getUTCDate() + deltaDays);
  return sourceDate.toISOString().slice(0, 10);
};
