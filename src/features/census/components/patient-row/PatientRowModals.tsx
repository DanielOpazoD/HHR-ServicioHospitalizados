import React from 'react';
import { DemographicsModal } from '@/components/modals/DemographicsModal';
import { ExamRequestModal } from '@/components/modals/ExamRequestModal';
import { ImagingRequestDialog } from '@/components/modals/ImagingRequestDialog';
import { PatientHistoryModal } from '@/components/modals/PatientHistoryModal';
import { ClinicalDocumentsModal } from '@/features/clinical-documents';
import { resolvePatientRowDemographicsBinding } from '@/features/census/controllers/patientRowModalController';
import { resolvePatientRowModalVisibilityState } from '@/features/census/controllers/patientRowModalVisibilityController';
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
  showImagingRequest,
  showHistory,
  onCloseDemographics,
  onCloseClinicalDocuments,
  onCloseExamRequest,
  onCloseImagingRequest,
  onCloseHistory,
  onSaveDemographics,
  onSaveCribDemographics,
}) => {
  const demographicsBinding = resolvePatientRowDemographicsBinding({
    bedId,
    isSubRow,
    onSaveDemographics,
    onSaveCribDemographics,
  });
  const visibilityState = resolvePatientRowModalVisibilityState({
    showClinicalDocuments,
    canOpenClinicalDocuments,
  });

  return (
    <>
      {showDemographics ? (
        <DemographicsModal
          key={`demographics-${demographicsBinding.targetBedId}-${showDemographics ? 'open' : 'closed'}-${data.patientName}-${data.rut}-${data.identityStatus || 'na'}`}
          isOpen={showDemographics}
          onClose={onCloseDemographics}
          data={data}
          onSave={demographicsBinding.onSave}
          bedId={demographicsBinding.targetBedId}
          recordDate={currentDateString}
          isClinicalCribPatient={isSubRow}
        />
      ) : null}

      {showExamRequest && (
        <ExamRequestModal
          key={`exam-request-${bedId}-${showExamRequest}`}
          isOpen={showExamRequest}
          onClose={onCloseExamRequest}
          patient={data}
        />
      )}

      {showImagingRequest ? (
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

      {showHistory ? (
        <PatientHistoryModal
          isOpen={showHistory}
          onClose={onCloseHistory}
          patientRut={data.rut || ''}
          patientName={data.patientName}
          patient={data}
          currentDateString={currentDateString}
          bedId={bedId}
        />
      ) : null}
    </>
  );
};
