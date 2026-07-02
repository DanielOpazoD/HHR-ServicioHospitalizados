import type { ClinicalAuditPatientPackage } from '@/services/admin/clinicalAuditPatientPackages';
import { formatTimestamp } from './auditUIUtils';

export const formatAuditPackageValue = (value: unknown): string => {
  if (value === undefined || value === null || value === '') return '-';
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

export const displayTimestampParts = (timestamp: string): { date: string; time: string } => {
  const [date = '', time = ''] = formatTimestamp(timestamp).split(' ');
  return { date, time };
};

export const getAuditPackageActorSummary = (auditPackage: ClinicalAuditPatientPackage): string =>
  auditPackage.actors.map(actor => actor.label).join(', ') || 'Usuario no identificado';

const VIEW_ACTIONS = new Set([
  'VIEW_PATIENT',
  'PATIENT_VIEWED',
  'VIEW_CUDYR',
  'VIEW_NURSING_HANDOFF',
  'VIEW_MEDICAL_HANDOFF',
]);

export const isAuditPackageViewAction = (action: string): boolean => VIEW_ACTIONS.has(action);

export const getRawAuditPackageEventsJson = (auditPackage: ClinicalAuditPatientPackage): string =>
  JSON.stringify(
    auditPackage.rawLogs.map(log => ({
      id: log.id,
      timestamp: log.timestamp,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      recordDate: log.recordDate,
      patientIdentifier: log.patientIdentifier,
      details: log.details,
    })),
    null,
    2
  );

export const buildAuditPackageCopySummary = (auditPackage: ClinicalAuditPatientPackage): string => {
  const identity = [
    auditPackage.patientName,
    auditPackage.patientRut ? `RUT/ID ${auditPackage.patientRut}` : '',
    auditPackage.primaryBedLabel ? `Cama ${auditPackage.primaryBedLabel}` : '',
    `Censo ${auditPackage.recordDate}`,
  ]
    .filter(Boolean)
    .join(' · ');
  const changes =
    auditPackage.changes.length > 0
      ? auditPackage.changes
          .map(
            change =>
              `${change.fieldLabel}: ${formatAuditPackageValue(
                change.oldValue
              )} -> ${formatAuditPackageValue(change.newValue)}`
          )
          .join('\n')
      : auditPackage.summary;

  return `${identity}\n${auditPackage.eventCount} eventos · ${getAuditPackageActorSummary(
    auditPackage
  )}\n${changes}`;
};
