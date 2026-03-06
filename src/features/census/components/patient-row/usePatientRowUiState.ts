import { useCallback, useState } from 'react';

type PatientRowModalKind =
  | 'demographics'
  | 'clinicalDocuments'
  | 'examRequest'
  | 'imagingRequest'
  | 'history'
  | null;

interface UsePatientRowUiStateResult {
  showDemographics: boolean;
  showClinicalDocuments: boolean;
  showExamRequest: boolean;
  showImagingRequest: boolean;
  showHistory: boolean;
  openDemographics: () => void;
  closeDemographics: () => void;
  openClinicalDocuments: () => void;
  closeClinicalDocuments: () => void;
  openExamRequest: () => void;
  closeExamRequest: () => void;
  openImagingRequest: () => void;
  closeImagingRequest: () => void;
  openHistory: () => void;
  closeHistory: () => void;
}

export const usePatientRowUiState = (): UsePatientRowUiStateResult => {
  const [activeModal, setActiveModal] = useState<PatientRowModalKind>(null);

  const openDemographics = useCallback(() => setActiveModal('demographics'), []);
  const closeDemographics = useCallback(
    () => setActiveModal(current => (current === 'demographics' ? null : current)),
    []
  );
  const openClinicalDocuments = useCallback(() => setActiveModal('clinicalDocuments'), []);
  const closeClinicalDocuments = useCallback(
    () => setActiveModal(current => (current === 'clinicalDocuments' ? null : current)),
    []
  );
  const openExamRequest = useCallback(() => setActiveModal('examRequest'), []);
  const closeExamRequest = useCallback(
    () => setActiveModal(current => (current === 'examRequest' ? null : current)),
    []
  );
  const openImagingRequest = useCallback(() => setActiveModal('imagingRequest'), []);
  const closeImagingRequest = useCallback(
    () => setActiveModal(current => (current === 'imagingRequest' ? null : current)),
    []
  );
  const openHistory = useCallback(() => setActiveModal('history'), []);
  const closeHistory = useCallback(
    () => setActiveModal(current => (current === 'history' ? null : current)),
    []
  );

  return {
    showDemographics: activeModal === 'demographics',
    showClinicalDocuments: activeModal === 'clinicalDocuments',
    showExamRequest: activeModal === 'examRequest',
    showImagingRequest: activeModal === 'imagingRequest',
    showHistory: activeModal === 'history',
    openDemographics,
    closeDemographics,
    openClinicalDocuments,
    closeClinicalDocuments,
    openExamRequest,
    closeExamRequest,
    openImagingRequest,
    closeImagingRequest,
    openHistory,
    closeHistory,
  };
};
