export type PatientRowModalKind =
  | 'demographics'
  | 'clinicalDocuments'
  | 'examRequest'
  | 'imagingRequest'
  | 'history'
  | null;

type PatientRowModalName = Exclude<PatientRowModalKind, null>;

export interface PatientRowUiStateVisibility {
  showDemographics: boolean;
  showClinicalDocuments: boolean;
  showExamRequest: boolean;
  showImagingRequest: boolean;
  showHistory: boolean;
}

export const buildPatientRowUiStateVisibility = (
  activeModal: PatientRowModalKind
): PatientRowUiStateVisibility => ({
  showDemographics: activeModal === 'demographics',
  showClinicalDocuments: activeModal === 'clinicalDocuments',
  showExamRequest: activeModal === 'examRequest',
  showImagingRequest: activeModal === 'imagingRequest',
  showHistory: activeModal === 'history',
});

export const resolvePatientRowModalCloseState = (
  currentModal: PatientRowModalKind,
  modal: PatientRowModalName
): PatientRowModalKind => (currentModal === modal ? null : currentModal);
