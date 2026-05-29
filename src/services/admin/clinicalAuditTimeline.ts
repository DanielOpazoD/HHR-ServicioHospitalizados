import type { AuditLogEntry } from '@/types/auditLogTypes';
import { parseAuditTimestamp } from '@/services/admin/auditWorkerLogic';
import {
  buildClinicalAuditExportRows,
  type ClinicalAuditExportRow,
} from '@/services/admin/clinicalAuditExportRows';

export interface ClinicalAuditTimelineEvent extends ClinicalAuditExportRow {
  sourceLogId: string;
  title: string;
  sortTime: number;
}

export interface ClinicalAuditTimelineGroup {
  subjectKey: string;
  subjectLabel: string;
  subjectDetail: string;
  episodeId?: string;
  patientIdentifier: string;
  eventCount: number;
  originCoverageLabel: string;
  packageKindLabel: string;
  packageSummary: string;
  clinicalAreas: string[];
  latestTimestamp: string;
  events: ClinicalAuditTimelineEvent[];
}

const normalizeSubjectKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const asText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;

const resolveEpisodeId = (log: AuditLogEntry): string | undefined => {
  const details = log.details || {};
  const direct =
    asText(details.clinicalEpisodeId) || asText(details.episodeKey) || asText(details.episodeId);
  if (direct) return direct;

  const patient = asRecord(details.patient);
  return asText(patient?.clinicalEpisodeId) || asText(patient?.episodeKey) || undefined;
};

const resolveSubjectKey = (log: AuditLogEntry, row: ClinicalAuditExportRow): string => {
  const episodeId = resolveEpisodeId(log);
  if (episodeId) return `episode:${normalizeSubjectKey(episodeId)}`;
  if (row.patientIdentifier !== '-') return `patient:${normalizeSubjectKey(row.patientIdentifier)}`;
  if (row.affected) return `subject:${normalizeSubjectKey(row.affected)}`;
  return `entity:${normalizeSubjectKey(log.entityId || log.entityType)}`;
};

const resolveSubjectDetail = (
  log: AuditLogEntry,
  row: ClinicalAuditExportRow,
  episodeId?: string
): string => {
  const pieces = [
    episodeId ? `Episodio ${episodeId}` : '',
    row.patientIdentifier !== '-' ? `RUT/ID ${row.patientIdentifier}` : '',
    log.entityId ? `Registro ${log.entityId}` : '',
    row.clinicalArea ? `Área ${row.clinicalArea}` : '',
  ].filter(Boolean);

  return pieces.join(' · ') || 'Sin identificador adicional';
};

const resolveOriginCoverageLabel = (events: ClinicalAuditTimelineEvent[]): string => {
  if (events.length === 0) return '0% con IP';

  const withOrigin = events.filter(event => event.origin !== 'IP no disponible').length;
  return `${Math.round((withOrigin / events.length) * 100)}% con IP`;
};

const resolveClinicalAreas = (events: ClinicalAuditTimelineEvent[]): string[] =>
  [...new Set(events.map(event => event.clinicalArea).filter(Boolean))].sort();

const resolvePackageKindLabel = (group: Pick<ClinicalAuditTimelineGroup, 'episodeId'>): string =>
  group.episodeId ? 'Paquete por episodio' : 'Paquete por paciente';

const resolvePackageSummary = (
  events: ClinicalAuditTimelineEvent[],
  originCoverageLabel: string,
  clinicalAreas: string[]
): string =>
  `${events.length} evento${events.length === 1 ? '' : 's'} · ${originCoverageLabel} · Áreas: ${
    clinicalAreas.join(', ') || 'sin área'
  }`;

export const buildClinicalAuditTimelineGroups = (
  logs: AuditLogEntry[]
): ClinicalAuditTimelineGroup[] => {
  const rows = buildClinicalAuditExportRows(logs);
  const groups = new Map<string, ClinicalAuditTimelineGroup>();

  logs.forEach((log, index) => {
    const row = rows[index];
    const subjectKey = resolveSubjectKey(log, row);
    const episodeId = resolveEpisodeId(log);
    const sortTime = parseAuditTimestamp(log.timestamp).getTime();
    const event: ClinicalAuditTimelineEvent = {
      ...row,
      sourceLogId: log.id,
      title: row.eventTitle,
      sortTime,
    };

    const existing = groups.get(subjectKey);
    if (existing) {
      existing.events.push(event);
      existing.eventCount += 1;
      return;
    }

    groups.set(subjectKey, {
      subjectKey,
      subjectLabel: row.affected,
      subjectDetail: resolveSubjectDetail(log, row, episodeId),
      episodeId,
      patientIdentifier: row.patientIdentifier,
      eventCount: 1,
      originCoverageLabel: '0% con IP',
      packageKindLabel: episodeId ? 'Paquete por episodio' : 'Paquete por paciente',
      packageSummary: '',
      clinicalAreas: [],
      latestTimestamp: row.timestamp,
      events: [event],
    });
  });

  return [...groups.values()]
    .map(group => {
      const events = [...group.events].sort((a, b) => b.sortTime - a.sortTime);
      const originCoverageLabel = resolveOriginCoverageLabel(events);
      const clinicalAreas = resolveClinicalAreas(events);
      return {
        ...group,
        latestTimestamp: events[0]?.timestamp || group.latestTimestamp,
        originCoverageLabel,
        packageKindLabel: resolvePackageKindLabel(group),
        packageSummary: resolvePackageSummary(events, originCoverageLabel, clinicalAreas),
        clinicalAreas,
        events,
      };
    })
    .sort((a, b) => (b.events[0]?.sortTime || 0) - (a.events[0]?.sortTime || 0));
};
