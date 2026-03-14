export interface ResolvePatientActionMenuViewParams {
  isBlocked: boolean;
  readOnly: boolean;
  accessProfile?: 'default' | 'specialist';
  hasHistoryAction: boolean;
  hasClinicalDocumentsAction: boolean;
  hasExamRequestAction: boolean;
  hasImagingRequestAction: boolean;
}

export interface PatientActionMenuViewState {
  showDemographicsAction: boolean;
  showMenuTrigger: boolean;
  showHistoryAction: boolean;
  showUtilityActions: boolean;
  showClinicalSection: boolean;
  showBuiltInClinicalActions: boolean;
  showClinicalDocumentsAction: boolean;
  showExamRequestAction: boolean;
  showImagingRequestAction: boolean;
}

export const resolvePatientActionMenuViewState = ({
  isBlocked,
  readOnly,
  accessProfile = 'default',
  hasHistoryAction,
  hasClinicalDocumentsAction,
  hasExamRequestAction,
  hasImagingRequestAction,
}: ResolvePatientActionMenuViewParams): PatientActionMenuViewState => {
  if (accessProfile === 'specialist') {
    const showClinicalSection = !isBlocked;
    const showClinicalDocumentsAction = showClinicalSection && hasClinicalDocumentsAction;
    const showExamRequestAction = showClinicalSection && hasExamRequestAction;
    const showImagingRequestAction = showClinicalSection && hasImagingRequestAction;
    const showMenuTrigger =
      showClinicalDocumentsAction || showExamRequestAction || showImagingRequestAction;

    return {
      showDemographicsAction: false,
      showMenuTrigger,
      showHistoryAction: false,
      showUtilityActions: false,
      showClinicalSection,
      showBuiltInClinicalActions: false,
      showClinicalDocumentsAction,
      showExamRequestAction,
      showImagingRequestAction,
    };
  }

  const showUtilityActions = !readOnly;
  const showMenuTrigger = !readOnly || hasHistoryAction || hasClinicalDocumentsAction;
  const showDemographicsAction = !isBlocked && !readOnly;
  const showClinicalSection = !isBlocked && (!readOnly || hasClinicalDocumentsAction);
  const showHistoryAction = !readOnly && hasHistoryAction;

  return {
    showDemographicsAction,
    showMenuTrigger,
    showHistoryAction,
    showUtilityActions,
    showClinicalSection,
    showBuiltInClinicalActions: showClinicalSection && !readOnly,
    showClinicalDocumentsAction: showClinicalSection && hasClinicalDocumentsAction,
    showExamRequestAction: !readOnly && showClinicalSection && hasExamRequestAction,
    showImagingRequestAction: !readOnly && showClinicalSection && hasImagingRequestAction,
  };
};

export const resolvePatientActionMenuPanelClassName = (align: 'top' | 'bottom'): string =>
  align === 'top' ? 'top-0' : 'bottom-0';
