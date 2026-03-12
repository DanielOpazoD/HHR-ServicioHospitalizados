import React from 'react';
import { DemographicsModal } from '@/components/modals/DemographicsModal';
import { ExamRequestModal } from '@/components/modals/ExamRequestModal';
import { ImagingRequestDialog } from '@/components/modals/ImagingRequestDialog';
import { PatientHistoryModal } from '@/components/modals/PatientHistoryModal';
import { ClinicalDocumentsModal } from '@/features/clinical-documents';
import { buildPatientRowModalRenderModel } from '@/features/census/controllers/patientRowModalRenderController';
import type { PatientRowModalsProps } from '@/features/census/components/patient-row/patientRowViewContracts';

export const PatientRowModals: React.FC<PatientRowModalsProps> = ({
  bedId,
  data,
  currentDateString,
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
  onCloseDemographics,
  onCloseClinicalDocuments,
  onCloseExamRequest,
  onCloseImagingRequest,
  onCloseHistory,
  onSaveDemographics,
  onSaveCribDemographics,
}) => {
  const {
    demographicsBinding,
    visibilityState,
    demographicsKey,
    historyPatientRut,
    historyPatientName,
  } = buildPatientRowModalRenderModel({
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
  });

  return (
    <>
      {visibilityState.shouldRenderDemographics ? (
        <DemographicsModal
          key={demographicsKey}
          isOpen={showDemographics}
          onClose={onCloseDemographics}
          data={data}
          onSave={demographicsBinding.onSave}
          bedId={demographicsBinding.targetBedId}
          recordDate={currentDateString}
          isClinicalCribPatient={demographicsBinding.isRnIdentityContext}
        />
      ) : null}

      {visibilityState.shouldRenderExamRequest && (
        <ExamRequestModal
          key={`exam-request-${bedId}-${showExamRequest}`}
          isOpen={showExamRequest}
          onClose={onCloseExamRequest}
          patient={data}
        />
      )}

      {visibilityState.shouldRenderImagingRequest ? (
        <ImagingRequestDialog
          isOpen={showImagingRequest}
          onClose={onCloseImagingRequest}
          patient={data}
        />
      ) : null}

      {visibilityState.shouldRenderClinicalDocuments ? (
        <ClinicalDocumentsModal
          isOpen={showClinicalDocuments}
          onClose={onCloseClinicalDocuments}
          patient={data}
          currentDateString={currentDateString}
          bedId={bedId}
        />
      ) : null}

      {visibilityState.shouldRenderHistory ? (
        <PatientHistoryModal
          isOpen={showHistory}
          onClose={onCloseHistory}
          patientRut={historyPatientRut}
          patientName={historyPatientName}
          patient={data}
          currentDateString={currentDateString}
          bedId={bedId}
        />
      ) : null}
    </>
  );
};
