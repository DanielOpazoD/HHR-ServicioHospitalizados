import {
  buildClinicalAuditPatientPackages,
  type ClinicalAuditPatientPackage,
} from '@/services/admin/clinicalAuditPatientPackages';
import {
  buildIndexedClinicalAuditPatientPackages,
  buildClinicalAuditPatientPackageFilterOptions,
  buildClinicalAuditPatientPackageIntentOptions,
  filterIndexedClinicalAuditPatientPackages,
  matchesClinicalAuditPatientPackageIntent,
  type ClinicalAuditPatientPackageFilterId,
  type ClinicalAuditPatientPackageFilterOption,
  type ClinicalAuditPatientPackageIntentId,
  type ClinicalAuditPatientPackageIntentOption,
} from '@/services/admin/clinicalAuditPatientPackageFilters';
import type { AuditLogEntry } from '@/types/auditLogTypes';

export { buildIndexedClinicalAuditPatientPackages };

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
    .filter(({ auditPackage }) =>
      matchesClinicalAuditPatientPackageIntent(auditPackage, activeIntent)
    )
    .map(({ auditPackage }) => auditPackage);
  const patientPackageFilterOptions =
    buildClinicalAuditPatientPackageFilterOptions(intentPatientPackages);
  const patientPackages = filterIndexedClinicalAuditPatientPackages(indexedPatientPackages, {
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
