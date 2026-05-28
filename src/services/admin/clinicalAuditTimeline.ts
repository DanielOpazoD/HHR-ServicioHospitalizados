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
  eventCount: number;
  latestTimestamp: string;
  events: ClinicalAuditTimelineEvent[];
}

const normalizeSubjectKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const resolveSubjectKey = (log: AuditLogEntry, row: ClinicalAuditExportRow): string => {
  if (row.patientIdentifier !== '-') return `patient:${normalizeSubjectKey(row.patientIdentifier)}`;
  if (row.affected) return `subject:${normalizeSubjectKey(row.affected)}`;
  return `entity:${normalizeSubjectKey(log.entityId || log.entityType)}`;
};

const resolveSubjectDetail = (log: AuditLogEntry, row: ClinicalAuditExportRow): string => {
  const pieces = [
    row.patientIdentifier !== '-' ? `RUT/ID ${row.patientIdentifier}` : '',
    log.entityId ? `Registro ${log.entityId}` : '',
    row.clinicalArea ? `Area ${row.clinicalArea}` : '',
  ].filter(Boolean);

  return pieces.join(' · ') || 'Sin identificador adicional';
};

export const buildClinicalAuditTimelineGroups = (
  logs: AuditLogEntry[]
): ClinicalAuditTimelineGroup[] => {
  const rows = buildClinicalAuditExportRows(logs);
  const groups = new Map<string, ClinicalAuditTimelineGroup>();

  logs.forEach((log, index) => {
    const row = rows[index];
    const subjectKey = resolveSubjectKey(log, row);
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
      subjectDetail: resolveSubjectDetail(log, row),
      eventCount: 1,
      latestTimestamp: row.timestamp,
      events: [event],
    });
  });

  return [...groups.values()]
    .map(group => {
      const events = [...group.events].sort((a, b) => b.sortTime - a.sortTime);
      return {
        ...group,
        latestTimestamp: events[0]?.timestamp || group.latestTimestamp,
        events,
      };
    })
    .sort((a, b) => (b.events[0]?.sortTime || 0) - (a.events[0]?.sortTime || 0));
};
