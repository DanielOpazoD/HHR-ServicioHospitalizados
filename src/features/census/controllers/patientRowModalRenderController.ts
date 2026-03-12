import type { PatientData } from '@/types';
import { resolvePatientRowDemographicsBinding } from '@/features/census/controllers/patientRowModalController';
import { resolvePatientRowModalVisibilityState } from '@/features/census/controllers/patientRowModalVisibilityController';
import type { PatientRowModalsProps } from '@/features/census/components/patient-row/patientRowViewContracts';

export interface PatientRowModalRenderModel {
  demographicsBinding: ReturnType<typeof resolvePatientRowDemographicsBinding>;
  visibilityState: ReturnType<typeof resolvePatientRowModalVisibilityState>;
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
    demographicsBinding,
    visibilityState,
    demographicsKey: `demographics-${demographicsBinding.targetBedId}-${showDemographics ? 'open' : 'closed'}-${data.patientName}-${data.rut}-${data.identityStatus || 'na'}`,
    historyPatientRut: data.rut || '',
    historyPatientName: data.patientName,
  };
};
