import type { PatientActionMenuIndicators } from '@/features/census/components/patient-row/patientRowActionContracts';
import { resolveIsNewAdmissionForRecord } from '@/features/census/controllers/patientRowNewAdmissionIndicatorController';

export interface PatientRowResolvedIndicators {
  hasClinicalDocument: boolean;
  isNewAdmission: boolean;
}

export const EMPTY_PATIENT_ROW_INDICATORS: PatientRowResolvedIndicators = {
  hasClinicalDocument: false,
  isNewAdmission: false,
};

interface ResolvePatientRowIndicatorsParams {
  indicators?: PatientActionMenuIndicators;
  canShowClinicalDocumentIndicator: boolean;
}

export const resolvePatientRowIndicators = ({
  indicators,
  canShowClinicalDocumentIndicator,
}: ResolvePatientRowIndicatorsParams): PatientRowResolvedIndicators => ({
  hasClinicalDocument: Boolean(indicators?.hasClinicalDocument) && canShowClinicalDocumentIndicator,
  isNewAdmission: Boolean(indicators?.isNewAdmission),
});

interface BuildOccupiedPatientRowIndicatorsParams {
  isSubRow: boolean;
  currentDateString: string;
  admissionDate?: string;
  admissionTime?: string;
  hasClinicalDocument: boolean;
}

export const buildOccupiedPatientRowIndicators = ({
  isSubRow,
  currentDateString,
  admissionDate,
  admissionTime,
  hasClinicalDocument,
}: BuildOccupiedPatientRowIndicatorsParams): PatientRowResolvedIndicators => {
  if (isSubRow) {
    return EMPTY_PATIENT_ROW_INDICATORS;
  }

  return {
    hasClinicalDocument,
    isNewAdmission: resolveIsNewAdmissionForRecord({
      recordDate: currentDateString,
      admissionDate,
      admissionTime,
    }),
  };
};
