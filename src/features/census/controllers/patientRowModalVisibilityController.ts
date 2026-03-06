interface ResolvePatientRowModalVisibilityParams {
  showClinicalDocuments: boolean;
  canOpenClinicalDocuments: boolean;
}

export interface PatientRowModalVisibilityState {
  shouldRenderClinicalDocuments: boolean;
}

export const resolvePatientRowModalVisibilityState = ({
  showClinicalDocuments,
  canOpenClinicalDocuments,
}: ResolvePatientRowModalVisibilityParams): PatientRowModalVisibilityState => ({
  shouldRenderClinicalDocuments: showClinicalDocuments && canOpenClinicalDocuments,
});
