import type { PatientMainRowViewProps } from '@/features/census/components/patient-row/patientRowViewContracts';
import type { PatientMainRowActionCellProps } from '@/features/census/components/patient-row/PatientMainRowActionCell';

export type PatientActionSectionBinding = PatientMainRowActionCellProps;

export const buildPatientActionSectionBinding = ({
  isBlocked,
  readOnly,
  actionMenuAlign,
  indicators,
  mainRowViewState,
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
  | 'onAction'
  | 'onOpenDemographics'
  | 'onOpenClinicalDocuments'
  | 'onOpenExamRequest'
  | 'onOpenImagingRequest'
  | 'onOpenHistory'
>): PatientActionSectionBinding => ({
  isBlocked,
  readOnly,
  align: actionMenuAlign,
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
  onViewHistory: mainRowViewState.rowActionsAvailability.canOpenHistory ? onOpenHistory : undefined,
});
