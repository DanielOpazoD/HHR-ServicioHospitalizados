import type { UserRole } from '@/types/auth';
import type { CensusAccessProfile } from '@/features/census/types/censusAccessProfile';
import {
  canOpenClinicalDocumentsFromCensus,
  canViewPatientHistoryFromRestrictedProfiles,
} from '@/shared/access/operationalAccessPolicy';

interface ResolvePatientRowCapabilitiesParams {
  role?: UserRole;
  patient: {
    patientName?: string;
    rut?: string;
  } | null;
  isBlocked: boolean;
  isEmpty: boolean;
  accessProfile?: CensusAccessProfile;
}

export interface PatientRowCapabilities {
  canOpenClinicalDocuments: boolean;
  canOpenExamRequest: boolean;
  canOpenImagingRequest: boolean;
  canOpenHistory: boolean;
  canShowClinicalDocumentIndicator: boolean;
}

export const resolvePatientRowCapabilities = ({
  role,
  patient,
  isBlocked,
  isEmpty,
  accessProfile = 'default',
}: ResolvePatientRowCapabilitiesParams): PatientRowCapabilities => {
  const hasPatientName = Boolean(patient?.patientName?.trim());
  const hasRut = Boolean(patient?.rut?.trim());
  const canReadClinical = canOpenClinicalDocumentsFromCensus({
    role,
    isBlocked,
    isEmpty,
    hasPatientName,
  });

  return {
    canOpenClinicalDocuments: canReadClinical,
    canOpenExamRequest: hasPatientName,
    canOpenImagingRequest: hasPatientName,
    canOpenHistory: canViewPatientHistoryFromRestrictedProfiles({
      accessProfile,
      hasRut,
    }),
    canShowClinicalDocumentIndicator: canReadClinical,
  };
};
