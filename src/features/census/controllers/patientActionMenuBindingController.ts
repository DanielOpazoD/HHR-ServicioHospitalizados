import type {
  PatientActionMenuBinding,
  PatientActionMenuIndicators,
  RowMenuAlign,
} from '@/features/census/components/patient-row/patientRowContracts';
import {
  resolvePatientActionMenuViewState,
  type ResolvePatientActionMenuViewParams,
} from '@/features/census/controllers/patientActionMenuViewController';

interface ResolvePatientActionMenuBindingParams extends ResolvePatientActionMenuViewParams {
  align?: RowMenuAlign;
  indicators?: Required<PatientActionMenuIndicators>;
}

export const resolvePatientActionMenuBinding = ({
  align = 'top',
  isBlocked,
  readOnly,
  hasHistoryAction,
  hasClinicalDocumentsAction,
  hasExamRequestAction,
  hasImagingRequestAction,
  indicators,
}: ResolvePatientActionMenuBindingParams): PatientActionMenuBinding => ({
  align,
  isBlocked,
  readOnly,
  indicators: indicators || {
    hasClinicalDocument: false,
    isNewAdmission: false,
  },
  availability: resolvePatientActionMenuViewState({
    isBlocked,
    readOnly,
    hasHistoryAction,
    hasClinicalDocumentsAction,
    hasExamRequestAction,
    hasImagingRequestAction,
  }),
});
