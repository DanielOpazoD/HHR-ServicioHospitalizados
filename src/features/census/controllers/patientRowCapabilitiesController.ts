import type { UserRole } from '@/types';
import { canReadClinicalDocuments } from '@/application/clinical-documents/clinicalDocumentAccessPolicy';
import type { CensusAccessProfile } from '@/features/census/types/censusAccessProfile';
import { isSpecialistCensusAccessProfile } from '@/features/census/types/censusAccessProfile';

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
  const canReadClinical = canReadClinicalDocuments(role);
  const hasClinicalContext = !isBlocked && !isEmpty && hasPatientName;
  const specialistAccess = isSpecialistCensusAccessProfile(accessProfile);

  return {
    canOpenClinicalDocuments: hasClinicalContext && canReadClinical,
    canOpenExamRequest: hasPatientName,
    canOpenImagingRequest: hasPatientName,
    canOpenHistory: specialistAccess ? false : hasRut,
    canShowClinicalDocumentIndicator: hasClinicalContext && canReadClinical,
  };
};
