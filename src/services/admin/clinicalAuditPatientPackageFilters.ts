import type { AuditAction } from '@/types/auditActionTypes';
import type { ClinicalAuditPatientPackage } from '@/services/admin/clinicalAuditPatientPackages';
import { AUDIT_ACTION_LABELS } from '@/services/admin/auditConstants';
import {
  DOCUMENT_AUDIT_ACTIONS,
  MEDICATION_AUDIT_ACTIONS,
  VIEW_AUDIT_ACTIONS,
} from '@/services/admin/clinicalAuditPatientPackageActionGroups';

export type ClinicalAuditPatientPackageFilterId =
  | 'ALL'
  | 'DISCHARGE'
  | 'TRANSFER'
  | 'INTERNAL_MOVEMENT'
  | 'CMA'
  | 'CONFLICT'
  | 'VIEW_ACTIVITY'
  | 'DOCUMENTS'
  | 'MEDICATIONS';

export interface ClinicalAuditPatientPackageFilterOption {
  id: ClinicalAuditPatientPackageFilterId;
  label: string;
  count: number;
}

export interface ClinicalAuditPatientPackageFilterParams {
  searchTerm?: string;
  activeFilter?: ClinicalAuditPatientPackageFilterId;
}

const FILTER_LABELS: Record<ClinicalAuditPatientPackageFilterId, string> = {
  ALL: 'Todos',
  DISCHARGE: 'Altas',
  TRANSFER: 'Traslados',
  INTERNAL_MOVEMENT: 'Mov. internos',
  CMA: 'CMA',
  CONFLICT: 'Conflictos',
  VIEW_ACTIVITY: 'Visualizaciones',
  DOCUMENTS: 'Documentos',
  MEDICATIONS: 'Indicaciones',
};

const FILTER_ORDER: ClinicalAuditPatientPackageFilterId[] = [
  'ALL',
  'DISCHARGE',
  'TRANSFER',
  'INTERNAL_MOVEMENT',
  'CMA',
  'CONFLICT',
  'VIEW_ACTIVITY',
  'DOCUMENTS',
  'MEDICATIONS',
];

const normalizeSearch = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

const packageHasAnyAction = (
  auditPackage: ClinicalAuditPatientPackage,
  actions: Set<AuditAction>
): boolean => auditPackage.actions.some(action => actions.has(action));

const matchesFilter = (
  auditPackage: ClinicalAuditPatientPackage,
  activeFilter: ClinicalAuditPatientPackageFilterId
): boolean => {
  if (activeFilter === 'ALL') return true;
  if (activeFilter === 'DISCHARGE') return auditPackage.flags.discharge;
  if (activeFilter === 'TRANSFER') return auditPackage.flags.transfer;
  if (activeFilter === 'INTERNAL_MOVEMENT') return auditPackage.flags.internalMovement;
  if (activeFilter === 'CMA') return auditPackage.flags.cma;
  if (activeFilter === 'CONFLICT') return auditPackage.flags.conflict;
  if (activeFilter === 'VIEW_ACTIVITY')
    return packageHasAnyAction(auditPackage, VIEW_AUDIT_ACTIONS);
  if (activeFilter === 'DOCUMENTS')
    return packageHasAnyAction(auditPackage, DOCUMENT_AUDIT_ACTIONS);
  if (activeFilter === 'MEDICATIONS') {
    return packageHasAnyAction(auditPackage, MEDICATION_AUDIT_ACTIONS);
  }
  return true;
};

const buildSearchText = (auditPackage: ClinicalAuditPatientPackage): string => {
  const actionLabels = auditPackage.actions.map(action => AUDIT_ACTION_LABELS[action] || action);
  const actorText = auditPackage.actors.flatMap(actor => [
    actor.label,
    actor.secondary,
    actor.userId,
    actor.uid,
  ]);

  return [
    auditPackage.patientName,
    auditPackage.patientRut,
    auditPackage.patientIdentifier,
    auditPackage.primaryBedLabel,
    auditPackage.recordDate,
    auditPackage.summary,
    ...auditPackage.modules,
    ...actionLabels,
    ...actorText,
    ...auditPackage.ipAddresses,
    ...auditPackage.changes.flatMap(change => [
      change.fieldLabel,
      String(change.oldValue ?? ''),
      String(change.newValue ?? ''),
    ]),
  ]
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .map(normalizeSearch)
    .join(' ');
};

export const filterClinicalAuditPatientPackages = (
  patientPackages: ClinicalAuditPatientPackage[],
  params: ClinicalAuditPatientPackageFilterParams
): ClinicalAuditPatientPackage[] => {
  const search = normalizeSearch(params.searchTerm || '');
  const activeFilter = params.activeFilter || 'ALL';

  return patientPackages.filter(auditPackage => {
    const matchesSearch = !search || buildSearchText(auditPackage).includes(search);
    return matchesSearch && matchesFilter(auditPackage, activeFilter);
  });
};

export const buildClinicalAuditPatientPackageFilterOptions = (
  patientPackages: ClinicalAuditPatientPackage[]
): ClinicalAuditPatientPackageFilterOption[] =>
  FILTER_ORDER.map(id => ({
    id,
    label: FILTER_LABELS[id],
    count: patientPackages.filter(auditPackage => matchesFilter(auditPackage, id)).length,
  }));
