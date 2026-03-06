import type { UserRole } from '@/types';
import { canReadClinicalDocuments } from '@/features/clinical-documents/controllers/clinicalDocumentPermissionController';

interface ResolvePatientRowCapabilitiesParams {
  role?: UserRole;
  patient: {
    patientName?: string;
    rut?: string;
  } | null;
  isBlocked: boolean;
  isEmpty: boolean;
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
}: ResolvePatientRowCapabilitiesParams): PatientRowCapabilities => {
  const hasPatientName = Boolean(patient?.patientName?.trim());
  const hasRut = Boolean(patient?.rut?.trim());
  const canReadClinical = canReadClinicalDocuments(role);
  const hasClinicalContext = !isBlocked && !isEmpty && hasPatientName;

  return {
    canOpenClinicalDocuments: hasClinicalContext && canReadClinical,
    canOpenExamRequest: hasPatientName,
    canOpenImagingRequest: hasPatientName,
    canOpenHistory: hasRut,
    canShowClinicalDocumentIndicator: hasClinicalContext && canReadClinical,
  };
};
