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
  firstSeenDate?: string;
  admissionDate?: string;
  admissionTime?: string;
  hasClinicalDocument: boolean;
  /**
   * Whether this patient was discharged earlier on the same census day.
   * When true, the patient is a same-day readmission and the new-admission
   * badge is forced on regardless of the clinical day calculation.
   */
  wasDischargedSameDay?: boolean;
}

const buildMainRowIndicators = ({
  currentDateString,
  firstSeenDate,
  admissionDate,
  admissionTime,
  hasClinicalDocument,
  wasDischargedSameDay,
}: Omit<BuildOccupiedPatientRowIndicatorsParams, 'isSubRow'>): PatientRowResolvedIndicators => ({
  hasClinicalDocument,
  isNewAdmission:
    wasDischargedSameDay ||
    resolveIsNewAdmissionForRecord({
      recordDate: currentDateString,
      firstSeenDate,
      admissionDate,
      admissionTime,
    }),
});

export const buildOccupiedPatientRowIndicators = ({
  isSubRow,
  currentDateString,
  firstSeenDate,
  admissionDate,
  admissionTime,
  hasClinicalDocument,
  wasDischargedSameDay,
}: BuildOccupiedPatientRowIndicatorsParams): PatientRowResolvedIndicators => {
  if (isSubRow) {
    return EMPTY_PATIENT_ROW_INDICATORS;
  }

  return buildMainRowIndicators({
    currentDateString,
    firstSeenDate,
    admissionDate,
    admissionTime,
    hasClinicalDocument,
    wasDischargedSameDay,
  });
};
