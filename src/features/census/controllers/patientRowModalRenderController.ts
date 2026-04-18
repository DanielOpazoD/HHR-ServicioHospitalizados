import { resolvePatientRowDemographicsBinding } from '@/features/census/controllers/patientRowModalController';
import { resolvePatientRowModalVisibilityState } from '@/features/census/controllers/patientRowModalVisibilityController';
import type { PatientRowModalsProps } from '@/features/census/components/patient-row/patientRowViewContracts';

export interface PatientRowModalRenderModel {
  demographicsBinding: ReturnType<typeof resolvePatientRowDemographicsBinding>;
  visibilityState: ReturnType<typeof resolvePatientRowModalVisibilityState>;
  shouldRenderAnyModal: boolean;
  demographicsKey: string;
  historyPatientRut: string;
  historyPatientName: string;
}

type PatientRowModalRenderInput = Pick<
  PatientRowModalsProps,
  | 'bedId'
  | 'data'
  | 'isSubRow'
  | 'showDemographics'
  | 'showClinicalDocuments'
  | 'canOpenClinicalDocuments'
  | 'showExamRequest'
  | 'canOpenExamRequest'
  | 'showImagingRequest'
  | 'canOpenImagingRequest'
  | 'showHistory'
  | 'canOpenHistory'
  | 'onSaveDemographics'
  | 'onSaveCribDemographics'
>;

export const resolvePatientRowModalMountState = ({
  showDemographics,
  showClinicalDocuments,
  canOpenClinicalDocuments,
  showExamRequest,
  canOpenExamRequest,
  showImagingRequest,
  canOpenImagingRequest,
  showHistory,
  canOpenHistory,
}: Pick<
  PatientRowModalsProps,
  | 'showDemographics'
  | 'showClinicalDocuments'
  | 'canOpenClinicalDocuments'
  | 'showExamRequest'
  | 'canOpenExamRequest'
  | 'showImagingRequest'
  | 'canOpenImagingRequest'
  | 'showHistory'
  | 'canOpenHistory'
>) => {
  const visibilityState = resolvePatientRowModalVisibilityState({
    showDemographics,
    showClinicalDocuments,
    canOpenClinicalDocuments,
    showExamRequest,
    canOpenExamRequest,
    showImagingRequest,
    canOpenImagingRequest,
    showHistory,
    canOpenHistory,
  });

  return {
    visibilityState,
    shouldRenderAnyModal:
      visibilityState.shouldRenderDemographics ||
      visibilityState.shouldRenderClinicalDocuments ||
      visibilityState.shouldRenderExamRequest ||
      visibilityState.shouldRenderImagingRequest ||
      visibilityState.shouldRenderHistory,
  };
};

export const buildPatientRowModalRenderModel = ({
  bedId,
  data,
  isSubRow,
  showDemographics,
  showClinicalDocuments,
  canOpenClinicalDocuments,
  showExamRequest,
  canOpenExamRequest,
  showImagingRequest,
  canOpenImagingRequest,
  showHistory,
  canOpenHistory,
  onSaveDemographics,
  onSaveCribDemographics,
}: PatientRowModalRenderInput): PatientRowModalRenderModel => {
  const demographicsBinding = resolvePatientRowDemographicsBinding({
    bedId,
    isSubRow,
    data,
    onSaveDemographics,
    onSaveCribDemographics,
  });
  const { visibilityState, shouldRenderAnyModal } = resolvePatientRowModalMountState({
    showDemographics,
    showClinicalDocuments,
    canOpenClinicalDocuments,
    showExamRequest,
    canOpenExamRequest,
    showImagingRequest,
    canOpenImagingRequest,
    showHistory,
    canOpenHistory,
  });

  return {
    demographicsBinding,
    visibilityState,
    shouldRenderAnyModal,
    // Keep the modal instance stable while the same bed/context is open.
    // Identity fields can change during the initial activation flow and
    // should not remount the modal unexpectedly.
    demographicsKey: `demographics-${demographicsBinding.targetBedId}-${showDemographics ? 'open' : 'closed'}-${demographicsBinding.isRnIdentityContext ? 'rn' : 'standard'}`,
    historyPatientRut: data.rut || '',
    historyPatientName: data.patientName,
  };
};
