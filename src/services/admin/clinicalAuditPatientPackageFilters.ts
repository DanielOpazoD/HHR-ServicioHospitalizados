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
  | 'CENSUS'
  | 'PATIENT'
  | 'BED'
  | 'DISCHARGE'
  | 'TRANSFER'
  | 'INTERNAL_MOVEMENT'
  | 'CMA'
  | 'CONFLICT'
  | 'VIEW_ACTIVITY'
  | 'SYSTEM'
  | 'DOCUMENTS'
  | 'DIAGNOSIS'
  | 'STATUS'
  | 'MEDICATIONS';

export type ClinicalAuditPatientPackageIntentId =
  | 'CLINICAL_OPERATIONS'
  | 'VIEW_ACTIVITY'
  | 'SYSTEM_SYNC';

export interface ClinicalAuditPatientPackageFilterOption {
  id: ClinicalAuditPatientPackageFilterId;
  label: string;
  count: number;
}

export interface ClinicalAuditPatientPackageIntentOption {
  id: ClinicalAuditPatientPackageIntentId;
  label: string;
  count: number;
}

export interface ClinicalAuditPatientPackageFilterParams {
  searchTerm?: string;
  activeFilter?: ClinicalAuditPatientPackageFilterId;
  activeIntent?: ClinicalAuditPatientPackageIntentId;
}

const FILTER_LABELS: Record<ClinicalAuditPatientPackageFilterId, string> = {
  ALL: 'Todos',
  CENSUS: 'Censo',
  PATIENT: 'Paciente',
  BED: 'Cama',
  DISCHARGE: 'Altas',
  TRANSFER: 'Traslados',
  INTERNAL_MOVEMENT: 'Mov. internos',
  CMA: 'CMA',
  CONFLICT: 'Conflictos',
  VIEW_ACTIVITY: 'Visualizaciones',
  SYSTEM: 'Sistema',
  DOCUMENTS: 'Documentos',
  DIAGNOSIS: 'Diagnóstico',
  STATUS: 'Estado',
  MEDICATIONS: 'Indicaciones',
};

const INTENT_LABELS: Record<ClinicalAuditPatientPackageIntentId, string> = {
  CLINICAL_OPERATIONS: 'Cambios clínicos/operacionales',
  VIEW_ACTIVITY: 'Visualizaciones',
  SYSTEM_SYNC: 'Sistema/sincronización',
};

const FILTER_ORDER: ClinicalAuditPatientPackageFilterId[] = [
  'ALL',
  'CENSUS',
  'PATIENT',
  'BED',
  'DISCHARGE',
  'TRANSFER',
  'INTERNAL_MOVEMENT',
  'CMA',
  'DOCUMENTS',
  'DIAGNOSIS',
  'STATUS',
  'CONFLICT',
  'VIEW_ACTIVITY',
  'SYSTEM',
  'MEDICATIONS',
];

const INTENT_ORDER: ClinicalAuditPatientPackageIntentId[] = [
  'CLINICAL_OPERATIONS',
  'VIEW_ACTIVITY',
  'SYSTEM_SYNC',
];

const SYSTEM_SYNC_ACTIONS = new Set<AuditAction>([
  'CONFLICT_AUTO_MERGED',
  'CONFLICT_VERSION_RESTORED',
  'DAILY_RECORD_CREATED',
  'DAILY_RECORD_DELETED',
  'PREVIOUS_DAY_EDIT_CONFIRMED',
  'DATA_IMPORTED',
  'DATA_EXPORTED',
  'PATIENT_HARMONIZED',
  'DATA_ADMISSION_DATES_BACKFILLED',
  'SYSTEM_ERROR',
]);

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

const packageHasOnlyActions = (
  auditPackage: ClinicalAuditPatientPackage,
  actions: Set<AuditAction>
): boolean =>
  auditPackage.actions.length > 0 && auditPackage.actions.every(action => actions.has(action));

export const resolveClinicalAuditPatientPackageIntent = (
  auditPackage: ClinicalAuditPatientPackage
): ClinicalAuditPatientPackageIntentId => {
  if (packageHasOnlyActions(auditPackage, VIEW_AUDIT_ACTIONS)) return 'VIEW_ACTIVITY';
  if (
    packageHasOnlyActions(auditPackage, SYSTEM_SYNC_ACTIONS) ||
    (auditPackage.flags.conflict &&
      !auditPackage.flags.admission &&
      !auditPackage.flags.discharge &&
      !auditPackage.flags.transfer &&
      !auditPackage.flags.internalMovement &&
      !auditPackage.flags.cma &&
      !auditPackage.flags.diagnosis &&
      !auditPackage.flags.status)
  ) {
    return 'SYSTEM_SYNC';
  }
  return 'CLINICAL_OPERATIONS';
};

export const getClinicalAuditPatientPackageCategories = (
  auditPackage: ClinicalAuditPatientPackage
): ClinicalAuditPatientPackageFilterId[] => {
  const categories: ClinicalAuditPatientPackageFilterId[] = ['ALL'];

  const push = (category: ClinicalAuditPatientPackageFilterId) => {
    if (!categories.includes(category)) categories.push(category);
  };

  if (auditPackage.recordDate) push('CENSUS');
  if (auditPackage.patientName || auditPackage.patientRut || auditPackage.patientIdentifier) {
    push('PATIENT');
  }
  if (auditPackage.primaryBedLabel) push('BED');
  if (auditPackage.flags.discharge) push('DISCHARGE');
  if (auditPackage.flags.transfer) push('TRANSFER');
  if (auditPackage.flags.internalMovement) push('INTERNAL_MOVEMENT');
  if (auditPackage.flags.cma) push('CMA');
  if (packageHasAnyAction(auditPackage, DOCUMENT_AUDIT_ACTIONS)) push('DOCUMENTS');
  if (auditPackage.flags.diagnosis) push('DIAGNOSIS');
  if (auditPackage.flags.status) push('STATUS');
  if (auditPackage.flags.conflict) push('CONFLICT');
  if (packageHasAnyAction(auditPackage, VIEW_AUDIT_ACTIONS)) push('VIEW_ACTIVITY');
  if (
    resolveClinicalAuditPatientPackageIntent(auditPackage) === 'SYSTEM_SYNC' ||
    packageHasAnyAction(auditPackage, SYSTEM_SYNC_ACTIONS)
  ) {
    push('SYSTEM');
  }
  if (packageHasAnyAction(auditPackage, MEDICATION_AUDIT_ACTIONS)) push('MEDICATIONS');

  return categories;
};

const matchesFilter = (
  auditPackage: ClinicalAuditPatientPackage,
  activeFilter: ClinicalAuditPatientPackageFilterId
): boolean => {
  return getClinicalAuditPatientPackageCategories(auditPackage).includes(activeFilter);
};

const matchesIntent = (
  auditPackage: ClinicalAuditPatientPackage,
  activeIntent: ClinicalAuditPatientPackageIntentId
): boolean => resolveClinicalAuditPatientPackageIntent(auditPackage) === activeIntent;

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
  const activeIntent = params.activeIntent;

  return patientPackages.filter(auditPackage => {
    const matchesSearch = !search || buildSearchText(auditPackage).includes(search);
    const matchesActiveIntent = !activeIntent || matchesIntent(auditPackage, activeIntent);
    return matchesSearch && matchesActiveIntent && matchesFilter(auditPackage, activeFilter);
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

export const buildClinicalAuditPatientPackageIntentOptions = (
  patientPackages: ClinicalAuditPatientPackage[]
): ClinicalAuditPatientPackageIntentOption[] =>
  INTENT_ORDER.map(id => ({
    id,
    label: INTENT_LABELS[id],
    count: patientPackages.filter(auditPackage => matchesIntent(auditPackage, id)).length,
  }));
