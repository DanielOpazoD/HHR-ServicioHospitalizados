import type { PatientRowAction } from '@/features/census/types/patientRowActionTypes';

export interface PatientActionMenuInteractionHandlers {
  handleAction: (action: PatientRowAction) => void;
  handleViewHistory: () => void;
  handleViewClinicalDocuments: () => void;
  handleViewExamRequest: () => void;
  handleViewImagingRequest: () => void;
  handleViewMedicalIndications: () => void;
}

interface BuildPatientActionMenuInteractionHandlersParams {
  onAction: (action: PatientRowAction) => void;
  onViewHistory?: () => void;
  onViewClinicalDocuments?: () => void;
  onViewExamRequest?: () => void;
  onViewImagingRequest?: () => void;
  onViewMedicalIndications?: () => void;
  close: () => void;
}

const invokeAndClose = (callback: (() => void) | undefined, close: () => void) => () => {
  callback?.();
  close();
};

export const buildPatientActionMenuInteractionHandlers = ({
  onAction,
  onViewHistory,
  onViewClinicalDocuments,
  onViewExamRequest,
  onViewImagingRequest,
  onViewMedicalIndications,
  close,
}: BuildPatientActionMenuInteractionHandlersParams): PatientActionMenuInteractionHandlers => ({
  handleAction: action => {
    onAction(action);
    close();
  },
  handleViewHistory: invokeAndClose(onViewHistory, close),
  handleViewClinicalDocuments: invokeAndClose(onViewClinicalDocuments, close),
  handleViewExamRequest: invokeAndClose(onViewExamRequest, close),
  handleViewImagingRequest: invokeAndClose(onViewImagingRequest, close),
  handleViewMedicalIndications: invokeAndClose(onViewMedicalIndications, close),
});
