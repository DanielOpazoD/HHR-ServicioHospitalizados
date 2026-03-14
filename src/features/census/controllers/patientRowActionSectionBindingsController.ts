import type { PatientMainRowViewProps } from '@/features/census/components/patient-row/patientRowViewContracts';
import type { PatientMainRowActionCellProps } from '@/features/census/components/patient-row/patientRowViewContracts';
import { calculateHospitalizedDays } from '@/features/census/controllers/patientBedConfigViewController';

export type PatientActionSectionBinding = PatientMainRowActionCellProps;

export const buildPatientActionSectionBinding = ({
  isBlocked,
  readOnly,
  actionMenuAlign,
  indicators,
  mainRowViewState,
  accessProfile,
  data,
  currentDateString,
  onAction,
  onOpenDemographics,
  onOpenClinicalDocuments,
  onOpenExamRequest,
  onOpenImagingRequest,
  onOpenHistory,
}: Pick<
  PatientMainRowViewProps,
  | 'isBlocked'
  | 'readOnly'
  | 'actionMenuAlign'
  | 'indicators'
  | 'mainRowViewState'
  | 'accessProfile'
  | 'data'
  | 'currentDateString'
  | 'onAction'
  | 'onOpenDemographics'
  | 'onOpenClinicalDocuments'
  | 'onOpenExamRequest'
  | 'onOpenImagingRequest'
  | 'onOpenHistory'
>): PatientActionSectionBinding => {
  const daysHospitalized = calculateHospitalizedDays({
    admissionDate: data.admissionDate,
    currentDate: currentDateString,
  });

  return {
    isBlocked,
    readOnly,
    align: actionMenuAlign,
    showCmaAction: daysHospitalized === null || daysHospitalized <= 1,
    accessProfile,
    hasClinicalDocument: indicators.hasClinicalDocument,
    isNewAdmission: indicators.isNewAdmission,
    onAction,
    onViewDemographics: onOpenDemographics,
    onViewClinicalDocuments: mainRowViewState.rowActionsAvailability.canOpenClinicalDocuments
      ? onOpenClinicalDocuments
      : undefined,
    onViewExamRequest: mainRowViewState.rowActionsAvailability.canOpenExamRequest
      ? onOpenExamRequest
      : undefined,
    onViewImagingRequest: mainRowViewState.rowActionsAvailability.canOpenImagingRequest
      ? onOpenImagingRequest
      : undefined,
    onViewHistory: mainRowViewState.rowActionsAvailability.canOpenHistory
      ? onOpenHistory
      : undefined,
  };
};
