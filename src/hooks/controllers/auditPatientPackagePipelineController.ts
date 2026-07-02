import { AUDIT_ACTION_LABELS } from '@/services/admin/auditConstants';
import {
  buildClinicalAuditPatientPackages,
  type ClinicalAuditPatientPackage,
} from '@/services/admin/clinicalAuditPatientPackages';
import {
  buildClinicalAuditPatientPackageFilterOptions,
  buildClinicalAuditPatientPackageIntentOptions,
  getClinicalAuditPatientPackageCategories,
  resolveClinicalAuditPatientPackageIntent,
  type ClinicalAuditPatientPackageFilterId,
  type ClinicalAuditPatientPackageFilterOption,
  type ClinicalAuditPatientPackageIntentId,
  type ClinicalAuditPatientPackageIntentOption,
} from '@/services/admin/clinicalAuditPatientPackageFilters';
import type { AuditLogEntry } from '@/types/auditLogTypes';

export interface IndexedClinicalAuditPatientPackage {
  auditPackage: ClinicalAuditPatientPackage;
  searchIndex: string;
}

export interface AuditPatientPackagePipelineParams {
  sourceLogs: AuditLogEntry[];
  searchTerm: string;
  activeFilter: ClinicalAuditPatientPackageFilterId;
  activeIntent: ClinicalAuditPatientPackageIntentId;
  currentPage: number;
  itemsPerPage: number;
}

export interface AuditPatientPackagePipelineResult {
  unfilteredPatientPackages: ClinicalAuditPatientPackage[];
  intentPatientPackages: ClinicalAuditPatientPackage[];
  patientPackages: ClinicalAuditPatientPackage[];
  paginatedPatientPackages: ClinicalAuditPatientPackage[];
  patientPackageFilterOptions: ClinicalAuditPatientPackageFilterOption[];
  patientPackageIntentOptions: ClinicalAuditPatientPackageIntentOption[];
  totalPages: number;
  activeDisplayCount: number;
}

const normalizePatientPackageSearch = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');

const buildClinicalAuditPatientPackageSearchIndex = (
  auditPackage: ClinicalAuditPatientPackage
): string => {
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
    .map(normalizePatientPackageSearch)
    .join(' ');
};

export const buildIndexedClinicalAuditPatientPackages = (
  patientPackages: ClinicalAuditPatientPackage[],
  buildSearchIndex = buildClinicalAuditPatientPackageSearchIndex
): IndexedClinicalAuditPatientPackage[] =>
  patientPackages.map(auditPackage => ({
    auditPackage,
    searchIndex: buildSearchIndex(auditPackage),
  }));

const matchesPatientPackageFilter = (
  auditPackage: ClinicalAuditPatientPackage,
  activeFilter: ClinicalAuditPatientPackageFilterId
): boolean => getClinicalAuditPatientPackageCategories(auditPackage).includes(activeFilter);

const matchesPatientPackageIntent = (
  auditPackage: ClinicalAuditPatientPackage,
  activeIntent: ClinicalAuditPatientPackageIntentId
): boolean => resolveClinicalAuditPatientPackageIntent(auditPackage) === activeIntent;

const filterIndexedPatientPackages = (
  indexedPackages: IndexedClinicalAuditPatientPackage[],
  params: Pick<AuditPatientPackagePipelineParams, 'searchTerm' | 'activeFilter' | 'activeIntent'>
): ClinicalAuditPatientPackage[] => {
  const search = normalizePatientPackageSearch(params.searchTerm);

  return indexedPackages
    .filter(({ auditPackage, searchIndex }) => {
      const matchesSearch = !search || searchIndex.includes(search);
      return (
        matchesSearch &&
        matchesPatientPackageIntent(auditPackage, params.activeIntent) &&
        matchesPatientPackageFilter(auditPackage, params.activeFilter)
      );
    })
    .map(({ auditPackage }) => auditPackage);
};

const paginatePatientPackages = (
  patientPackages: ClinicalAuditPatientPackage[],
  currentPage: number,
  itemsPerPage: number
): ClinicalAuditPatientPackage[] => {
  const startIndex = (currentPage - 1) * itemsPerPage;
  return patientPackages.slice(startIndex, startIndex + itemsPerPage);
};

export const buildAuditPatientPackagePipeline = ({
  sourceLogs,
  searchTerm,
  activeFilter,
  activeIntent,
  currentPage,
  itemsPerPage,
}: AuditPatientPackagePipelineParams): AuditPatientPackagePipelineResult => {
  const unfilteredPatientPackages = buildClinicalAuditPatientPackages(sourceLogs);
  const indexedPatientPackages =
    buildIndexedClinicalAuditPatientPackages(unfilteredPatientPackages);
  const patientPackageIntentOptions =
    buildClinicalAuditPatientPackageIntentOptions(unfilteredPatientPackages);
  const intentPatientPackages = indexedPatientPackages
    .filter(({ auditPackage }) => matchesPatientPackageIntent(auditPackage, activeIntent))
    .map(({ auditPackage }) => auditPackage);
  const patientPackageFilterOptions =
    buildClinicalAuditPatientPackageFilterOptions(intentPatientPackages);
  const patientPackages = filterIndexedPatientPackages(indexedPatientPackages, {
    searchTerm,
    activeFilter,
    activeIntent,
  });

  return {
    unfilteredPatientPackages,
    intentPatientPackages,
    patientPackages,
    paginatedPatientPackages: paginatePatientPackages(patientPackages, currentPage, itemsPerPage),
    patientPackageFilterOptions,
    patientPackageIntentOptions,
    totalPages: Math.ceil(patientPackages.length / itemsPerPage),
    activeDisplayCount: patientPackages.length,
  };
};
